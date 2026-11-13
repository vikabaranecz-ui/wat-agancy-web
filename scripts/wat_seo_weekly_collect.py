#!/usr/bin/env python3
"""WAT-specific factual GSC + public-page SEO audit. No fabricated keyword volumes."""
import json
import os
import re
from datetime import date, timedelta, datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse
import xml.etree.ElementTree as ET
import csv
import requests
from wat_ads_collect import collect_keyword_planner
from bs4 import BeautifulSoup

SITE = os.getenv("WAT_SITE_URL", "https://www.watagencybelgium.be").rstrip("/")
GSC_SITE = os.getenv("GSC_SITE_URL", "sc-domain:watagencybelgium.be")
PAGES = ["/en/", "/systems-library/", "/work/isoprotech.html", "/work/reno-rangers.html"]
session = requests.Session()
session.headers["User-Agent"] = "WAT-SEO-Weekly-Audit/1.0 (+site owner automated QA)"


def fetch_page(path):
    url = urljoin(SITE + "/", path.lstrip("/"))
    result = {"url": url, "status": None, "final_url": None}
    try:
        r = session.get(url, timeout=18, allow_redirects=True)
        result["status"] = r.status_code
        result["final_url"] = r.url
        result["redirects"] = [x.status_code for x in r.history]
        result["content_type"] = r.headers.get("Content-Type", "")[:90]
        if "text/html" not in result["content_type"]:
            return result
        soup = BeautifulSoup(r.text, "html.parser")
        title = soup.find("title")
        description = soup.find("meta", attrs={"name": re.compile("^description$", re.I)})
        canonical = soup.find("link", attrs={"rel": "canonical"})
        robots = soup.find("meta", attrs={"name": re.compile("^robots$", re.I)})
        h1 = [x.get_text(" ", strip=True)[:180] for x in soup.select("h1")][:5]
        links = sorted({urljoin(r.url, a.get("href", "")) for a in soup.select("a[href]") if a.get("href", "").startswith(("/", "./", "../"))})
        result.update({
            "title": title.get_text(" ", strip=True)[:180] if title else None,
            "description": (description.get("content") or "")[:230] if description else None,
            "canonical": canonical.get("href") if canonical else None,
            "robots_meta": robots.get("content") if robots else None,
            "h1": h1,
            "internal_links_sample": [u for u in links if "watagencybelgium.be" in u][:30],
            "contact_methods": {
                "tel": len(soup.select('a[href^="tel:"]')),
                "whatsapp": len(soup.select('a[href*="wa.me/"]')),
                "mailto": len(soup.select('a[href^="mailto:"]')),
            },
            "jsonld_blocks": len(soup.select('script[type="application/ld+json"]')),
        })
    except requests.RequestException as exc:
        result["error"] = type(exc).__name__ + ": " + str(exc)[:180]
    return result


def gsc_period(credentials, start, end, dimensions, row_limit=250):
    from google.auth.transport.requests import AuthorizedSession
    url = "https://searchconsole.googleapis.com/webmasters/v3/sites/" + requests.utils.quote(GSC_SITE, safe="") + "/searchAnalytics/query"
    data = {"startDate": str(start), "endDate": str(end), "dimensions": dimensions, "rowLimit": row_limit, "searchType": "web"}
    r = AuthorizedSession(credentials).post(url, json=data, timeout=25)
    r.raise_for_status()
    j = r.json()
    return {"rows": j.get("rows", []), "row_count": len(j.get("rows", []))}


