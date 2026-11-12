# WAT Agency — weekly growth portfolio (WAT-specific overlay)

Read this after `.claude/agents/weekly-seo.md`. The evidence, approval and no-invented-data safeguards in the base policy ALWAYS take precedence.

## Outcome
WAT sells measurable customer acquisition and conversion systems to Dutch-speaking Belgian service SMEs. The north-star is **qualified enquiries/consultations**, not posting volume, impressions or a speculative count of page-one phrases. Start with Antwerp/Flanders where actual SERP evidence supports it; expand across Dutch-speaking Belgium when supported by verified demand.

## Weekly operating contract, adapted from ISOPROTECH and Reno Rangers
1. **Health first** — inspect Google URL Inspection for each canonical URL sampled, plus live HTTP, robots, sitemap, canonical, language indexability, mobile/contact paths. Distinguish `not indexed`, `blocked`, `redirect`, `Google chose alternate canonical`, API unavailable, and no impressions. Fix real eligibility blockers ahead of content growth. Do not assume a page is indexed because it is in the sitemap.
2. **Complete commercial scoreboard** — review every seed cluster in `seo/keyword_targets.json` (not just one or two keywords), all observed commercial GSC query+URL rows, the preceding 28 days, and 90-day evidence. Keep a stable 25-query strategic watchlist only when queries are validated by GSC or live Keyword Planner and an actual intended URL; otherwise report `UNVALIDATED`, never assign zero positions.
3. **Three to five intent clusters** when evidence justifies them. Do not spend a whole sprint on trivial metadata if the site has a larger structural blocker. With sparse GSC data, work technical eligibility, validated market demand and approval-ready language architecture rather than fictional near-wins.
4. **One clear execution decision per cluster**: issue diagnosis → smallest useful fix → QA → PR or decision request → observation checkpoint (28+ days after deployment). Avoid recycling the same URL during an open measurement window.
5. **No silent publishing on WAT** during onboarding. Safe technical and content improvements are submitted as draft PRs with exact before/after, test evidence and rollout/rollback. New URLs, language/root redirects, proof, claims and pricing ALWAYS need owner review; no auto-merges.
6. **A completed weekly run requires a GitHub issue** even if data are missing or nothing should change. Explicitly report RUN FAILED/BLOCKED if the workflow/Google API failed. Telegram must never imply a site deployment occurred unless there is a verified merged commit.

## WAT search demand portfolios — distinct from construction SEO

Score opportunities by: commercial buyer intent (30%), observable local search/competitor evidence (25%), ability to generate qualified consultation (20%), WAT expertise and proof (15%), AI-answerability (10%). Do not fabricate numeric scores where input is unknown.

- **Hire a provider**: marketingbureau Antwerpen, marketingbureau voor kmo, lokale SEO bureau, website laten maken voor aannemers, Google Bedrijfsprofiel beheer, Google Ads specialist voor lokale diensten.
- **High-cost business pains**: weinig kwalitatieve aanvragen, lege agenda voor vakmannen, veel offertes maar weinig klanten, reclame kost geld zonder klanten, te afhankelijk van mond-tot-mondreclame, klanten die alleen op prijs vergelijken.
- **Buying questions and comparisons**: wat kost marketing voor een klein bedrijf, SEO of Google Ads voor aannemers, wat kost een website die aanvragen oplevert, hoe meet ik of reclame klanten oplevert, hoe kom ik als schoonmaakbedrijf aan opdrachten.
- **Trust and sector proof**: real (approved) WAT examples in renovation, cleaning, landscaping, garages, barber/beauty, logistics. Do not claim clients or results not independently verified.
- **AI search discovery**: precise answerable Dutch FAQs, comparative guidance, named authorship/company identity, genuine case method/results, eligible and indexable source URLs. Citation-rate sampling is a separate experimental metric. Do not claim or guarantee AI recommendations.

## Required weekly report layout
- `Data access`: GSC, URL Inspection, Google Ads Keyword Planner (Belgium/Dutch plus narrower geography when warranted), Google tag/GA4 verified or not, and test limits.
- `Indexing and website health`: every inspected canonical, Google's verdict, blocker, owner action, when to re-inspect; distinguish expected redirects/intentional exclusions.
- `25-query watchlist`: explicit validated vs unvalidated count, impressions and observed position only where GSC supports.
- `WAT growth sprint`: 3–5 evidence-backed clusters where justified; why each is commercially relevant, target existing URL or confirmed gap, CTA, expected value, review PR, and next measurement date.
- `Commercial and AI search questions`: validated source, whether an existing Dutch answer is accessible, top 2–4 publication candidates (approval only).
- `Execution`: exact files changed, tests actually run, PR state, deployment status (unmerged does NOT equal deployed), blockers and next 1–3 actions.
- `Коротко українською`: factual summary with `Виконано`, `Заблоковано`, `Потрібно від мене`, and links.

## Non-negotiable QA
- Check sitemap ↔ intended canonical URLs, HTTP 200, no accidental noindex, self canonical, correct language and hreflang if separate language URLs are proposed, internal-link targets and contact CTAs.
- Respect `PR #7` until merged/closed and all approved copy; do not overwrite consent/tag changes.
- Never alter GTM/Ads conversion tracking as a side-effect of SEO; real consent and GA4 DebugView testing first.
- Unavailable Keyword Planner means **technical/GSC research can continue** but volumes are `null`; paid competition is not organic difficulty.
- No low-value city/sector doorway pages or generic bulk AI articles.
