# Launch checklist

What the owner must do before Axiis is public. Each item is done when its check passes.

## Hosting
- [ ] Create a Vercel project from the GitHub repo, framework preset Next.js, production branch `main`.
- [ ] Set production environment variables in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key, never the service-role key) and `NEXT_PUBLIC_SITE_URL` (the final origin, such as `https://axiis.example`, no trailing path). A malformed `NEXT_PUBLIC_SITE_URL` fails the build on purpose.
- [ ] Check: the production deploy builds, and `/` shows the landing page when signed out.
- [ ] `vercel.json` pins functions to `hnd1` (Tokyo) to sit next to the Supabase project in `ap-northeast-1`. Change it if the project is in another region.

## Security headers
- [ ] Check: `curl -sI https://<domain>/` shows a `content-security-policy` with `script-src 'self' 'nonce-...' 'strict-dynamic'`, and a different nonce on each request.
- [ ] Check: the landing, login and a signed-in page load with no `Content Security Policy` errors in the browser console. Add any new third-party script or image host to `src/lib/csp.ts` first.

## Domain
- [ ] Buy or choose the domain, add it in Vercel (Project, Settings, Domains) and set the DNS records Vercel shows.
- [ ] Redirect the `www` variant (or the apex) to the one canonical origin, and make that origin match `NEXT_PUBLIC_SITE_URL`.
- [ ] Check: `https://<domain>/robots.txt` and `/sitemap.xml` list absolute URLs on that domain, not `localhost`.

## Supabase (production)
- [ ] Authentication, URL Configuration: set Site URL to the production origin.
- [ ] Add the redirect URL `https://<domain>/auth/callback`. See "Supabase Auth hardening" for what else the allowlist may hold.
- [ ] Authentication, Emails: set the sender name, and configure custom SMTP (see "Supabase Auth hardening").
- [ ] Apply `supabase/migrations/0006_quotas.sql` (and any later file) to the production project with `apply_migration`, after review. First check that no note body breaks the new 512 KB cap: `select id from items where pg_column_size(body) > 524288` must return no rows. Then check that no account already sits over a cap, since its next save would be refused: `select user_id, count(*) from items group by 1 order by 2 desc limit 1` (and the same for `links`, `tags`, `areas`).
- [ ] Run `get_advisors` (security and performance) on the production project and clear every warning.
- [ ] Check: a magic link sent from the production site signs in and lands on `/today`.

## Supabase Auth hardening
Signup is open, so anyone can make Supabase send email and write rows. The database caps rows per account (`docs/data-model.md`, Quotas); these settings cover the rest.
- [ ] CAPTCHA: Authentication, Attack Protection, enable Cloudflare Turnstile for sign-in and signup. The login form must then send the token; that is a code change to request before turning it on, or every sign-in fails.
- [ ] Custom SMTP (Authentication, Emails, SMTP Settings) from a provider such as Resend or Postmark, on the production domain. Publish SPF, DKIM and a DMARC record (`p=quarantine` or stricter) for the sending domain. The built-in sender is rate-limited and not meant for production. Check: a magic link arrives in Gmail's inbox, and "Show original" shows SPF, DKIM and DMARC all `PASS`.
- [ ] Redirect allowlist (Authentication, URL Configuration) holds only `https://<domain>/auth/callback` and, if this project is also the dev one, `http://localhost:3000/auth/callback`. No wildcards: a pattern such as `https://*.vercel.app/**` lets anyone's Vercel deployment receive a sign-in token. Use a separate Supabase project for preview deployments if they need to sign in.
- [ ] JWT signing keys (Project Settings, JWT Keys): migrate to asymmetric keys (ES256 or RS256), then revoke the legacy shared secret once nothing uses it.
- [ ] PostgREST max rows (Project Settings, Data API): keep Max Rows at 1000 (the default) or lower, so one request cannot pull an unbounded reply. The export and the tag counts page until an empty page, so a lower cap does not cut them short.
- [ ] Backups: move to Supabase Pro (daily backups, point-in-time recovery as an add-on) before the first real user. Check on the Database, Backups page that a backup is listed and restorable, since the free plan does not offer one.
- [ ] Rate limits: add Vercel WAF rate-limit rules (Project, Firewall) on `POST /login` and `/auth/*`, for example 10 requests a minute per IP. The app has no rate limiting of its own, and an in-process counter would not work: Vercel runs many short-lived function instances that share no memory, so each would count separately and forget on a cold start. If a limit must live in code (per account rather than per IP), keep the counter in a shared store such as Upstash Redis (`@upstash/ratelimit`).
- [ ] Check: `curl -sI https://<domain>/login | grep -ci '^content-security-policy:'` prints `1`. Two headers would mean a second source (a Vercel header rule or `next.config.ts`) is back; `src/proxy.ts` must be the only one.

## Google sign-in
- [ ] In Google Cloud Console create an OAuth client (Web application). Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. Authorised JavaScript origin: the production origin.
- [ ] Fill the OAuth consent screen: app name Axiis, support email, links to `https://<domain>/privacy` and `https://<domain>/terms`, scopes `email`, `profile`, `openid` only. Publish it (move out of Testing).
- [ ] Paste the client ID and secret into Supabase, Authentication, Providers, Google, and enable it.
- [ ] Check: "Continue with Google" on `/login` signs in from the production site.

## Legal pages
- [ ] Fill every highlighted blank on `/privacy` and `/terms` (`src/app/privacy/page.tsx`, `src/app/terms/page.tsx`): operator name, country or jurisdiction, contact email, effective date, data region, hosting provider, response time, minimum age, notice period, governing law. `grep -n "<Blank>" src/app/privacy/page.tsx src/app/terms/page.tsx` must return nothing when done.
- [ ] Have the owner, and ideally a lawyer for the operator's jurisdiction, read both drafts in full and correct anything that does not match how Axiis is actually run.
- [ ] Remove the "Draft" note in `src/components/public/legal.tsx` once both are reviewed.
- [ ] Ship data export and account deletion in settings, then update the "coming" sentences on both pages and on the landing page.

## Support and recovery
- [ ] A support email address that someone reads, on the production domain (for example `support@<domain>`). The quota message tells users to "write to support", and the privacy policy and terms need a contact.
- [ ] A written recovery policy for someone who lost access to their email. Axiis signs in only by email link or Google, so whoever controls the address controls the account. Decide what proof, if any, moves an account to a new address, or say plainly that it cannot be done; put the answer in the terms.
- [ ] Decide on an undo window for account deletion. Today `delete_my_account` removes everything at once and nothing can bring it back. Either keep that and say so on the deletion screen and in the privacy policy, or build a grace period (mark the account, purge after N days) before launch.
- [ ] Decide what support does when an account reaches a quota (`docs/data-model.md`, Quotas): purge its old soft-deleted rows, or raise the cap for it.

## Final pass
- [ ] Open the landing, privacy and terms pages on a phone and a desktop, in light and dark.
- [ ] Install the app from the browser (PWA) and confirm it opens to `/today`.
- [ ] Confirm no page shows a `[placeholder]` and no link points at `localhost`.
