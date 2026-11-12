#!/usr/bin/env python3
"""Google Ads Keyword Planner evidence for WAT only; no fabricated metrics."""
import json
import os
import re
from google.auth.transport.requests import Request
import google.auth
import requests
from wat_brand import is_brand_query

def collect_keyword_planner(gsc_queries=None):
    customer_id = re.sub(r"\D", "", os.getenv("WAT_GOOGLE_ADS_CUSTOMER_ID", ""))
    if not customer_id:
        return {"status": "BLOCKED", "error": "WAT-specific Google Ads customer ID missing. No keyword volumes verified."}
    with open("seo/keyword_targets.json", encoding="utf-8") as file:
        keyword_data = json.load(file)
    seeds = []
    # Real WAT GSC search queries lead discovery whenever available.
    for row in sorted(gsc_queries or [], key=lambda x: x.get('impressions', 0), reverse=True):
        keys = row.get('keys', [])
        query = keys[0].strip() if keys and isinstance(keys[0], str) else ''
        if query and not is_brand_query(query) and query not in seeds:
            seeds.append(query)
        if len(seeds) >= 12: break
    observed_seed_count = len(seeds)
    for cluster in keyword_data.get("clusters", []):
        for query in cluster.get("queries", []):
            if query not in seeds:
                seeds.append(query)
    seeds = seeds[:20]  # Discovery seeds, NOT ranked or validated target keywords.
    if not seeds:
        return {"status": "BLOCKED", "error": "No discovery seeds available"}
    version = os.getenv("GOOGLE_ADS_API_VERSION", "v26").strip()
    try:
        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/adwords"])
        creds.refresh(Request())
        developer_token = os.getenv("WAT_GOOGLE_ADS_DEVELOPER_TOKEN", "").strip()
        # Developer tokens became optional in the Google Ads API in September 2026.
        # Production API eligibility now depends on the OAuth Google Cloud project.
        headers = {"Authorization": f"Bearer {creds.token}"}
        if developer_token:
            headers["developer-token"] = developer_token
        login_id = re.sub(r"\D", "", os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", ""))
        if login_id:
            headers["login-customer-id"] = login_id
        base = f"https://googleads.googleapis.com/{version}/customers/{customer_id}:generateKeywordIdeas"
        result = {"status": "OK", "customer_id": customer_id, "seed_type": "observed_gsc_queries_then_unvalidated_discovery_queries",
                  "observed_gsc_seed_count": observed_seed_count,
                  "geo_scope": "Belgium (Dutch language)", "datasets": {}}
        for name, geo_id in [("belgium", "2056")]:
            body = {"language": "languageConstants/1010",
                    "geoTargetConstants": [f"geoTargetConstants/{geo_id}"],
                    "keywordSeed": {"keywords": seeds},
                    "keywordPlanNetwork": "GOOGLE_SEARCH"}
            response = requests.post(base, headers=headers, json=body, timeout=65)
            if response.status_code >= 400:
                result["status"] = "PARTIAL"
                details = {}
                try:
                    error = response.json().get("error", {})
                    details = {
                        "code": error.get("code"),
                        "status": error.get("status"),
                        "reason_codes": [
                            str(k) + ":" + str(v)
                            for d in error.get("details", [])
                            for e in d.get("errors", [])
                            for k, v in (e.get("errorCode") or {}).items()
                        ][:6],
                    }
                except (ValueError, TypeError, AttributeError):
                    pass
                result["datasets"][name] = {
                    "error": f"Google Ads HTTP {response.status_code}",
                    "diagnostics": details,
                    "request_id": response.headers.get("request-id"),
                    "next_action": (
                        "Open Google Cloud Console > Google Ads API Overview; request Explorer or Basic production access"
                        if "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION" in str(details)
                        else "Check WAT Google Ads account/service-account user access, API version and Cloud project permissions"
                    ),
                }
                continue
            ideas = []
            for item in response.json().get("results", []):
                metrics = item.get("keywordIdeaMetrics") or {}
                ideas.append({"keyword": item.get("text"),
                              "avg_monthly_searches": int(metrics["avgMonthlySearches"]) if metrics.get("avgMonthlySearches") not in (None, "") else None,
                              "competition_paid": metrics.get("competition"),
                              "competition_index_paid": metrics.get("competitionIndex"),
                              "monthly_search_volumes": metrics.get("monthlySearchVolumes", [])[-12:]})
            result["datasets"][name] = {"ideas": sorted(ideas, key=lambda x: x.get("avg_monthly_searches") or 0, reverse=True)[:300],
                                        "count": len(ideas)}
        if not any(isinstance(x, dict) and "ideas" in x for x in result["datasets"].values()):
            result["status"] = "BLOCKED"
        return result
    except Exception as exc:
        return {"status": "BLOCKED", "error": type(exc).__name__,
                "hint": "Check OIDC service account, Ads customer access, Google Cloud project production access and API version. Never infer volume."}

if __name__ == "__main__":
    print(json.dumps(collect_keyword_planner(), ensure_ascii=False, indent=2))
