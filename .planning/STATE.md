---
gsd_state_version: 1.0
milestone: v2.7
milestone_name: Entry Timing Watchlist & ETF Exclusion
current_phase: 28
current_phase_name: Watchlist Persistence
status: executing
stopped_at: Completed 28-01-PLAN.md
last_updated: "2026-07-15T02:33:01.403Z"
last_activity: 2026-07-15
last_activity_desc: Phase 28 execution started
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 6
  completed_plans: 4
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-15 after v2.7 milestone start)

**Core value:** 毎日の投資判断に必要な多角的分析を、複数AIアナリストの議論形式で提供すること
**Current focus:** Phase 28 — Watchlist Persistence

## Current Position

Phase: 28 (Watchlist Persistence) — EXECUTING
Plan: 2 of 3
Status: Ready to execute
Last activity: 2026-07-15 — Phase 28 execution started

## Performance Metrics

**Velocity (cumulative):**

- v2.0 plans completed: 7
- v2.1 plans completed: 6
- v2.2 plans completed: 5
- v2.3 plans completed: 12
- v2.4 plans completed: 9 (Phase 15: 2, Phase 16: 3, Phase 17: 2, Phase 18: 2)
- v2.5 plans completed: 12 (Phase 19: 3, Phase 20: 2, Phase 21: 2, Phase 22: 4, Phase 23: 1)
- v2.6 plans completed: 8 (Phase 24: 3, Phase 25: 2, Phase 26: 3)

| Phase Plan | Duration | Tasks | Files |
|------------|----------|-------|-------|
| Phase 25 P01 | 8min | 2 tasks | 2 files |

*Updated after each plan completion*
| Phase 25 P02 | 10min | 3 tasks | 3 files |
| Phase 27-etf-exclusion P01 | 2min | 2 tasks | 2 files |
| Phase 27-etf-exclusion P02 | 2min | 2 tasks | 2 files |
| Phase 27-etf-exclusion P03 | 4min | 2 tasks | 1 files |
| Phase 28-watchlist-persistence P01 | 8min | 3 tasks | 2 files |

## Accumulated Context

### Roadmap Evolution

- 2026-07-15: v2.7 roadmap created — Phase 27 (ETF Exclusion), Phase 28 (Watchlist Persistence), Phase 29 (Daily Tracking Data Supply), Phase 30 (Buy-Timing Judgment Agent), Phase 31 (Daily Report Watchlist Section). Phase numbering continues from v2.6's last phase (26 → 27). Directly follows research/SUMMARY.md's 5-phase build order (all four research passes converged on this exact sequence: deterministic TS infrastructure first, LLM-facing agent step next, report rendering last). WLST-04 (time-based staleness/expiry) and WLST-05 (reason-coded removal history) were added to REQUIREMENTS.md during requirements definition per research's explicit gap flag (literal milestone spec named only 2 removal triggers; unbounded growth risk) and both grouped into Phase 28 alongside WLST-01/02/03 since all five requirements govern the same `data/watchlist.json` admit/prune state machine. OPS-06 (fail-soft for all 4 new pipeline steps: registration/data-supply/judgment/rendering) is traced singularly to Phase 29 (Daily Tracking Data Supply) per the OPS-05/PORT-02 (v2.5 Phase 21) and XREP-02 (v2.6 Phase 24) precedent of grouping a fail-soft requirement with the step carrying the highest external-failure surface — Phase 29 is the step calling rate-limited external APIs (Yahoo Finance/Finnhub) per-ticker, the exact risk research Pitfall 3 flags; each of Phases 28/30/31 still implements its own fail-soft step marker as part of delivering OPS-06's overall intent, but traceability maps the requirement to Phase 29.
- 2026-07-04: v2.6 roadmap created — Phase 24 (Digest-Meeting Cross-Reference), Phase 25 (Urgency History Persistence), Phase 26 (Weekly Urgency Rollup Display). Phase numbering continues from v2.5's last phase (23 → 24). XREP-01/02 grouped into a single phase (Phase 24) since the fail-soft requirement (XREP-02) protects the exact pipeline step the matching feature introduces, mirroring how OPS-05 was grouped with PORT-02 in v2.5 Phase 21. HIST split into two phases: persistence (Phase 25: HIST-01/02, data/urgency-history.json + same-day guard) then display (Phase 26: HIST-03, portfolio.html weekly rollup) — mirrors v2.5's Phase 19→20 foundation-then-UI split, since the rollup requires the persisted history to exist first. XREP (Phase 24) and HIST persistence (Phase 25) are independent and could be implemented in parallel if desired, but are numbered sequentially per standard phase ordering.

