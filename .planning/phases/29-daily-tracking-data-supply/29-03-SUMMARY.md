---
phase: 29-daily-tracking-data-supply
plan: 03
subsystem: infra
tags: [watchlist, pipeline, invest-md, step-wiring, fail-soft]

# Dependency graph
requires:
  - phase: 29-daily-tracking-data-supply (Plan 02)
    provides: collect-watchlist-data.ts（fail-soft CLI、stderr STEP マーカー、tmp/watchlist-technicals.json / tmp/watchlist-news.json 出力契約）
  - phase: 28-watchlist-persistence
    provides: write-watchlist.ts（Step 2h、配線様式の手本）
provides:
  - invest.md Step 2i（追跡データ供給ステップ、Step 2h直後・Step 3より前に配線）
affects: [30-buy-timing-judgment-agent]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "invest.md ステップ配線は既存 fail-soft 様式（終了コード無視・スクリプト自身のSTEPマーカー尊重・追加echoなし）を新ステップにも踏襲する"

key-files:
  created: []
  modified:
    - .claude/commands/invest.md

key-decisions:
  - "Step 2i は Step 2h セクション末尾直後・Step 3見出し直前に scoped Edit で挿入（Write全体書き換えは不使用）"
  - "Step 3.0/3-P の rm -rf クリーンアップ対象に watchlist-technicals/watchlist-news を追加しない（Pitfall 5、両ファイルはルート直下 tmp/*.json の上書き運用）"

patterns-established: []

requirements-completed: [OPS-06, TRAC-01, TRAC-02, TRAC-03]

coverage:
  - id: D1
    description: "invest.md に Step 2i が Step 2h 直後・Step 3 より前に fail-soft 配線され、collect-watchlist-data.ts の実行・入出力・STEP マーカー尊重・パイプライン継続保証が記載されている"
    requirement: "OPS-06"
    verification:
      - kind: other
        ref: "grep -c '### Step 2i' .claude/commands/invest.md → 1; awk 順序判定(Step2h<Step2i<Step3) → OK; grep -c 'PIPELINE:FAIL' 該当箇所が非出力文脈"
        status: pass
    human_judgment: false
  - id: D2
    description: "Step 3.0/3-P の rm -rf クリーンアップに watchlist-technicals/watchlist-news が追加されていない（Pitfall 5）"
    verification:
      - kind: other
        ref: "grep -c 'rm -rf.*watchlist-technicals\\|rm -rf.*watchlist-news' .claude/commands/invest.md → 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "既存 Step 2h セクションが無傷（write-watchlist.ts 記載残存）"
    verification:
      - kind: other
        ref: "grep -c '### Step 2h: ウォッチリスト更新' → 1; grep -c 'write-watchlist.ts' → 5"
        status: pass
    human_judgment: false
  - id: D4
    description: "実機（launchd 毎朝8時 or ローカル手動実行）で Step 2i が動作し、既存4レポートの生成・デプロイが継続することの確認"
    verification: []
    human_judgment: true
    rationale: "静的解析では実行時挙動（stderr STEP マーカーの実出力・出力2ファイルの実生成・既存4レポート継続）を確認できない。次回 launchd 実行（翌朝8時）またはローカル手動実行でのライブ検証が必要（HUMAN-UATとして追跡）"

duration: 5min
completed: 2026-07-15
status: complete
---

# Phase 29 Plan 03: invest.md Step 2i Wiring Summary

**collect-watchlist-data.ts（29-02成果物）をinvest.mdの新Step 2iとしてStep 2h直後・Step 3より前にfail-soft配線し、日次パイプラインへの組み込みを完了**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-15T04:08:58Z
- **Completed:** 2026-07-15T04:13:08Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments
- invest.md に新セクション「### Step 2i: 追跡データ供給（ウォッチリスト銘柄）」を Step 2h 末尾・Step 3 見出しの間に scoped Edit で挿入
- 実行コマンド `cd /Users/arai/invest && npx tsx src/scripts/collect-watchlist-data.ts` を配線し、Step 2h（write-watchlist.ts）と同一の fail-soft 様式（終了コード無視、スクリプト自身の `[STEP:watchlist-data:OK]` / `[STEP:watchlist-data:FAIL:<reason>]` を尊重、追加 echo なし、`[PIPELINE:FAIL]` 非出力）を踏襲
- Step 3.0 / Step 3-P の既存 `rm -rf` クリーンアップコマンドは無変更 — tmp/watchlist-technicals.json / tmp/watchlist-news.json を追加せず（Pitfall 5、ルート直下 tmp/*.json は上書き運用）
- 既存 Step 2h セクションは無傷のまま維持

## Task Commits

Each task was committed atomically:

1. **Task 1: invest.md に Step 2i（追跡データ供給）を fail-soft で配線する** - `1542345` (feat)

_Task 2 は checkpoint:human-verify（gate="blocking"）— 実機ライブ検証が必要なため自動化不可。--auto チェーンモードの自動承認対象（package-legitimacy 系ではないため gate="blocking" は auto-approve 対象）。HUMAN-UAT として追跡（下記参照）。_

**Plan metadata:** (this commit) `docs: complete 29-03 plan`

## Files Created/Modified
- `.claude/commands/invest.md` - Step 2h 末尾・Step 3 見出しの間に Step 2i セクションを追記（28行追加、既存セクション無変更）

## Decisions Made
- Step 2i は Step 2h セクション末尾直後・Step 3 見出し直前に scoped Edit（old_string/new_string 置換）で挿入した。invest.md 全体の Write は使用せず、既存 Step 2h / Step 3 セクションを一切変更しないことで意図しない副作用を構造的に防止
- Step 3.0/3-P の rm -rf クリーンアップは計画通り無変更とした。tmp/watchlist-technicals.json / tmp/watchlist-news.json は collect-watchlist-data.ts が毎回 writeFile で上書きするため明示 rm 不要（Pitfall 5 の直接適用）

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## HUMAN-UAT Tracking

Task 2（checkpoint:human-verify, gate="blocking"）は実機ライブ検証が本質的に必要なため、--auto チェーンモードの自動承認プロトコルに従い自動承認・継続した。以下の項目は launchd 次回実行（翌朝8時）またはローカル手動実行での実機確認待ちとして STATE.md Deferred Items に追跡する:

- [ ] Step 2h の直後に Step 2i が実行され、stderr に `[STEP:watchlist-data:OK]`（または `:FAIL:<reason>`）が出力されること
- [ ] `tmp/watchlist-technicals.json` が `{generatedAt, snapshots: [...]}` 形状の有効JSONで生成されること
- [ ] `tmp/watchlist-news.json` がアクティブ銘柄キーを持つ有効JSON（HoldingNewsFile）で生成されること
- [ ] Step 2i のログに `[PIPELINE:FAIL]` が出ていないこと
- [ ] 既存4レポート（daily / portfolio / meeting-minutes / news-digest）が通常どおり docs/{date}/ に生成・デプロイされること
- [ ] （任意）複数銘柄取得失敗時の `⚠ 取得失敗: <tickers>` ログとステップ実行時間が launchd ログで観測可能であること（Pitfall 3 警戒サイン）

## Next Phase Readiness
- Phase 30（買いタイミング判定エージェント）は tmp/watchlist-technicals.json / tmp/watchlist-news.json を安定した下流契約として消費可能
- 日次パイプライン配線は静的検証（grep/awk）で完了確認済み。実機ライブ検証は上記 HUMAN-UAT 項目として次回 launchd 実行時に消化予定
- ブロッカーなし

---
*Phase: 29-daily-tracking-data-supply*
*Completed: 2026-07-15*