def get_gsc():
    try:
        import google.auth
        credentials, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
        # GSC normally has 2-3 day reporting lag. Use ending three days ago.
        end = date.today() - timedelta(days=3)
        current_start = end - timedelta(days=27)
        previous_end = current_start - timedelta(days=1)
        previous_start = previous_end - timedelta(days=27)
        past90_start = end - timedelta(days=89)
        return {
            "status": "OK", "property": GSC_SITE,
            "windows": {
                "current": [str(current_start), str(end)],
                "previous": [str(previous_start), str(previous_end)],
                "last90": [str(past90_start), str(end)],
            },
            "current_queries": gsc_period(credentials, current_start, end, ["query"], 5000),
            "current_query_pages": gsc_period(credentials, current_start, end, ["query", "page"], 8000),
            "previous_queries": gsc_period(credentials, previous_start, previous_end, ["query"], 5000),
            "current_pages": gsc_period(credentials, current_start, end, ["page"], 2000),
            "last90_queries": gsc_period(credentials, past90_start, end, ["query"]),
            "last90_pages": gsc_period(credentials, past90_start, end, ["page"], 5000),
        }
    except (Exception,) as exc:
        message = str(exc)
        # Prevent accidental key material in issue/artifact. Keep only diagnostic class and codes.
        code = re.search(r"\b(401|403|404|429)\b", message)
        return {"status": "BLOCKED", "error": type(exc).__name__, "http_code": code.group(1) if code else None,
                "hint": "Check GitHub OIDC impersonation, WAT Search Console property access, quota and API enablement."}


def discover_url_inventory(gsc_data):
    """Known canonical URLs from sitemap, historical visible GSC pages, and root.
    This cannot enumerate all excluded URLs in GSC's Page indexing UI.
    """
    urls = {}
    def add(url, source, expected_index=True):
        try:
            p = urlparse(url)
            if p.scheme != "https" or p.hostname not in ("www.watagencybelgium.be","watagencybelgium.be"):
                return
            key = url.split("#")[0].split("?")[0]
            if key not in urls:
                urls[key] = {"url":key,"sources":[],"expected_index":expected_index}
            if source not in urls[key]["sources"]:
                urls[key]["sources"].append(source)
            urls[key]["expected_index"] = urls[key]["expected_index"] or expected_index
        except (ValueError, TypeError):
            return
    add(SITE+"/","root_redirect_check",False)
    for path in PAGES:
        add(SITE+path,"configured_canonical")
    sitemap_status = "BLOCKED"
    try:
        response = session.get(SITE + "/sitemap.xml",timeout=18)
        response.raise_for_status()
        root = ET.fromstring(response.content)
        locs = [n.text.strip() for n in root.iter() if n.tag.rsplit("}",1)[-1]=="loc" and n.text]
        # URL <loc> may include image/news entries; only URLs on the same domain accepted.
        for loc in locs[:250]:
            add(loc,"live_sitemap")
        sitemap_status = "OK"
    except (requests.RequestException, ET.ParseError, ValueError):
        sitemap_status = "BLOCKED"
    # Search Console does not provide excluded-page inventory through its public API.
    # Owners may export affected URLs as CSV from Indexing > Pages.
    export=Path("seo/gsc_page_indexing_export.csv")
    imported=0
    if export.exists():
        try:
            with export.open(encoding="utf-8-sig",newline="") as handle:
                for row in list(csv.DictReader(handle))[:500]:
                    raw=next((str(v).strip() for k,v in row.items()
                              if k and k.strip().lower() in ("url","page","pagina","page url","examples") and v),None)
                    if raw:
                        previous=len(urls)
                        add(raw,"gsc_page_indexing_export",False)
                        imported += len(urls)>previous
        except (OSError,UnicodeError,csv.Error):
            sitemap_status="PARTIAL"
    if gsc_data.get("status")=="OK":
        for key in ("last90_pages","current_pages"):
            for row in (gsc_data.get(key) or {}).get("rows",[]):
                vals=row.get("keys") or []
                if vals:
                    add(vals[0],"gsc_"+key)
    return {"status":sitemap_status,"sitemap_url":SITE+"/sitemap.xml",
            "discovered_count":len(urls),"gsc_export_present":export.exists(),
            "gsc_export_new_urls":imported,"urls":list(urls.values())[:100],
            "limitations":"Sitemap and GSC Performance pages do not include every excluded/not-indexed URL in GSC Page indexing."}

