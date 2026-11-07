# WAT Agency — Weekly SEO Growth System

This is a **dedicated WAT Agency** SEO system. It does not depend on or change ISOPROTECH and Reno Rangers.

## Current state
- Implementation is in a pull request. No live schedule or data access is claimed.
- `.github/workflows/wat-weekly-seo-claude.yml` contains a Monday 08:00 Europe/Brussels schedule, but scheduled execution is disabled until repository variable `WAT_SEO_AUTOMATION_ENABLED=true`.
- A manual `workflow_dispatch` runs even while disabled to test the collector.
- The collector analyses public WAT pages and tries GSC if a WAT service-account key is provided. If unavailable, it produces an honest BLOCKED report rather than paying for AI to guess rankings.
- Claude uses the WAT-specific business profile, unvalidated keyword hypotheses and growth strategy; it must prioritize evidence-backed gaps, leading rankings and qualified commercial enquiries. It may propose PRs, but cannot auto-merge.
- The workflow can discover local skills present on the GitHub runner; personal Claude-account skills are not automatically present when using `ANTHROPIC_API_KEY`.

## One-time configuration required before enabling Monday runs
1. In Google Search Console, verify the WAT property (likely `sc-domain:watagencybelgium.be`) and grant **restricted read access** to the service account used by WAT.
2. In this repository's Actions secrets, set `WAT_GSC_SERVICE_ACCOUNT_JSON` to the authorized JSON credential. Do not commit credentials to code or issues.
3. Set `ANTHROPIC_API_KEY` (GitHub Actions secret). Enforce the project's spend limits externally.
4. Verify repository Actions permissions allow issues/PR writes for `GITHUB_TOKEN`. No production deployment credentials required.
5. Optionally set `WAT_TELEGRAM_BOT_TOKEN` and `WAT_TELEGRAM_CHAT_ID` (WAT-specific, not another client's routing).
6. Manually dispatch workflow. Inspect GSC evidence artifact, SEO Weekly issue, AI analysis, PR gate and notification. A successful run requires actual data and reports—mere status success is not evidence of working SEO analysis.
7. Set Actions variable `WAT_SEO_AUTOMATION_ENABLED=true` **only after** manual end-to-end verification.

## Pending integrations
- Google Ads Keyword Planner: **collector now implemented** for WAT Belgium and Antwerp province using its own Ads account; **NOT authenticated or run successfully yet**. Verify the WAT Ads customer ID, developer token, OAuth/service-account access, local targeting and API version before claiming volumes.
- GA4: tracking is being revised in separate PR #7. Until DebugView is verified in production, contact clicks are proxies and no qualified-lead conversion number is available.
- Competitor research: require dated search evidence; never present inferred competitors, ranking positions or AI mentions as verified.
- Never merge SEO PRs automatically; review first, especially alongside ongoing contact/tracking work.

## Initial keyword and gap plan
See `seo/keyword_targets.json`. These are hypotheses. First run must confirm actual rankings, demand, relevant intent and real pages. Prioritize:
- Commercial agency and location intent
- Contractor/cleaning/gardening/garage/barber/logistics sector demand
- Website conversion, Google Business Profile and local SEO services
- Buyer questions with useful, source-grounded answers
- Technical health, indexability, internal authority and contact pathways

The north-star KPI is **qualified WAT enquiries**, not arbitrary post counts or unverified Top-5 targets.

## Verified keyword research and evidence gate
WAT keyword-target JSON contains *discovery seeds only*. They are NOT validated local search volume or existing Google ranking targets. An SEO change requires authentic WAT GSC queries+pages for 28d vs previous 28d, plus Keyword Planner ideas for Belgium and Antwerp province from the WAT Ads account. The weekly run requires authenticated GSC and Claude. If Keyword Planner is temporarily unavailable, continue using real GSC and site health evidence while explicitly marking volumes unavailable; website health audit also runs. If GSC fails, report BLOCKED. Configure `WAT_GOOGLE_ADS_CUSTOMER_ID` as an Actions variable and `WAT_GOOGLE_ADS_DEVELOPER_TOKEN` as a secret. If accessing via manager account, configure `WAT_GOOGLE_ADS_LOGIN_CUSTOMER_ID` as a variable. API access and valid account authorization are required; credentials for ISOPROTECH and Reno Rangers must not be assumed to authorize WAT. `GOOGLE_ADS_API_VERSION` is pinned in the workflow and should be reviewed on API deprecation. No Ads values or search positions have yet been independently verified.

## Proven project parity
The earlier ISOPROTECH/Reno setup used Monday 08:00 scheduling, GSC + Keyword Planner + site audit, duplicate-run checks, explicit no-action/monitor/safe-fix/approval decision paths, PR QA, and Telegram owner reporting. WAT now adopts GSC-first fallback and duplicate-run checks. Existing WAT approval stays stricter: safe edits are PRs only until separately approved; do not claim Telegram interactive approval buttons exist without an authenticated and tested WAT-specific callback service.

## Keyword intelligence (not a guessed target plan)
- `scripts/wat_seo_weekly_collect.py` fetches actual WAT GSC query/page data before using Google Ads Keyword Planner. The Ads collector first takes observed non-branded GSC queries and supplements them with research seeds; the seed file remains explicitly unvalidated.
- `scripts/wat_seo_opportunities.py` builds `seo-weekly-opportunities.json` from observed WAT GSC query, page, impressions, CTR and positions. A shortlist is generated for real near-wins (positions 5–20), weak CTR, declining positions, or queries mapped to multiple landing pages. These are **diagnostic candidates** and still need SERP intent and health verification before edits.
- Keyword Planner local Antwerp + Belgium results annotate queries with planning demand estimates when API credentials succeed. No guessed volume, no conflation of paid competition and organic difficulty. No automatic publication from keyword ideas alone.

## Genuine Claude skill inventory
- `scripts/wat_claude_skill_inventory.py` lists readable `SKILL.md` manifests in the WAT project and in directories actually present in the GitHub Actions runner, producing `seo-weekly-skills.json`.
- The weekly Claude agent must inspect that real inventory, read the content of useful trusted skills, and distinguish discovered/loaded/executed/validated. Zero accessible skills means **zero used**—not an invitation to invent them.
- Skills present only in the owner's Claude web account are **not automatically accessible** to this API-key-authenticated runner. A separate approved synchronization/install mechanism is required before claiming they can run every Monday. No arbitrary web installation.

**Verification status:** these additions are committed in the draft PR only. Runner results, actual discovered skills, GSC and Keyword Planner API access, and weekly execution have not yet been demonstrated.
