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

# HTML Protection: record checksums before pipeline
PROTECT_FILES="docs/index.html docs/portfolio.html"
CHECKSUM_FILE="/tmp/invest-html-checksums-${TIMESTAMP}.txt"
for f in $PROTECT_FILES; do
  if [ -f "$PROJECT_DIR/$f" ]; then
    shasum -a 256 "$PROJECT_DIR/$f" >> "$CHECKSUM_FILE"
  fi
done

claude --dangerously-skip-permissions \
  -p "/invest" \
  --model claude-sonnet-4-6 \
  --max-turns 200 \
  >> "$LOG_FILE" 2>&1 || true

EXIT_CODE=${PIPESTATUS[0]:-$?}

# HTML Protection: verify checksums and restore if changed
if [ -f "$CHECKSUM_FILE" ]; then
  RESTORED=""
  for f in $PROTECT_FILES; do
    if [ -f "$PROJECT_DIR/$f" ]; then
      EXPECTED=$(grep "$PROJECT_DIR/$f" "$CHECKSUM_FILE" | awk '{print $1}')
      if [ -n "$EXPECTED" ]; then
        ACTUAL=$(shasum -a 256 "$PROJECT_DIR/$f" | awk '{print $1}')
        if [ "$EXPECTED" != "$ACTUAL" ]; then
          git -C "$PROJECT_DIR" checkout -- "$f"
          RESTORED="$RESTORED $f"
          echo "HTML保護: $f を復元しました" | tee -a "$LOG_FILE"
        fi
      fi
    fi
  done
  rm -f "$CHECKSUM_FILE"
  if [ -n "$RESTORED" ]; then
    echo "HTML保護: 復元されたファイル:$RESTORED" | tee -a "$LOG_FILE"
  fi
fi

echo "=== Investment Pipeline Finished: $(date) (exit: $EXIT_CODE) ===" | tee -a "$LOG_FILE"

if [ "$EXIT_CODE" -eq 0 ]; then
  terminal-notifier -title "Investment Agent" -message "パイプライン正常完了" -sound Glass
else
  terminal-notifier -title "Investment Agent" -message "パイプライン異常終了 (exit: $EXIT_CODE)" -sound Basso
fi

find "$LOG_DIR" -name "invest-*.log" -mtime +7 -delete 2>/dev/null || true

exit $EXIT_CODE
