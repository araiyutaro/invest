#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
LOG_FILE="$LOG_DIR/invest-${TIMESTAMP}.log"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

cd "$PROJECT_DIR"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

mkdir -p "$LOG_DIR"

echo "=== Investment Pipeline Started: $(date) ===" | tee "$LOG_FILE"

terminal-notifier -title "Investment Agent" -message "パイプライン開始 (約40分)" -sound Tink

claude --dangerously-skip-permissions \
  -p "/invest" \
  --model claude-sonnet-4-6 \
  --max-turns 200 \
  >> "$LOG_FILE" 2>&1 || true

EXIT_CODE=${PIPESTATUS[0]:-$?}

echo "=== Investment Pipeline Finished: $(date) (exit: $EXIT_CODE) ===" | tee -a "$LOG_FILE"

if [ "$EXIT_CODE" -eq 0 ]; then
  terminal-notifier -title "Investment Agent" -message "パイプライン正常完了" -sound Glass
else
  terminal-notifier -title "Investment Agent" -message "パイプライン異常終了 (exit: $EXIT_CODE)" -sound Basso
fi

find "$LOG_DIR" -name "invest-*.log" -mtime +7 -delete 2>/dev/null || true

exit $EXIT_CODE
