# SlotRescue AI production
Sponsored by Creignificent LLC.

## Agent Decisions
- No test login is shipped. A password in the repo would be fake access. Create the owner in Supabase Auth.
- The claim route stays on the server. The service role is never sent to the browser. Customers are not members, so the booking RPC cannot be granted to anon. Rate limit is 5 attempts per token per IP per minute in this instance. Upstash is not configured.
- Gemini drafts only from verified fields. If GEMINI_API_KEY is missing, the deterministic draft is returned and labeled.
- Free quota is 3 active waitlist rows and 50 invites per 30 days, enforced by free_quota_ok. Pro comes from a verified Stripe webhook.
- Business creation goes through create_business, which binds the owner to auth.uid().
- Stripe, Resend, and Supabase are not marked live until those env vars are set in Vercel. This deploy does not invent a sandbox charge or a delivered email.

## Local setup
1. npm install
2. Copy .env.example to .env.local and set real keys.
3. Apply supabase/migrations/001_foundation.sql from the earlier repo, then 002_hardening.sql.
4. Create the owner in Supabase Auth. Sign in at /login.
5. npm run dev. npm run build before deploy. npm test checks the one-winner lock.

## Live
Vercel project: slotrescue-ai. Production URL is behind Vercel Authentication until Deployment Protection is set to preview-only.
