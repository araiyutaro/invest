#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

export PATH="/opt/homebrew/bin:$PATH"

cd "$PROJECT_DIR"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

npx tsx src/index.ts >> "$PROJECT_DIR/logs/invest.log" 2>&1

TODAY=$(date +%Y-%m-%d)

if git -C "$PROJECT_DIR" diff --quiet docs/ && \
   git -C "$PROJECT_DIR" diff --cached --quiet docs/ && \
   [ -z "$(git -C "$PROJECT_DIR" ls-files --others --exclude-standard docs/)" ]; then
  echo "[$TODAY] No new report files to commit" >> "$PROJECT_DIR/logs/invest.log"
  exit 0
fi

git -C "$PROJECT_DIR" add docs/
git -C "$PROJECT_DIR" commit -m "report: daily investment report $TODAY"
git -C "$PROJECT_DIR" push origin master