- 2026-07-03: v2.5 roadmap created — Phase 19 (Data Foundation & Holding-News Supply), Phase 20 (Holding-Card News Display), Phase 21 (Portfolio WebSearch Research), Phase 22 (Portfolio-Analyst Re-Evaluation), Phase 23 (New-Candidates Section Removal). Phase numbering continues from v2.4's last phase (18 → 19). Derived from research/SUMMARY.md's 5-phase structure; PORT-01 grouped into Phase 19 (data supply) rather than Phase 22 (rationale integration) so that UI-05/06 (Phase 20) has a completed data-supply dependency to build on; OPS-05 grouped into Phase 21 (the new pipeline step it fail-softs) per orchestrator guidance.
- 2026-07-02: v2.4 roadmap created — Phase 15 (Curation Contract & Schema), Phase 16 (Report Generator/HTML Rendering), Phase 17 (Pipeline Integration & Orchestration), Phase 18 (Index/Nav Integration & Validation). Phase numbering continues from v2.3's last phase (14.1 → 15).
- Phase 14.1 inserted after Phase 14 (v2.3): Close gap: OPS-01/OPS-03 — run.sh EXIT_CODE常時0バグとSTEPマーカーのログ未到達を修正（監査で発見） (URGENT)

### Key Decisions

v2.7ロードマップ決定事項:

- **WLST-04/05をPhase 28に含める**: research/SUMMARY.mdが指摘した「文言上のスコープは除外トリガー2種（降格・購入）のみで、時間ベース失効を欠くとリスト無限肥大」というギャップを踏まえ、requirements定義時にWLST-04（時間ベース自動失効）とWLST-05（理由付き除外レコード保持）を追加。5要件すべてが同一の`data/watchlist.json`状態機械（admit/prune）を規定するため単一フェーズに統合し、除外ポリシーを「後付け」ではなく追記ポリシーと同時設計する（research Pitfall 2/Phase 2フラグに整合）
- **OPS-06はPhase 29（データ供給）に単一トレース**: 4つの新パイプラインステップ（登録=28/データ供給=29/判定=30/描画=31）すべてを対象とするfail-soft要件だが、traceabilityは1フェーズに定める必要があるため、外部API（Yahoo Finance/Finnhub）のレート制限に最も晒される29に割当（v2.5 Phase 21のOPS-05/PORT-02、v2.6 Phase 24のXREP-02と同じ「保護対象ステップに割当」方針）。各フェーズは自身のステップでfail-softマーカーを実装する
- **Phase順序はresearch/SUMMARY.mdの5フェーズ構成をそのまま採用**: STACK/FEATURES/ARCHITECTURE/PITFALLSの4リサーチパスが独立に同一順序（ETF除外→永続化→データ供給→判定エージェント→レポート描画）へ収束したため、決定論的TSインフラ（27-29）を先に固め、初のLLM関与コンポーネント（30）がすでに安定したデータ形状を参照できるようにする
- **フリップフロップ緩和・ルックアヘッド防止はPhase 30の必須設計**: research Pitfall 4/5により、前日スナップショットのindependent-then-compare注入（Phase 22 decisionChangedパターン流用）と米国/日本のas-of時点区別は「後で洗練する」項目ではなくPhase 30計画時点で確定させる

v2.6の決定事項は PROJECT.md Key Decisions および `.planning/milestones/v2.6-ROADMAP.md` に集約済み。

