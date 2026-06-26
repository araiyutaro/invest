---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: News Quality & Pipeline Metrics
status: planning
last_updated: "2026-06-26T04:41:53.477Z"
last_activity: 2026-06-26
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-06-26 — Milestone v2.2 started

## Progress Bar

```
[========================================] 100% (3/3 phases)
```

Phase 5: Analysis Engine Overhaul ✓
Phase 6: 3-Report Structure ✓
Phase 7: Portfolio Integration & Deployment ✓

## Performance Metrics

- Phases completed: 1/3
- Plans completed: 2/6
- Requirements mapped: 14/14

## Accumulated Context

### Key Decisions

- **ハイブリッドアプローチ**: TypeScript層（データ収集・HTMLレンダリング）はそのまま維持、AI分析層のみClaudeに置換
- **tmp/ JSON境界**: TSとClaudeのハンドオフはすべて `tmp/*.json` ファイル経由
- **データスコーピング**: トークンコスト爆発防止のため、各アナリストには役割に必要なデータのみ渡す
- **WebSearch制限**: 定量データ（株価・財務数値）はYahoo Finance API必須; WebSearchは定性情報のみ
- **WebSearch Agent**: 銘柄ごとに並列 sonnet Agent でスポーン（D-06）
- **再評価ラウンド**: 5アナリスト並列 sonnet Agent（D-07）、再評価スコアは tmp/reeval/ にのみ保存
- **ティッカーサニタイズ**: ファイル名で / を - に置換（BRK/B → BRK-B）
- **generateHtml独立スクリプト**: v1.0 generator.ts を import せず独立スクリプト化（D-08）
- **docs/ 出力先**: v2.1でreports/ からdocs/YYYY-MM-DD/ に変更（GitHub Pages対応）
- **escapeHtml全適用**: XSS防止のため全テキストコンテンツをescapeHtml経由で出力（T-03-06 mitigate）
- **3レポート分離**: Daily Report / Meeting Minutes / Portfolio Report を別HTMLファイルに分離（v2.1新規）
- **ポートフォリオ非依存分析**: Phase 5でアナリストの銘柄発掘をポートフォリオから切り離す（v2.1新規）
- **D-01 Portfolio Analysis**: 単一 opus エージェントが全保有銘柄の評価・リバランス提案を一括生成（07-01決定）
- **D-04 新規組入候補転載**: highlightedStocks を追加AI分析なしで Portfolio Report に転載（07-01決定）
- **Null fallback**: portfolio-analysis.json 未生成時はフォールバック HTML + 新規組入候補のみ表示（07-01決定）
- **D-06 Step 4 末尾追加**: invest.md の末尾に Step 4 を追加（07-02決定）
- **D-07 自動push**: push前のユーザー確認なし（完全自動）（07-02決定）
- **D-08 コミットメッセージ**: `report: YYYY-MM-DD daily update` 形式、push先 origin master（07-02決定）
- **analysisフィールドハイブリッド方式**: Round 1にanalysis（4セクション詳細散文）を追加しつつsummary/highlights等の構造化フィールドを維持（05-01決定）
- **Round 1データスコープ確定**: market.json + news.json（最新50件）のみ、portfolio.json除外（05-01決定）
- **picks銘柄数制限**: 1〜3銘柄（macroは0〜2）、ニュース・市況からの新規発掘のみ（05-01決定）
- **Round 2 discussion フィールド**: agentId直後・comment前に追加、800〜1500文字の[アナリスト名]明示参照（05-02決定）
- **Round 2 model opus**: ディスカッション品質向上のため sonnet → opus に変更（05-02決定）
- **Round 3 reason 100字ガイド**: Zod制約なし、プロンプトのみで管理（30字→100字、05-02決定）

### Pitfalls to Avoid

- サブエージェントJSON出力の非構造化 → システムプロンプトに厳密なJSONスキーマ例を含める
- `allowed-tools` フロントマターの既知バグ → ツール制限はシステムプロンプト内の禁止指示で担保
- 実行順序崩壊 → データ収集完了確認後にエージェントスポーン
- Portfolio ReportがDaily Reportの出力に依存 → Phase 6完了後にPhase 7を着手する

### Blockers

None

## Deferred Items

Items acknowledged and deferred from v2.0 milestone close:

| Category | Item | Status |
|----------|------|--------|
| uat_gaps | Phase 01 01-HUMAN-UAT.md | partial (2 pending scenarios) |
| uat_gaps | Phase 02 02-HUMAN-UAT.md | partial (3 pending scenarios) |
| uat_gaps | Phase 03 03-HUMAN-UAT.md | passed |
| verification_gaps | Phase 01 01-VERIFICATION.md | human_needed |
| verification_gaps | Phase 02 02-VERIFICATION.md | human_needed |

Note: Phase 3 UAT で全パイプラインの E2E 動作が確認済みのため、Phase 1/2 の個別 UAT は実質カバー済み。

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-25)

**Core value:** 毎日の投資判断に必要な多角的分析を、複数AIアナリストの議論形式で提供すること
**Current focus:** v2.1 Phase 6 — 3-Report Structure

## Session Continuity

Next action: v2.1 milestone complete — all phases done. Next: E2E pipeline run to verify full /invest command flow.
