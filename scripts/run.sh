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