Phase 25 Plan 01 実行時の決定事項:

- **HoldingUrgencySnapshot/UrgencyHistoryFile は urgency-history.ts 自身に定義**: meeting/types.ts はLLM出力型専用のため、永続化用の派生型は portfolio/ ドメイン側（holding-news.ts の HoldingNewsFile と同じ配置方針）に置く
- **isValidDateKey は invest.md Step 4 デプロイ検証と同一の正規表現 `/^\d{4}-\d{2}-\d{2}$/` を再利用**（D-06）: 2つの検証ポイントが食い違うことを構造的に防止
- **appendUrgencySnapshot はオブジェクトキーの spread（`{ ...history, [dateKey]: snapshots }`）で実装**: 配列filter方式より単純で、同一キー代入により重複が構造的に不可能

Phase 25 Plan 02 実行時の決定事項:

- **loadExistingHistory の ENOENT 判定は `error.code === "ENOENT"` と `error.message.includes("ENOENT")` の両方をチェック**: このコードベースのテストモック規約（write-news-digest.test.ts 由来）は `.code` を持たないプレーンな `Error("ENOENT")` で欠損をシミュレートするため、`.code` のみのチェックでは欠損(D-13)と破損(D-14)を誤判定する（Rule 1 バグ修正）
- **dateKey は tmp/meeting-result.json の date フィールドから取得**（portfolioAnalysis.date でもJST再導出でもない）: Step 4 の docs/{date}/ ディレクトリ・コミットメッセージと必ず一致させるため（D-05）
- **invest.md Step 4 の git add は data/ の存在を二重防御で保証**: write-urgency-history.ts 自身の mkdir(DATA_DIR) に加え、Step 4 側でも `existsSync('data')` ガードを追加し、`git add docs/ data/` の exit 128 クラッシュを構造的に防止

### Key Decisions (v2.2〜v2.4 — carried forward)

- **tmp/ JSON境界**: TSとClaudeのハンドオフはすべて `tmp/*.json` ファイル経由
- **performance.now() 採用**: NTPジャンプによる負値防止のため Date.now() 禁止
- **denylistのみ**: allowlist方式はReuters実証で54%の正規投資記事を誤除外するため不採用
- **ステップマーカー設計**: STEP:OK/FAILの一貫した形式でログに記録
- **ID参照方式キュレーション**: AgentはID（n01〜n80）のみ選定、URLはTS側で照合し幻覚を構造的に防止
- **news-digestはfail-soft**: 失敗時も既存3レポートの生成・デプロイを妨げない（専用`[STEP:news-digest:*]`マーカー）

### Blockers

None

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|

（v2.6 requirements definitionで XREP-01 / PORT-F1(→HIST-01/02/03) を本ロードマップに取り込み済みのため、以前のDeferredエントリは解消。v2.7ではWLST-F1（保有銘柄買い増しタイミング判定）・WLST-F2（買いシグナル的中率の事後検証）をFuture RequirementsとしてREQUIREMENTS.mdに記録済み。新規のDeferred項目なし）

### Acknowledged at v2.3 milestone close (2026-07-01)

Human-UAT / 実行時検証待ち項目。いずれも静的解析では確認不能でコードレベルは監査済み (v2.3-MILESTONE-AUDIT.md: passed)。クローズ後も各HUMAN-UAT.mdで追跡。

| Category | Item | Status |
|----------|------|--------|
| uat_gap | phase-12 12-HUMAN-UAT.md (Round1前日参照/Round3ログの実動作) | partial (2 pending) |
| uat_gap | phase-13 13-HUMAN-UAT.md (macOS通知の実機表示) | partial (1 pending) |
| uat_gap | phase-14.1 14.1-HUMAN-UAT.md (明朝07:00 launchd実行検証) | partial (2 pending) |
| verification_gap | phase-12 12-VERIFICATION.md | human_needed |
| verification_gap | phase-13 13-VERIFICATION.md | human_needed |
| verification_gap | phase-14 14-VERIFICATION.md | human_needed |
| verification_gap | phase-14.1 14.1-VERIFICATION.md | human_needed |

