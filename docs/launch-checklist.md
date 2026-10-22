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
- [ ] Apply `supabase/migrations/0007_rate_limits.sql` after 0006, after review. It needs no data check: it adds four `(user_id, created_at)` indexes, a trigger that stamps `created_at` on insert and keeps it on update, and the per-minute limits. Check after: `select tgname from pg_trigger where tgname like '%\_rate' or tgname like '%pin_created_at'` lists eight triggers, and capturing one item in the app still works. A support script that must insert many rows for one account, or set `created_at`, runs with `set local session_replication_role = replica` in its transaction.
- [ ] Run `get_advisors` (security and performance) on the production project and clear every warning.
- [ ] Check: a magic link sent from the production site signs in and lands on `/today`.

## Supabase Auth hardening
Signup is open, so anyone can make Supabase send email and write rows. The database caps rows per account (`docs/data-model.md`, Quotas); these settings cover the rest.
- [ ] CAPTCHA: Cloudflare Turnstile on email sign-in. See "Turnstile CAPTCHA" below for the order.
- [ ] Custom SMTP (Authentication, Emails, SMTP Settings) from a provider such as Resend or Postmark, on the production domain. Publish SPF, DKIM and a DMARC record (`p=quarantine` or stricter) for the sending domain. The built-in sender is rate-limited and not meant for production. Check: a magic link arrives in Gmail's inbox, and "Show original" shows SPF, DKIM and DMARC all `PASS`.
- [ ] Redirect allowlist (Authentication, URL Configuration) holds only `https://<domain>/auth/callback` and, if this project is also the dev one, `http://localhost:3000/auth/callback`. No wildcards: a pattern such as `https://*.vercel.app/**` lets anyone's Vercel deployment receive a sign-in token. Use a separate Supabase project for preview deployments if they need to sign in.
- [ ] JWT signing keys (Project Settings, JWT Keys): migrate to asymmetric keys (ES256 or RS256), then revoke the legacy shared secret once nothing uses it.
- [ ] PostgREST max rows (Project Settings, Data API): keep Max Rows at 1000 (the default) or lower, so one request cannot pull an unbounded reply. The export and the tag counts page until an empty page, so a lower cap does not cut them short.
- [ ] Backups: move to Supabase Pro (daily backups, point-in-time recovery as an add-on) before the first real user. Check on the Database, Backups page that a backup is listed and restorable, since the free plan does not offer one.
- [ ] Rate limits. See "Rate limits" below.
- [ ] Check: `curl -sI https://<domain>/login | grep -ci '^content-security-policy:'` prints `1`. Two headers would mean a second source (a Vercel header rule or `next.config.ts`) is back; `src/proxy.ts` must be the only one.

## Turnstile CAPTCHA
The code is in place and off. With `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset the login page loads nothing from Cloudflare and sends no token. With it set, `/login` loads Turnstile's script (with the request's nonce), its policy opens `https://challenges.cloudflare.com` to `script-src`, `frame-src` and `connect-src` (`src/lib/csp.ts`, `/login` only), and the email form sends the token as `options.captchaToken`. "Continue with Google" is not affected: Supabase does not check a CAPTCHA on OAuth.

Do these in this order. Turning Supabase's check on before the site sends tokens makes every email sign-in fail with "The check that you are a person did not pass".
1. [ ] Cloudflare dashboard, Turnstile, Add widget. Name `Axiis`, hostnames: the production domain (add `localhost` only if you want to try it in `next dev`). Widget mode: Managed. Copy the site key and the secret key. The secret key goes only into Supabase, never into Vercel or the repo.
2. [ ] Vercel, Project, Settings, Environment Variables: add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the site key, for Production only. It is read at build time, so redeploy (Deployments, the latest, Redeploy, without the build cache).
3. [ ] Check: on `https://<domain>/login`, the browser console shows no CSP errors, and `curl -sI https://<domain>/login | grep -i content-security-policy` contains `frame-src 'self' https://challenges.cloudflare.com`. A magic link still arrives (Supabase ignores the token while its check is off).
4. [ ] Supabase, Authentication, Attack Protection: turn on "Enable Captcha protection", provider Cloudflare Turnstile, paste the secret key, Save.
5. [ ] Check: a magic link from the production site still arrives and signs in. Then in a private window, block `challenges.cloudflare.com` (devtools, Network, Block request domain) and send a link: the form says the check has not finished, and no email is sent.

To turn it off, reverse the order: Supabase's check off first, then remove the Vercel variable and redeploy.

## Rate limits
What the code already bounds: migration `0007_rate_limits` caps how fast an account adds rows (120 items, 120 links, 60 tags, 30 areas a minute), `0006_quotas` caps how many it holds, and the login form waits 30 seconds between sign-in emails from one browser (a cookie, so a script can skip it). Nothing in the code limits requests per IP. An in-process counter would not work: Vercel runs many short-lived function instances that share no memory. Per-IP limits belong in the Vercel firewall and in Supabase Auth.

