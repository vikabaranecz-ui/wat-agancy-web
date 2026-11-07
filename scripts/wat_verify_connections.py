#!/usr/bin/env python3
"""Non-mutating WAT connection diagnostics. Never print keys, tokens or payloads."""
import json
import os
import re
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote
import requests

def result(ok=False, status="NOT_CONFIGURED", detail=None, **extra):
    return {"ok": bool(ok), "status": status, **({"detail":detail} if detail else {}), **extra}

def safe_http(response):
    return "HTTP " + str(response.status_code)

def google_credentials():
    raw = os.getenv("GOOGLE_ADC_JSON", "").strip()
    if not raw: return None, result(detail="WAT_GSC_SERVICE_ACCOUNT_JSON is missing")
    try:
        from google.oauth2 import service_account
        info = json.loads(raw)
        if info.get("type") != "service_account":
            return None, result(status="INVALID_CREDENTIAL", detail="Expected service-account JSON")
        cred = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
        return cred, result(ok=True, status="CONFIGURED", detail="Credential parsed; API access not yet tested")
    except Exception as exc:
        return None, result(status="INVALID_CREDENTIAL", detail=type(exc).__name__)

def test_gsc(credentials):
    if not credentials: return result(detail="Google credentials unavailable")
    try:
        from google.auth.transport.requests import AuthorizedSession
        site = os.getenv("GSC_SITE_URL", "sc-domain:watagencybelgium.be")
        end = date.today()-timedelta(days=3)
        body = {"startDate":str(end-timedelta(days=27)), "endDate":str(end),
                "dimensions":["query"],"rowLimit":1,"type":"web"}
        url = "https://www.googleapis.com/webmasters/v3/sites/"+quote(site,safe="")+"/searchAnalytics/query"
        response = AuthorizedSession(credentials).post(url,json=body,timeout=25)
        if response.status_code != 200:
            return result(status="FAILED", detail=safe_http(response), property=site)
        return result(ok=True,status="CONNECTED",detail="Authorized Search Analytics query succeeded",property=site,
                      returned_rows=len(response.json().get("rows", [])),
                      note="Zero rows is possible for a new/low-traffic property")
    except Exception as exc:
        return result(status="FAILED",detail=type(exc).__name__)

def test_ads():
    customer=re.sub(r"\D","",os.getenv("WAT_GOOGLE_ADS_CUSTOMER_ID",""))
    token=os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN","").strip()
    raw=os.getenv("GOOGLE_ADC_JSON","").strip()
    if not (customer and token and raw):
        return result(detail="Need WAT Google Ads customer ID, developer token and service-account credential")
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
        credentials=service_account.Credentials.from_service_account_info(
            json.loads(raw),scopes=["https://www.googleapis.com/auth/adwords"])
        credentials.refresh(Request())
        headers={"Authorization":"Bearer "+credentials.token,"developer-token":token}
        login=re.sub(r"\D","",os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID",""))
        if login:headers["login-customer-id"]=login
        api=os.getenv("GOOGLE_ADS_API_VERSION","v25")
        # One seed, one geo, one result. Minimal read-only Keyword Planner call.
        url=f"https://googleads.googleapis.com/{api}/customers/{customer}:generateKeywordIdeas"
        payload={"language":"languageConstants/1010","geoTargetConstants":["geoTargetConstants/2056"],
                 "keywordPlanNetwork":"GOOGLE_SEARCH","keywordSeed":{"keywords":["marketingbureau Antwerpen"]},
                 "pageSize":1}
        response=requests.post(url,headers=headers,json=payload,timeout=45)
        if response.status_code != 200:
            return result(status="FAILED",detail=safe_http(response),
                          hint="Check Ads account access, developer token approval, login-customer-id, API version")
        return result(ok=True,status="CONNECTED",detail="Authorized Keyword Planner API request succeeded",
                      customer_id_last4=customer[-4:],returned_ideas=len(response.json().get("results",[])))
    except Exception as exc:
        return result(status="FAILED",detail=type(exc).__name__)

def test_claude():
    key=os.getenv("ANTHROPIC_API_KEY","").strip()
    if not key: return result(detail="ANTHROPIC_API_KEY missing from WAT GitHub Actions secrets")
    try:
        headers={"x-api-key":key,"anthropic-version":"2023-06-01"}
        workspace=os.getenv("ANTHROPIC_WORKSPACE_ID","").strip()
        if workspace: headers["anthropic-workspace-id"]=workspace
        response=requests.get("https://api.anthropic.com/v1/models",
                              headers=headers,params={"limit":1},timeout=25)
        if response.status_code!=200:
            return result(status="FAILED",detail=safe_http(response),
                          hint="Check Claude API key, workspace restriction and network access")
        models=response.json().get("data",[])
        return result(ok=True,status="CONNECTED",detail="Claude Models API authentication succeeded",
                      available_model_count_sample=len(models),
                      note="Does not prove Claude Code action or skills execution; requires end-to-end test")
    except Exception as exc:
        return result(status="FAILED",detail=type(exc).__name__)

def main():
    creds,parsed=google_credentials()
    report={"scope":"WAT Agency GitHub Actions runner only","credential_parse":parsed,
            "search_console":test_gsc(creds),"google_ads_keyword_planner":test_ads(),
            "claude_api":test_claude(),
            "limitations":["No private credential values printed",
                           "Claude API authentication alone does not verify Claude Code action or skill use",
                           "No repository changes or website publishing performed"]}
    Path("wat-connection-check.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    for name in ("search_console","google_ads_keyword_planner","claude_api"):
        item=report[name]
        print(f"{name}: {item['status']} ({item.get('detail','')})")
    # Diagnostic workflow should successfully deliver report even when a service fails.
if __name__=="__main__":
    main()
