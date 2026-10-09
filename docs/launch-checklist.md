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
- [ ] Add redirect URLs `https://<domain>/auth/callback` (and the Vercel preview pattern `https://*-<team>.vercel.app/auth/callback` if previews should sign in). Remove `localhost` entries from the production project if it is separate from the dev one.
- [ ] Authentication, Emails: set the sender name, and configure custom SMTP; the built-in sender is rate-limited and not meant for production.
- [ ] Apply `supabase/migrations/0005_hardening.sql` (and any later file) to the production project with `apply_migration`.
- [ ] Run `get_advisors` (security and performance) on the production project and clear every warning.
- [ ] Check: a magic link sent from the production site signs in and lands on `/today`.

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

## Final pass
- [ ] Open the landing, privacy and terms pages on a phone and a desktop, in light and dark.
- [ ] Install the app from the browser (PWA) and confirm it opens to `/today`.
- [ ] Confirm no page shows a `[placeholder]` and no link points at `localhost`.