### Acknowledged at v2.5 milestone close (2026-07-04)

Human-UAT / 実行時検証待ち項目。いずれも静的解析では確認不能でコードレベルは検証済み (各フェーズ VERIFICATION passed)。クローズ後も各HUMAN-UAT.mdで追跡。

| Category | Item | Status |
|----------|------|--------|
| uat_gap | phase-20 20-HUMAN-UAT.md | partial (1 pending) |
| uat_gap | phase-21 21-HUMAN-UAT.md (Step 3-P ライブ実行確認) | partial (2 pending) |
| uat_gap | phase-22 22-HUMAN-UAT.md (rationale実言及・urgent/変化バッジのライブ確認) | partial (3 pending) |
| verification_gap | phase-20 20-VERIFICATION.md | human_needed |
| verification_gap | phase-21 21-VERIFICATION.md | human_needed |
| verification_gap | phase-22 22-VERIFICATION.md | human_needed |

### Acknowledged at v2.6 milestone close (2026-07-04)

Human-UAT / 実行時検証待ち項目。いずれも静的解析では確認不能でコードレベルは検証済み (v2.6-MILESTONE-AUDIT.md: tech_debt — 全要件satisfied・ブロッカーなし。監査で発見した唯一のWARNING（ロールアップ1日遅れ）は invest.md の Step 3f→Step 3c 再順序で解消済み)。クローズ後も各HUMAN-UAT.mdで追跡。

| Category | Item | Status |
|----------|------|--------|
| uat_gap | phase-24 24-HUMAN-UAT.md (digest-crossref注記のライブ実行確認) | partial (2 pending) |
| verification_gap | phase-24 24-VERIFICATION.md | human_needed |
| nyquist | phase-24 24-VALIDATION.md (nyquist_compliant: false — /gsd:validate-phase 24 で後追い可) | partial |

## Session Continuity

**Last session:** 2026-07-15T02:33:01.396Z

**Resume file:** 

None
Stopped at: Completed 28-01-PLAN.md
Resume with: `/gsd-plan-phase 27`

## Operator Next Steps

- Review ROADMAP.md draft for v2.7 (Phases 27-31) and confirm phase structure
- Start phase planning with `/gsd-plan-phase 27`

## Decisions

- [Phase ?]: allowlistはquoteType!==EQUITY判定で実装（denylist不採用）。quoteTypeByTickerはReadonlyMap型でprototype pollution対策（T-27-01）
- [Phase ?]: fetchQuoteTypes()はquote()例外をmain()側のtry/catchへ伝播させ、D-02(メカニズム故障)とD-01(per-ticker失敗)の境界を単一の呼び出し箇所に集約する
- [Phase ?]: console.logはD-13監査ログ専用、console.errorはSTEPステータス専用（write-urgency-history.tsのチャネル規約を踏襲）
- [Phase ?]: 既存の「注意: picksのtickerは必ず英数字ティッカー形式」行は5ブロックとも変更せず、その直後に新規1行を追記する形にした（置換ではなく追記で既存契約を保持） — acceptance_criteriaのgrepで置換ではなく追記であることを構造的に検証可能にするため
- [Phase ?]: filter-etf-stocks.ts の実行は pipeline-metrics の validationStart 記録直後・validate-meeting.ts 実行直前に配置 — D-07: 除外後のhighlightedStocksを以降の全バリデーション・サマリー表示・下流レポート生成が参照するため構造的に順序を保証する
- [Phase 28-01]: D-06のスキーマ形状としてactiveフィールド+history配列方式を採用（episode配列方式より isActive 判定が単純）
- [Phase 28-01]: pruneWatchlistのトリガー優先順位を purchased > downgraded > expired に固定（Pitfall 3対策、precedenceテストで検証）
- [Phase 28-01]: admitBullishStocks/pruneWatchlistはquote()を呼ばずquoteTypeByTicker/nameByTicker/holdingsを引数で受け取る（ネットワーク非依存を維持, D-23）
