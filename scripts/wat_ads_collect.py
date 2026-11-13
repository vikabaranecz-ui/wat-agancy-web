#!/usr/bin/env python3
"""WAT-only weekly Google Ads demand discovery. Historical metrics are estimates, not SEO rank."""
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import google.auth
import requests
from google.auth.transport.requests import Request
from wat_brand import is_brand_query

BE = "geoTargetConstants/2056"
NL = "languageConstants/1010"
API = "https://googleads.googleapis.com/{version}/customers/{customer}:generateKeywordIdeas"
EXCLUDE = re.compile(r"\b(vacature|vacatures|jobs|opleiding|opleiding(en)?|stage|gratis cursus|sollicitatie|salaris|loon|template|sjabloon|pdf download)\b", re.I)
BUSINESS = re.compile(
    r"marketing|reclame|advert|google|website|webdesign|seo|bedrijf|bedrijven|"
    r"zaak|kmo|aannemer|bouw|renovatie|schoonmaak|poets|tuin|garage|kapper|"
    r"barber|beauty|transport|logistiek|klant|offerte|aanvrag|opdracht|"
    r"leads|social media|online zicht|afspraak|conversie|bedrijfsgroei|"
    r"mond.tot.mond|rendement|budget|promotie|vindbaarheid", re.I
)

def month_metrics(metrics):
    """Exclude current/incomplete month, compare last 3 complete calendar months to prior 3.
    Trend = estimated monthly search history, NOT actual weekly searches.
    """
    raw = metrics.get("monthlySearchVolumes") or []
    month_ids = {"JANUARY":1,"FEBRUARY":2,"MARCH":3,"APRIL":4,"MAY":5,"JUNE":6,
                 "JULY":7,"AUGUST":8,"SEPTEMBER":9,"OCTOBER":10,"NOVEMBER":11,"DECEMBER":12}
    by_month = {}
    now = datetime.now(timezone.utc)
    for x in raw:
        m = x.get("month")
        m = month_ids.get(str(m).upper(), None) if not isinstance(m,int) else m
        try:
            year, volume = int(x["year"]), int(x["monthlySearches"])
            if m and (year, m) < (now.year, now.month):
                by_month[(year,m)] = volume
        except (KeyError, TypeError, ValueError):
            continue
    ordered = sorted(by_month.items(), reverse=True)
    # Avoid claiming a trend when historic month series is incomplete.
    latest = ordered[:3]
    prior = ordered[3:6]
    valid = (len(latest) == 3 and len(prior) == 3 and
             all((a[0][0] * 12 + a[0][1]) - (b[0][0] * 12 + b[0][1]) == 1
                 for a, b in zip(ordered[:5], ordered[1:6])))
    trend = None
    if valid:
        recent_avg = sum(v for _,v in latest) / 3
        prior_avg = sum(v for _,v in prior) / 3
        if prior_avg > 0:
            trend = round((recent_avg / prior_avg - 1) * 100, 1)
    return {
        "latest_complete_month": f"{ordered[0][0][0]}-{ordered[0][0][1]:02d}" if ordered else None,
        "last_3_month_avg": round(sum(v for _,v in latest)/3,1) if len(latest)==3 else None,
        "previous_3_month_avg": round(sum(v for _,v in prior)/3,1) if len(prior)==3 else None,
        "three_month_growth_pct": trend,
        "months_available": len(ordered),
        "status": "ESTIMATED_MONTHLY_DIRECTION" if trend is not None else "INSUFFICIENT_HISTORY"
    }

def relevant_keyword(text, query_seeds):
    t = (text or "").strip()
    if not t or EXCLUDE.search(t) or is_brand_query(t):
        return False
    # Planner suggestions need review for real WAT service fit; this is a filter only.
    return bool(BUSINESS.search(t) or any(seed.lower() in t.lower() for seed in query_seeds))

def parse_idea(item, cluster, seeds):
    metrics = item.get("keywordIdeaMetrics") or {}
    raw = metrics.get("avgMonthlySearches")
    try:
        volume = int(raw) if raw is not None and raw != "" else None
    except (TypeError, ValueError):
        volume = None
    text = (item.get("text") or "").strip()
    return {
        "keyword": text, "source_cluster": cluster,
        "avg_monthly_searches": volume,
        "competition_paid": metrics.get("competition"),
        "competition_index_paid": metrics.get("competitionIndex"),
        "monthly_search_volumes": (metrics.get("monthlySearchVolumes") or [])[-12:],
        "trend": month_metrics(metrics),
        "business_fit": "SCREENED_REQUIRES_SERP_REVIEW" if relevant_keyword(text, seeds) else "EXCLUDE_OR_REVIEW",
        "validated_organic_difficulty": None,
    }

