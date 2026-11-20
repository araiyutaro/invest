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

terminal-notifier -title "Investment Agent" -message "パイプライン開始 (約15分)" -sound Tink

# HTML 保護: index / portfolio の <head>（タイトル・スタイル）は日次更新で変わらない。
# 実行前後でハッシュを比べ、変わっていたら通知する（エントリ追加は <body> 側なので誤検知しない）。
# LIMITATION: <body> の構造破壊は検知しない。そこは update-index.ts のテストで担保する。
PROTECT_FILES=("docs/index.html" "docs/portfolio.html")
head_hash() {
  sed -n '/<head>/,/<\/head>/p' "$1" | shasum -a 256 | awk '{print $1}'
}
HEAD_BEFORE=()
for f in "${PROTECT_FILES[@]}"; do
  HEAD_BEFORE+=("$(head_hash "$PROJECT_DIR/$f")")
done

EXIT_CODE=0
# caffeinate -i: 実行中のアイドルスリープを防ぐ
# --strict-mcp-config: 無人実行に MCP（Gmail / Drive / Neon など）を読み込ませない
# --disallowedTools: 自分を再起動できるツールを外す（ScheduleWakeup が完了後に /invest を再実行した）
caffeinate -i claude --dangerously-skip-permissions \
  -p "/invest" \
  --model sonnet \
  --max-turns 200 \
  --strict-mcp-config \
  --disallowedTools ScheduleWakeup CronCreate RemoteTrigger \
  --output-format stream-json --verbose \
  >> "$LOG_FILE" 2>&1 || EXIT_CODE=$?

HTML_CHANGED=""
for i in "${!PROTECT_FILES[@]}"; do
  f="${PROTECT_FILES[$i]}"
  if [ "$(head_hash "$PROJECT_DIR/$f")" != "${HEAD_BEFORE[$i]}" ]; then
    HTML_CHANGED="$HTML_CHANGED $f"
  fi
done
if [ -n "$HTML_CHANGED" ]; then
  echo "HTML保護: <head> が変更されました:$HTML_CHANGED（git log -p で確認し、必要なら revert してください）" | tee -a "$LOG_FILE"
  terminal-notifier -title "Investment Agent" -message "HTML の <head> が変更されました:$HTML_CHANGED" -sound Basso
fi

# 終了コード 0 でも、途中で止まって当日のレポートが出ていない場合は失敗として扱う
REPORT_FILE="$PROJECT_DIR/docs/${TIMESTAMP%%_*}/daily-report.html"
if [ "$EXIT_CODE" -eq 0 ] && [ ! -f "$REPORT_FILE" ]; then
  echo "[STEP:report-missing:FAIL] 当日のレポートが生成されていません: $REPORT_FILE" | tee -a "$LOG_FILE"
  EXIT_CODE=1
fi

echo "=== Investment Pipeline Finished: $(date) (exit: $EXIT_CODE) ===" | tee -a "$LOG_FILE"

if [ "$EXIT_CODE" -eq 0 ]; then
  terminal-notifier -title "Investment Agent" -message "パイプライン正常完了" -sound Glass
else
  FAILED_STEP=$(grep -o '\[STEP:[^:]*:FAIL' "$LOG_FILE" | tail -1 | sed -E 's/\[STEP:([^:]*):FAIL/\1/') || true
  if [ -n "$FAILED_STEP" ]; then
    terminal-notifier -title "Investment Agent" -message "パイプライン異常終了 (${FAILED_STEP}で失敗, exit: $EXIT_CODE)" -sound Basso
  else
    terminal-notifier -title "Investment Agent" -message "パイプライン異常終了 (exit: $EXIT_CODE)" -sound Basso
  fi
fi

find "$LOG_DIR" -name "invest-*.log" -mtime +7 -delete 2>/dev/null || true

exit $EXIT_CODE
