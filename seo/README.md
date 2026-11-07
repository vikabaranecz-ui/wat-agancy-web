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
- Google Ads Keyword Planner: intentionally **not connected**; must verify the WAT Google Ads customer ID, developer token, account permissions, valid scope and local Belgium (nl-BE) targeting before claiming volumes. Add collector and tests in a separate reviewed PR.
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
