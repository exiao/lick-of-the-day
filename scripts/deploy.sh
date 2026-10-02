#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "$(git branch --show-current)" != "main" ]; then
  echo "Production deploy requires the main branch." >&2
  exit 1
fi
tracked_status=$(git status --porcelain --untracked-files=no)
if [ -n "$tracked_status" ]; then
  echo "Production deploy requires clean tracked files." >&2
  exit 1
fi

untracked=$(git ls-files --others --exclude-standard -- . ':!experiments')
if [ -n "$untracked" ]; then
  echo "Production deploy refuses untracked files outside experiments/." >&2
  exit 1
fi

sha=$(git rev-parse HEAD)
npm run build
(cd workers/daily-lick-cron && npx wrangler deploy)
npx wrangler pages deploy dist --project-name=lick-of-the-day --branch=main --commit-hash="$sha"
