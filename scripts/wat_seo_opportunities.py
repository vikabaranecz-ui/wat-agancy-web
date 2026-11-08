#!/usr/bin/env python3
"""Rank only observed WAT search opportunities; never turn seed phrases into target claims."""
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path("seo-weekly-context.json")
OUT = Path("seo-weekly-opportunities.json")
BRAND = re.compile(r"\b(wat\?? agency|watagency|wat agency|viktoriiamarketing)\b", re.I)
COMMERCIAL = re.compile(r"marketing|website|webdesign|google|seo|advert|reclame|klanten|offerte|aanvragen|agency|bureau|social|bedrijf|aannemer|kmo", re.I)

def read_rows(block):
    rows = block.get("rows", []) if isinstance(block, dict) else []
    return rows if isinstance(rows, list) else []

def unpack(row, kind):
    keys = row.get("keys", [])
    if kind == "query":
        return keys[0] if len(keys) else ""
    if kind == "page":
        return keys[0] if len(keys) else ""
    if kind == "query_page":
        return (keys[0], keys[1]) if len(keys) >= 2 else ("", "")
    return ""

def metrics(row):
    return {k: row.get(k, 0) for k in ("clicks", "impressions", "ctr", "position")}

def own_url(value):
    try:
        host = (urlparse(value).hostname or "").lower()
        return host == "watagencybelgium.be" or host.endswith(".watagencybelgium.be")
    except ValueError:
        return False

def main():
    data = json.loads(ROOT.read_text(encoding="utf-8"))
    gsc = data.get("gsc", {})
    ads = data.get("keyword_planner", {})
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_status": {"gsc": gsc.get("status", "BLOCKED"), "keyword_planner": ads.get("status", "BLOCKED")},
        "evidence_windows": gsc.get("windows"),
        "rules": ["GSC query/page rows are observed performance, not proof of indexing.",
                  "Keyword Planner impressions are estimated paid-planning demand, not Google organic rankings.",
                  "No keyword becomes a target without real source plus page/intent check.",
                  "Keyword Planner paid competition is NOT organic difficulty.",
                  "Low impressions/absent queries cannot establish a content gap."],
        "opportunities": [], "technical_issues": [], "verification_needed": []
    }
    for page in data.get("site_audit", []):
        if page.get("status") is None or page.get("status", 999) >= 400:
            result["technical_issues"].append({"url": page["url"], "reason": "Page audit failed or HTTP error",
                                                 "status": page.get("status")})
        elif page.get("content_type", "").startswith("text/html"):
            if not page.get("title") or not page.get("h1"):
                result["technical_issues"].append({"url": page["url"], "reason": "Missing title or H1"})
            if not page.get("canonical"):
                result["verification_needed"].append({"url": page["url"], "reason": "No explicit canonical observed; diagnose before proposing change"})
    if gsc.get("status") != "OK":
        result["verification_needed"].append({"reason": "GSC unavailable; no ranking-based target decisions"})
    else:
        current = {unpack(row, "query"): row for row in read_rows(gsc.get("current_queries")) if unpack(row, "query")}
        previous = {unpack(row, "query"): row for row in read_rows(gsc.get("previous_queries")) if unpack(row, "query")}
        pages = defaultdict(list)
        for row in read_rows(gsc.get("current_query_pages")):
            query, page = unpack(row, "query_page")
            if query and own_url(page):
                pages[query].append({"url": page, **metrics(row)})
        for query, row in current.items():
            if BRAND.search(query) or not COMMERCIAL.search(query):
                continue
            imps = int(row.get("impressions") or 0)
            if imps < 10:  # no confident search opportunity from trivial exposure
                continue
            position = float(row.get("position") or 0)
            ctr = float(row.get("ctr") or 0)
            prior = previous.get(query, {})
            why = []
            if 5 <= position <= 20: why.append("near_win")
            if imps >= 30 and ctr < 0.02 and position <= 10: why.append("low_ctr_check_serp")
            if prior and int(prior.get("impressions") or 0) >= 20 and position >= float(prior.get("position") or 0) + 3:
                why.append("declining_position")
            targets = sorted(pages.get(query, []), key=lambda p:p.get("impressions",0), reverse=True)
            if len([p for p in targets if p.get("impressions", 0) >= 10]) > 1:
                why.append("multiple_landing_pages_check_intent")
            if not why:
                continue
            impact = imps * (2 if position <= 15 else 1)
            result["opportunities"].append({
                "query": query, "reason": why, "current": metrics(row),
                "previous": metrics(prior) if prior else None,
                "observed_pages": targets[:5],
                "priority_score_heuristic_not_rank": impact,
                "next_check": "Verify SERP intent, page health, business relevance and change hypothesis before editing"
            })
        result["opportunities"].sort(key=lambda x:x["priority_score_heuristic_not_rank"], reverse=True)
        result["opportunities"] = result["opportunities"][:45]
    # Keyword Planner is enrichment, not a standalone justification for publishing.
    ideas = {}
    for scope, info in ads.get("datasets", {}).items():
        for item in info.get("ideas", []):
            k = (item.get("keyword") or "").strip().casefold()
            if k and k not in ideas: ideas[k] = {}
            if k: ideas[k][scope] = item.get("avg_monthly_searches")
    for opportunity in result["opportunities"]:
        opportunity["keyword_planner_search_volume_estimates"] = ideas.get(opportunity["query"].casefold(), {})
    if not result["opportunities"]:
        result["verification_needed"].append({"reason": "No eligible GSC near-win/CTR/decay signal. Do not manufacture keyword targets from seeds."})
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Evidence-backed WAT opportunities:", len(result["opportunities"]), "| technical flags:", len(result["technical_issues"]))

if __name__ == "__main__":
    main()
