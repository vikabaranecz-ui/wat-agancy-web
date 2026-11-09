# WAT AI Content Studio

An original Next.js prototype with WAT's own design language and eight carefully written Flemish editorial concepts. Features: interactive dashboard, content library, original 4:5 editorial layouts, carousel editor, channel-specific captions, PNG export, planning calendar, brand rules and guarded API boundaries.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. You may edit and export the eight starter posts. Local preview decisions are **not publication authorisation**; they are stored only in the browser.

## Integration readiness

Copy `.env.example` to `.env.local` and add secrets *locally or in your hosting provider*, never in Git. `/api/health` reports which integrations are configured. `/api/ideas` supports OpenAI's structured Responses API once `OPENAI_API_KEY`, Supabase Auth URL, publishable key, and an allowed user ID are all configured. The frontend does not yet request a Supabase session; this route deliberately remains locked until authentication is built.

`/api/agent` is a locked interface for future n8n scheduling. It performs no production action until persistent, transactional and auditable operations exist. `/api/publish` rejects all requests until a secure, immutable-revision approval and Buffer integration is verified. Do not bypass these gates.

## Next production milestones

1. Dedicated Supabase project (separate from your existing reporting/renovation project). Apply `docs/schema.sql` with a safe migration and RLS tests.
2. Supabase Auth owner login and authenticated persistence, including exact approval revisions.
3. OpenAI topic research with source evidence, idea scoring and content generation job queue; model usage limits.
4. Real media asset rendering/storage and immutable exported assets.
5. Import n8n workflow stubs and implement audited database-backed actions.
6. Buffer channel connection, durable hosted media, manual publishing permission gate, send dedupe and reconciliation.
7. GA4 and social analytics connections; first eight-post pilot.

## Demo caveat

The eight starter concepts are original example posts, not outcomes of automated live research. No social accounts have been connected, no posts have been sent, and no performance measurements are claimed. The prototype is not the fully autonomous production system yet.
