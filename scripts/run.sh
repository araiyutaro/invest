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

# v2.0: /invest skill command is the entry point; automated execution removed.
# Phase 4 cleanup: v1.0 entry point and docs/ git commit/push logic removed.
echo "v2.0: Use /invest skill command to run investment analysis."
