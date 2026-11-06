#!/usr/bin/env bash
# What failed in a CI run, in a few lines: job results, then each failed e2e test with its first error lines.
# Replaces reading whole job logs. Usage: scripts/ci-failures.sh [branch | run-id]   (default: current branch)
set -euo pipefail

arg="${1:-$(git rev-parse --abbrev-ref HEAD)}"
if [[ "$arg" =~ ^[0-9]+$ ]]; then
  rid="$arg"
else
  rid="$(gh run list --branch "$arg" --limit 1 --json databaseId -q '.[0].databaseId')"
fi

gh run view "$rid" --json status,conclusion,headSha,jobs \
  -q '"run '"$rid"' · \(.headSha[0:7]) · \(.status) \(.conclusion)", (.jobs[] | "  \(.name): \(.conclusion // .status)")'

jid="$(gh run view "$rid" --json jobs -q '.jobs[] | select(.name=="e2e" and .conclusion=="failure") | .databaseId')"
[ -n "$jid" ] || exit 0

gh api --allow-escape-sequences "repos/{owner}/{repo}/actions/jobs/$jid/logs" 2>/dev/null |
  sed 's/\x1b\[[0-9;]*m//g; s/^[0-9T:.Z-]* //' |
  awk '
    /^ +[0-9]+\) \[/ { print ""; print $0; keep = 9; next }
    keep > 0 && /(Error:|Expected|Received|Locator|Timeout|at \/home)/ { print "   " $0; keep-- }
    /^ +[0-9]+ (failed|flaky|passed)/ { print $0 }
  '
