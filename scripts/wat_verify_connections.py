#!/usr/bin/env python3
"""Read-only WAT connection diagnostics for GitHub Actions.

Each service is reported as CONNECTED, FAILED or NOT_CONFIGURED.
Never prints keys, tokens, credential JSON or request payloads: only HTTP codes,
Google/Anthropic error codes and a masked service-account identity.
Exits 1 when any required connection is not CONNECTED, so a green job means real access.
"""
import json
import os
import re
import sys
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote

import requests

CONNECTED, FAILED, NOT_CONFIGURED = "CONNECTED", "FAILED", "NOT_CONFIGURED"
REQUIRED = ("claude_api", "search_console", "google_ads_keyword_planner")
LABELS = {"claude_api": "Claude API", "search_console": "WAT Search Console",
          "google_ads_keyword_planner": "WAT Google Ads Keyword Planner"}


def result(status, detail, **extra):
    return {"status": status, "detail": detail, **extra}


def scrub(text, limit=180):
    """Remove anything that could be identifying or secret-like from provider error text."""
    text = re.sub(r"\b\d{6,}\b", "<id>", str(text or ""))
    text = re.sub(r"[A-Za-z0-9_\-]{32,}", "<redacted>", text)
    return text.replace("\n", " ")[:limit]


def google_error(response):
    """Extract Google's machine-readable error codes (status, reason, Ads errorCode)."""
    out = {"http": response.status_code}
    try:
        err = response.json().get("error", {})
        out["status"] = err.get("status")
        out["message"] = scrub(err.get("message"))
        codes = []
        for d in err.get("details", []) or []:
            if d.get("reason"):
                codes.append(d["reason"])
            for e in d.get("errors", []) or []:
                codes.extend(f"{k}:{v}" for k, v in (e.get("errorCode") or {}).items())
        if codes:
            out["codes"] = sorted(set(codes))[:6]
    except ValueError:
        out["message"] = "non-JSON response"
    return out


def masked_identity(info):
    email = info.get("client_email", "")
    if "@" not in email:
        return None
    local, domain = email.split("@", 1)
    return local[:3] + "***@" + domain


def load_service_account():
    raw = os.getenv("GOOGLE_ADC_JSON", "").strip()
    if not raw:
        return None, result(NOT_CONFIGURED, "No WAT_GSC_SERVICE_ACCOUNT_JSON or GOOGLE_ADC_JSON secret available to this job")
    try:
        info = json.loads(raw)
    except ValueError:
        return None, result(FAILED, "Google credential secret is not valid JSON")
    if info.get("type") != "service_account":
        return None, result(FAILED, f"Google credential type is '{info.get('type')}', expected 'service_account'")
    return info, result(CONNECTED, "Service-account JSON parsed (not an API test)", identity=masked_identity(info))


def test_claude():
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not key:
        return result(NOT_CONFIGURED, "ANTHROPIC_API_KEY secret not available to this job")
    headers = {"x-api-key": key, "anthropic-version": "2023-06-01"}
    try:
        r = requests.get("https://api.anthropic.com/v1/models", headers=headers, params={"limit": 100}, timeout=25)
        if r.status_code != 200:
            return result(FAILED, f"Models API HTTP {r.status_code}", error_type=_anthropic_error(r))
        models = [m.get("id", "") for m in r.json().get("data", [])]
        # A 1-token message proves the key can actually generate (billing/credit/rate limits),
        # which the weekly Claude Code run depends on. Prefer the cheapest listed model.
        model = next((m for m in models if "haiku" in m), models[0] if models else None)
        if not model:
            return result(FAILED, "Key authenticated but no models are available")
        m = requests.post("https://api.anthropic.com/v1/messages", headers=headers, timeout=40,
                          json={"model": model, "max_tokens": 1, "messages": [{"role": "user", "content": "ok"}]})
        if m.status_code != 200:
            return result(FAILED, f"Authenticated, but Messages API HTTP {m.status_code}",
                          error_type=_anthropic_error(m), model_tested=model)
        return result(CONNECTED, "Models list + 1-token Messages call succeeded", model_tested=model,
                      models_visible=len(models))
    except requests.RequestException as exc:
        return result(FAILED, f"Network error: {type(exc).__name__}")


def _anthropic_error(response):
    try:
        err = response.json().get("error", {})
        return {"type": err.get("type"), "message": scrub(err.get("message"))}
    except ValueError:
        return {"type": "non-JSON response"}


def credential_problem(parsed):
    """FAILED when a credential exists but is unusable, NOT_CONFIGURED when absent."""
    return result(parsed["status"], parsed["detail"])


