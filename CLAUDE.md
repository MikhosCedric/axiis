## Agent skills

### Issue tracker

Issues live in GitHub Issues (via the `gh` CLI; no remote configured yet). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### gstack

[gstack](https://github.com/garrytan/gstack) (MIT, pinned at v1.91.68.0, commit `20eb620`) is installed for this project only, in `.claude/skills/gstack`, which is gitignored. It is locked down: telemetry, auto-upgrade and update checks are off, and no Claude hooks or team mode are registered. Do not run `gstack-upgrade` or `setup --team`, and do not turn those settings on, without the owner's say-so.

Use its skills for the job each does: `/review` (pre-landing review of a branch), `/qa` or `/qa-only` (drive the running app and find or fix bugs), `/investigate` (root-cause debugging), `/cso` (security audit), `/design-review`, `/plan-eng-review`, `/plan-design-review`, `/autoplan`, `/ship` (merge base, test, review, PR) and `/test-audit`. They sit beside this project's own conventions: where they disagree, `docs/PROGRESS.md` and this file win, and CI-green merges and the owner-only actions list still apply.

Browsing keeps its existing rules: the built-in browser pane is the default. gstack's `/browse` and `/qa` may use their own bundled browser (built at `.claude/skills/gstack/browse/dist/`); do not use them against the owner's real signed-in sessions or any production account.

To set it up on another machine (the folder is not committed):

```bash
git clone -c core.longpaths=true --single-branch --depth 1 https://github.com/garrytan/gstack.git .claude/skills/gstack
git -C .claude/skills/gstack fetch --depth 1 origin 20eb620 && git -C .claude/skills/gstack checkout 20eb620   # the reviewed version
.claude/skills/gstack/bin/gstack-config set telemetry off && .claude/skills/gstack/bin/gstack-config set auto_upgrade false && .claude/skills/gstack/bin/gstack-config set update_check false
.claude/skills/gstack/setup --local --no-team --no-plan-tune-hooks --no-timeline-stop-hook
```

It needs Bun 1.3.3 or newer.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