- [ ] Vercel Firewall (Project, Firewall, Configure, New Rule, action "Rate Limit", key "IP Address", over the limit "Deny" with 429). Check that the plan includes rate-limit rules and the window lengths it allows; if it allows fewer rules than this, keep 1 and 2.
  1. Sign-in. If Request Path equals `/login` and Method equals `POST`: 10 requests per 60 seconds. The email and Google buttons are server actions that POST to `/login`.
  2. Auth routes. If Request Path starts with `/auth/`: 30 requests per 60 seconds. Covers the magic-link and Google callback and sign-out.
  3. Export. If Request Path equals `/settings/export`: 5 requests per 10 minutes. One export reads every row the account has in pages of 1,000: a few for a typical account, a few hundred at the quotas (item_tags alone can reach 400,000 rows).
  4. Every server action. If Header `next-action` exists: 300 requests per 60 seconds. Edits that only update rows (rename, move, tick done, note saves) have no database rate limit, so this is their bound.
- [ ] Check: `for i in $(seq 1 12); do curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<domain>/login; done` ends in `429`s.
- [ ] Supabase Auth limits (Authentication, Rate Limits). The values to set:
  - Emails sent per hour, for the whole project: 30 at launch with custom SMTP, raised as signups grow. This is the bound on what the email sender can be made to send.
  - Sign-ups and sign-ins per 5 minutes per IP: 150. Token verifications per 5 minutes per IP: 150. Token refreshes per 5 minutes per IP: 600.
  - Why higher than the defaults: Axiis calls Supabase Auth from Vercel functions (`signInWithOtp`, `exchangeCodeForSession`, and session refresh in `src/proxy.ts`), not from the browser. Supabase then probably counts every user against the few Vercel addresses in `hnd1`, so a per-IP limit is shared by everyone. This is inferred, not measured. After launch, look in Authentication, Logs for `429` or `over_request_rate_limit` and raise these if real users hit them. The per-IP limits that matter are the Vercel rules above.
  - Authentication, Emails (or Providers, Email): keep the minimum interval between emails to one address at 60 seconds. The login form already turns Supabase's `429` into "Too many sign-in emails in a short time".
- [ ] Turnstile CAPTCHA (see "Supabase Auth hardening") is the bound on signups from many IPs. Turn it on if the email count climbs with no matching sign-ins.

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
- [ ] Account deletion waits 14 days (migration `0010_account_deletion_grace`). Schedule its purge as "Account deletion purge" below says, the same day the code ships: until the job runs, nobody who asked is deleted, and the privacy policy promises 14 days.
- [ ] Decide what support does when an account reaches a quota (`docs/data-model.md`, Quotas): purge its old soft-deleted rows, or raise the cap for it.

## Account deletion purge
"Delete my account in 14 days" in Settings adds a row to `account_deletions`; the account keeps working and every signed-in page shows "Your account is scheduled for deletion on <day>. Undo". Undo deletes the row. "Delete now" (typed phrase) still calls `delete_my_account` at once. Nothing deletes a scheduled account until the owner schedules `purge_due_accounts()`, which removes up to 50 accounts whose request is 14 or more days old, through the same cascade. Only `postgres` (its owner) and `service_role` may execute it.

Use pg_cron, inside the database. A Vercel cron would need the service-role key in Vercel and a public route that can delete accounts; pg_cron needs neither.
1. [ ] Apply `supabase/migrations/0010_account_deletion_grace.sql` with `apply_migration`, after review, and before deploying the code that uses it. Without the table, "Delete my account in 14 days" says it did not save and the banner never shows; "Delete now" still works. Run `get_advisors` after; expect no new item.
2. [ ] Check the grants in the SQL editor: `select grantee from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'purge_due_accounts';` lists only `postgres` and `service_role`.
3. [ ] Database, Extensions: enable `pg_cron`.
4. [ ] In the SQL editor (it runs as `postgres`, which the job then runs as): `select cron.schedule('purge-due-accounts', '17 * * * *', $$select public.purge_due_accounts()$$);` That is hourly at 17 past. At 50 a run, that is 1,200 accounts a day.
5. [ ] Check: `select jobname, schedule, active from cron.job;` shows the job active. After the next 17 past, `select status, return_message, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'purge-due-accounts') order by start_time desc limit 3;` shows `succeeded`.
6. [ ] End to end with a throwaway account (never a real one): sign in, Settings, "Delete my account in 14 days", copy its id from Authentication, Users, then in the SQL editor `update public.account_deletions set requested_at = now() - interval '15 days' where user_id = '<that id>';` and `select public.purge_due_accounts();` returns `1`, and the user is gone from Authentication, Users.
- To stop it: `select cron.unschedule('purge-due-accounts');` Requests stay in the table and are purged once a job runs again.

## Final pass
- [ ] Open the landing, privacy and terms pages on a phone and a desktop, in light and dark.
- [ ] Install the app from the browser (PWA) and confirm it opens to `/today`.
- [ ] Confirm no page shows a `[placeholder]` and no link points at `localhost`.
