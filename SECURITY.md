# Security policy

## Reporting a vulnerability

Please report security problems privately, through GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. The report is visible only to the maintainers until a fix is published.

Do not open a public issue or pull request for a vulnerability, and do not include other people's data in a report.

Useful to include:
- what an attacker can do, and to whose data;
- the steps or a request that shows it, against your own account only;
- the commit or deployment you tested.

You should hear back within a week. Once a fix ships, the advisory is published, with credit if you want it.

## Scope

In scope: the code in this repository and the deployed Axiis web app. Out of scope: denial of service by volume, missing rate limits on their own, reports from automated scanners with no demonstrated impact, and the services Axiis runs on (Vercel, Supabase, Google, Cloudflare), which have their own programmes.

Please do not test against accounts that are not yours, and do not run load tests against the production site.