def safe_ads_error(response):
    data = {}
    try:
        err = response.json().get("error") or {}
        data = {"status": err.get("status"), "codes": []}
        for detail in err.get("details", []) or []:
            for e in detail.get("errors", []) or []:
                data["codes"].extend(f"{k}:{v}" for k,v in (e.get("errorCode") or {}).items())
        data["codes"] = data["codes"][:6]
    except (ValueError, TypeError, AttributeError):
        pass
    return {"http": response.status_code, "google": data,
            "request_id": response.headers.get("request-id")}

def collect_keyword_planner(gsc_queries=None):
    customer = re.sub(r"\D", "", os.getenv("WAT_GOOGLE_ADS_CUSTOMER_ID", ""))
    if not customer:
        return {"status":"BLOCKED", "error":"Missing WAT Google Ads customer ID"}
    clusters = json.loads(Path("seo/keyword_targets.json").read_text(encoding="utf-8")).get("clusters",[])
    observed = []
    for row in sorted(gsc_queries or [], key=lambda x:x.get("impressions",0), reverse=True):
        keys = row.get("keys", [])
        if keys and isinstance(keys[0],str) and relevant_keyword(keys[0], []):
            observed.append(keys[0].strip())
    observed = list(dict.fromkeys(observed))[:10]
    result = {
        "status":"BLOCKED", "source":"Google Ads API KeywordPlanIdeaService.generateKeywordIdeas",
        "geo_scope":"Belgium", "language":"Dutch (nl-BE market)", "collected_at":datetime.now(timezone.utc).isoformat(),
        "observed_gsc_seed_count":len(observed),
        "method":"Separate keyword-idea requests across all WAT buyer-problem clusters; recent vs prior 3 complete months only when Google supplies six consecutive months",
        "datasets":{"belgium":{"ideas":[],"count":0}}, "clusters":{}, "errors":[],
        "limitations":["Monthly estimates are not actual weekly search counts.",
                       "A keyword spike is not proof of SEO opportunity or organic ranking difficulty.",
                       "Only approved, distinct user intent and live SERP review may justify new content."]
    }
    version = os.getenv("GOOGLE_ADS_API_VERSION","v26").strip()
    try:
        creds,_ = google.auth.default(scopes=["https://www.googleapis.com/auth/adwords"])
        creds.refresh(Request())
        headers = {"Authorization":"Bearer "+creds.token}
        token = os.getenv("WAT_GOOGLE_ADS_DEVELOPER_TOKEN","").strip()
        if token:
            headers["developer-token"] = token
        login = re.sub(r"\D","",os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID",""))
        if login:
            headers["login-customer-id"] = login
        url = API.format(version=version, customer=customer)
        combined = {}
        for item in clusters:
            cluster = item.get("id","unknown")
            seeds = list(dict.fromkeys([*observed[:3],*(item.get("queries") or [])]))[:20]
            if not seeds:
                continue
            payload = {"language":NL,"geoTargetConstants":[BE],"keywordPlanNetwork":"GOOGLE_SEARCH",
                       "includeAdultKeywords":False,"keywordSeed":{"keywords":seeds},"pageSize":200}
            try:
                response = requests.post(url,headers=headers,json=payload,timeout=65)
                if response.status_code != 200:
                    error = safe_ads_error(response)
                    result["clusters"][cluster] = {"status":"BLOCKED","error":error,"seeds":seeds}
                    result["errors"].append({"cluster":cluster,**error})
                    continue
                rows = response.json().get("results") or []
                ideas = [parse_idea(row,cluster,seeds) for row in rows]
                screened = [x for x in ideas if x["business_fit"]!="EXCLUDE_OR_REVIEW"]
                screened.sort(key=lambda x:(x["avg_monthly_searches"] or -1),reverse=True)
                result["clusters"][cluster] = {"status":"OK","seeds":seeds,"ideas":screened[:60],
                                               "returned":len(rows),"screened":len(screened),
                                               "has_more":bool(response.json().get("nextPageToken"))}
                for x in screened:
                    key = x["keyword"].casefold()
                    if not key:
                        continue
                    if key not in combined or (x["avg_monthly_searches"] or 0)>(combined[key]["avg_monthly_searches"] or 0):
                        combined[key]=x
            except requests.RequestException as exc:
                result["clusters"][cluster] = {"status":"BLOCKED","error":type(exc).__name__}
                result["errors"].append({"cluster":cluster,"error":type(exc).__name__})
        ideas = sorted(combined.values(),key=lambda x:(x["avg_monthly_searches"] or -1),reverse=True)
        result["datasets"]["belgium"]={"ideas":ideas[:350],"count":len(ideas)}
        ok = sum(x.get("status")=="OK" for x in result["clusters"].values())
        result["status"] = "OK" if ok==len(clusters) and ok>0 else "PARTIAL" if ok else "BLOCKED"
        result["successful_clusters"] = ok
        result["attempted_clusters"] = len(clusters)
        return result
    except Exception as exc:
        result["status"]="BLOCKED"
        result["error"]=type(exc).__name__
        return result

if __name__=="__main__":
    print(json.dumps(collect_keyword_planner(),indent=2,ensure_ascii=False))