def test_gsc(info, parsed):
    if not info:
        return credential_problem(parsed)
    site = os.getenv("GSC_SITE_URL", "sc-domain:watagencybelgium.be")
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import AuthorizedSession
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
        session = AuthorizedSession(creds)
        listed = session.get("https://www.googleapis.com/webmasters/v3/sites", timeout=25)
        if listed.status_code != 200:
            return result(FAILED, "Could not list Search Console properties", property=site, error=google_error(listed))
        entries = listed.json().get("siteEntry", [])
        visible = [e.get("siteUrl") for e in entries]
        wat_visible = [s for s in visible if "watagencybelgium" in (s or "")]
        end = date.today() - timedelta(days=3)
        body = {"startDate": str(end - timedelta(days=27)), "endDate": str(end),
                "dimensions": ["query"], "rowLimit": 5, "type": "web"}
        r = session.post("https://www.googleapis.com/webmasters/v3/sites/" + quote(site, safe="") + "/searchAnalytics/query",
                         json=body, timeout=25)
        if r.status_code != 200:
            return result(FAILED, "Search Analytics query refused", property=site, error=google_error(r),
                          properties_visible_to_service_account=len(visible), wat_properties_visible=wat_visible)
        rows = r.json().get("rows", [])
        return result(CONNECTED, "Search Analytics query for WAT succeeded", property=site,
                      window=[body["startDate"], body["endDate"]], returned_rows=len(rows),
                      clicks_in_sample=sum(x.get("clicks", 0) for x in rows),
                      impressions_in_sample=sum(x.get("impressions", 0) for x in rows),
                      note="Zero rows = authenticated but no search data in window, not a baseline")
    except Exception as exc:  # noqa: BLE001 - report class only, never the message
        return result(FAILED, f"{type(exc).__name__} while calling Search Console")


def test_ads(info, parsed):
    customer = re.sub(r"\D", "", os.getenv("WAT_GOOGLE_ADS_CUSTOMER_ID", ""))
    token = os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN", "").strip()
    missing = [n for n, v in [("WAT_GOOGLE_ADS_CUSTOMER_ID", customer),
                              ("developer token", token), ("Google service account", info)] if not v]
    if not info and parsed["status"] == FAILED:
        return credential_problem(parsed)
    if missing:
        return result(NOT_CONFIGURED, "Missing: " + ", ".join(missing))
    api = os.getenv("GOOGLE_ADS_API_VERSION", "v25")
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
        creds = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/adwords"])
        creds.refresh(Request())
        headers = {"Authorization": "Bearer " + creds.token, "developer-token": token}
        login = re.sub(r"\D", "", os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", ""))
        if login:
            headers["login-customer-id"] = login
        acc = requests.get(f"https://googleads.googleapis.com/{api}/customers:listAccessibleCustomers",
                           headers=headers, timeout=30)
        accessible = None
        if acc.status_code == 200:
            ids = [x.rsplit("/", 1)[-1] for x in acc.json().get("resourceNames", [])]
            accessible = {"count": len(ids), "wat_customer_directly_accessible": customer in ids}
        else:
            return result(FAILED, "Service account is not usable for Google Ads", error=google_error(acc),
                          login_customer_id_set=bool(login), api_version=api)
        payload = {"language": "languageConstants/1010", "geoTargetConstants": ["geoTargetConstants/2056"],
                   "keywordPlanNetwork": "GOOGLE_SEARCH",
                   "keywordSeed": {"keywords": ["marketingbureau Antwerpen"]}, "pageSize": 5}
        r = requests.post(f"https://googleads.googleapis.com/{api}/customers/{customer}:generateKeywordIdeas",
                          headers=headers, json=payload, timeout=45)
        if r.status_code != 200:
            return result(FAILED, "Keyword Planner request refused", error=google_error(r),
                          accessible_customers=accessible, login_customer_id_set=bool(login),
                          customer_id_last4=customer[-4:], api_version=api)
        ideas = r.json().get("results", [])
        return result(CONNECTED, "Keyword Planner returned ideas for WAT customer", customer_id_last4=customer[-4:],
                      returned_ideas=len(ideas), ideas_with_volume=sum(
                          1 for i in ideas if (i.get("keywordIdeaMetrics") or {}).get("avgMonthlySearches")),
                      accessible_customers=accessible, api_version=api, geo="Belgium", language="Dutch")
    except Exception as exc:  # noqa: BLE001
        return result(FAILED, f"{type(exc).__name__} while calling Google Ads")


def annotate(name, item):
    level = "notice" if item["status"] == CONNECTED else "error"
    extra = item.get("error") or item.get("error_type") or ""
    msg = f"{item['status']} - {item['detail']}" + (f" | {json.dumps(extra)}" if extra else "")
    msg = msg.replace("%", "%25").replace("\n", " ")
    print(f"::{level} title={LABELS[name]}::{msg}")


def main():
    info, parsed = load_service_account()
    report = {"scope": "WAT Agency GitHub Actions runner only",
              "secrets_present": json.loads(os.getenv("WAT_SECRET_PRESENCE", "{}") or "{}"),
              "google_credential": parsed,
              "claude_api": test_claude(),
              "search_console": test_gsc(info, parsed),
              "google_ads_keyword_planner": test_ads(info, parsed),
              "limitations": ["No credential values printed",
                              "Claude API access does not by itself prove the Claude Code weekly run works",
                              "No repository, Ads account or website changes are made"]}
    report["all_connected"] = all(report[n]["status"] == CONNECTED for n in REQUIRED)
    Path("wat-connection-check.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    summary = ["| Service | Result | Detail |", "|---|---|---|"]
    for name in REQUIRED:
        item = report[name]
        annotate(name, item)
        summary.append(f"| {LABELS[name]} | {item['status']} | {item['detail']} |")
        print(f"{LABELS[name]}: {item['status']} ({item['detail']})")
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as fh:
            fh.write("## WAT connection check\n\n" + "\n".join(summary) + "\n")
    sys.exit(0 if report["all_connected"] else 1)


if __name__ == "__main__":
    main()