def get_indexing_status(inventory=None):
    """Google indexed-version verdict for observed WAT URLs. No live URL test."""
    candidates=(inventory or {}).get("urls") or [
        {"url":SITE+p,"sources":["configured_canonical"],"expected_index":True} for p in PAGES
    ]
    results=[]
    try:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession
        creds,_=google.auth.default(scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
        api=AuthorizedSession(creds)
        endpoint="https://searchconsole.googleapis.com/v1/urlInspection/index:inspect"
        for candidate in candidates[:40]:
            url=candidate["url"]
            try:
                response=api.post(endpoint,json={"inspectionUrl":url,"siteUrl":GSC_SITE},timeout=30)
                if response.status_code != 200:
                    results.append({"url":url,"sources":candidate.get("sources"),"expected_index":candidate.get("expected_index"),
                                    "status":"BLOCKED","http_code":response.status_code})
                    continue
                info=response.json().get("inspectionResult",{}).get("indexStatusResult",{})
                verdict=info.get("verdict","VERDICT_UNSPECIFIED")
                expected=bool(candidate.get("expected_index"))
                results.append({
                    "url":url, "sources":candidate.get("sources"),
                    "expected_index":expected, "status":"OK", "verdict":verdict,
                    "coverage_state":info.get("coverageState"),
                    "robots_txt_state":info.get("robotsTxtState"),
                    "indexing_state":info.get("indexingState"),
                    "page_fetch_state":info.get("pageFetchState"),
                    "last_crawl_time":info.get("lastCrawlTime"),
                    "google_canonical":info.get("googleCanonical"),
                    "user_canonical":info.get("userCanonical"),
                    "sitemaps":info.get("sitemap",[]),
                    "issue":expected and verdict not in ("PASS",),
                    "classification":("INDEXING_PROBLEM_TO_DIAGNOSE" if expected and verdict != "PASS"
                                      else "INTENTIONAL_OR_HISTORICAL_URL_REVIEW" if not expected
                                      else "INDEXED_VERDICT"),
                })
            except requests.RequestException as exc:
                results.append({"url":url,"status":"BLOCKED","error":type(exc).__name__,
                                "sources":candidate.get("sources"),"expected_index":candidate.get("expected_index")})
        return {"status":"OK" if any(r.get("status")=="OK" for r in results) else "BLOCKED",
                "scope":"Observed canonical/sitemap/GSC history URLs, Google indexed version, not full Page indexing coverage",
                "inspected_count":len(results), "available_count":len(candidates),
                "uninspected_due_to_limit":max(0,len(candidates)-40),"results":results}
    except Exception as exc:
        return {"status":"BLOCKED","error":type(exc).__name__,
                "hint":"Verify GSC property, URL Inspection API and permission."}


def main():
    gsc_data = get_gsc()
    gsc_rows = (gsc_data.get("current_queries") or {}).get("rows", []) if gsc_data.get("status") == "OK" else []
    ads_data = collect_keyword_planner(gsc_rows)
    inventory = discover_url_inventory(gsc_data)
    result = {
        "site": SITE, "generated_at": datetime.now(timezone.utc).isoformat(),
        "project": "WAT Agency only",
        "site_audit": [fetch_page(urlparse(item["url"]).path) for item in inventory["urls"][:40]] + [fetch_page("/robots.txt"), fetch_page("/sitemap.xml")],
        "gsc": gsc_data,
        "gsc_url_inventory": inventory,
        "gsc_indexing": get_indexing_status(inventory),
        "keyword_planner": ads_data,
        "ga4": {"status": "NOT_VERIFIED", "explanation": "GTM/GA4 site changes are in separate PR; only treat proven live events as data."},
        "competitor_gaps": {"status": "REQUIRES_RESEARCH", "explanation": "Do not claim competitor rankings without dated evidence."},
    }
    path = Path("seo-weekly-context.json")
    path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print("WAT SEO evidence saved:", path)
    print("GSC status:", result["gsc"]["status"])
    print("GSC URL Inspection:", result["gsc_indexing"]["status"],
          "| URLs sampled:", len(result["gsc_indexing"].get("results", [])))
    print("Public paths audited:", len(result["site_audit"]))


if __name__ == "__main__":
    main()
