# WAT Agency — Google Search Console indexing issue intake

**Why this exists:** The official GSC URL Inspection API can inspect a known URL, but cannot enumerate every URL listed under Search Console > Indexing > Pages. The weekly bot discovers URLs from the live sitemap, canonical list, Vercel redirects, and search-performance URLs. That is not the full excluded-URLs inventory.

## Optional input
If Search Console shows excluded pages not in those sources, export affected URL examples and save a CSV as `seo/gsc_page_indexing_export.csv` (UTF-8; a column titled `URL`, `Page`, `Pagina`, `Page URL`, or `Examples`; full absolute URLs). Do not include passwords/tokens. Only pages on `watagencybelgium.be` are read. Up to the first 500 CSV rows are ingested; the URL Inspection stage checks the first 40 discovered URLs per run. Split or rotate larger batches based on priority.

### Recommended Google Search Console workflow
1. Select property `watagencybelgium.be` > **Indexing > Pages**.
2. Open a specific reason such as **Crawled - currently not indexed**, **Discovered - currently not indexed**, **Duplicate, Google chose different canonical**, or **Blocked by robots.txt**.
3. Export the affected-URL/example list if available; verify the CSV has an absolute URL column. Combine exports with the same `URL` column into one deduplicated CSV.
4. Add the CSV to WAT GitHub through a PR for review; do not publish this file onto the public web. Keep it in the repository's `seo/` source folder only.
5. Run WAT weekly evidence collection. Every URL with a non-PASS inspection verdict must be diagnosed. A redirect/alternate canonical can be intentional; do not request indexing for duplicate URLs.

### What the bot can fix
It can prepare review PRs for actual source-level bugs: `noindex` on intended pages, blocked canonical URLs, incorrect canonicals, redirect chains, sitemap entries pointing to redirect/404, missing internal links to real pages, incorrect hreflang/language URL architecture. Google decides when/if to recrawl and index; it cannot be guaranteed.

**Never** treat "not indexed" as an automatic instruction to create indexable duplicate pages or use URL Inspection as a bulk indexing request.
