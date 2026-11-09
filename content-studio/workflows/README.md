# n8n workflows (disabled by default)

These are importable schedule and HTTP-request workflow skeletons. **Do not activate yet:** `/api/agent` intentionally returns 501 or 503 until the audited database operations and credentials exist.

Set `WAT_STUDIO_URL` to the dedicated Next.js app URL, `STUDIO_AGENT_SECRET` securely on n8n and the Next.js host, and timezone `Europe/Brussels`. Verify your n8n configuration allows `$env` variables; otherwise replace the header with an n8n Header Auth credential.

Schedules use six-field cron expressions in the n8n Schedule Trigger. Confirm your n8n version's node settings on import. W05 reconciliation is every 30 minutes. No publishing workflow is present until the approval gate is tested.
