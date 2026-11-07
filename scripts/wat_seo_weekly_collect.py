#!/usr/bin/env python3
"""WAT-specific factual GSC + public-page SEO audit. No fabricated keyword volumes."""
import json
import os
import re
from datetime import date, timedelta, datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
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
    raw = os.getenv("GOOGLE_ADC_JSON", "").strip()
    if not raw:
        return {"status": "BLOCKED", "error": "Missing GOOGLE_ADC_JSON GitHub Actions secret; no Search Console baseline available."}
    try:
        from google.oauth2 import service_account
        data = json.loads(raw)
        credentials = service_account.Credentials.from_service_account_info(
            data, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
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
        }
    except (Exception,) as exc:
        message = str(exc)
        # Prevent accidental key material in issue/artifact. Keep only diagnostic class and codes.
        code = re.search(r"\b(401|403|404|429)\b", message)
        return {"status": "BLOCKED", "error": type(exc).__name__, "http_code": code.group(1) if code else None,
                "hint": "Check service-account permission for WAT GSC property, secret format, quota and API enablement."}


def main():
    gsc_data = get_gsc()
    gsc_rows = (gsc_data.get("current_queries") or {}).get("rows", []) if gsc_data.get("status") == "OK" else []
    ads_data = collect_keyword_planner(gsc_rows)
    result = {
        "site": SITE, "generated_at": datetime.now(timezone.utc).isoformat(),
        "project": "WAT Agency only",
        "site_audit": [fetch_page(path) for path in PAGES + ["/robots.txt", "/sitemap.xml"]],
        "gsc": gsc_data,
        "keyword_planner": ads_data,
        "ga4": {"status": "NOT_VERIFIED", "explanation": "GTM/GA4 site changes are in separate PR; only treat proven live events as data."},
        "competitor_gaps": {"status": "REQUIRES_RESEARCH", "explanation": "Do not claim competitor rankings without dated evidence."},
    }
    path = Path("seo-weekly-context.json")
    path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print("WAT SEO evidence saved:", path)
    print("GSC status:", result["gsc"]["status"])
    print("Public paths audited:", len(result["site_audit"]))


if __name__ == "__main__":
    main()
