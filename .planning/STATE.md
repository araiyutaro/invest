---
gsd_state_version: 1.0
milestone: v2.6
milestone_name: Digest-Meeting Cross-Reference & Urgency History
status: planning
stopped_at: Phase 25 context gathered
last_updated: "2026-07-04T02:27:07.327Z"
last_activity: 2026-07-04
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04 after v2.5 milestone)

**Core value:** 毎日の投資判断に必要な多角的分析を、複数AIアナリストの議論形式で提供すること
**Current focus:** Phase 25 — urgency history persistence

## Current Position

Phase: 25
Plan: Not started
Status: Ready to plan
Last activity: 2026-07-04

## Performance Metrics

**Velocity (cumulative):**

- v2.0 plans completed: 7
- v2.1 plans completed: 6
- v2.2 plans completed: 5
- v2.3 plans completed: 12
- v2.4 plans completed: 9 (Phase 15: 2, Phase 16: 3, Phase 17: 2, Phase 18: 2)
- v2.5 plans completed: 12 (Phase 19: 3, Phase 20: 2, Phase 21: 2, Phase 22: 4, Phase 23: 1)

*Updated after each plan completion*

## Accumulated Context

### Roadmap Evolution

- 2026-07-04: v2.6 roadmap created — Phase 24 (Digest-Meeting Cross-Reference), Phase 25 (Urgency History Persistence), Phase 26 (Weekly Urgency Rollup Display). Phase numbering continues from v2.5's last phase (23 → 24). XREP-01/02 grouped into a single phase (Phase 24) since the fail-soft requirement (XREP-02) protects the exact pipeline step the matching feature introduces, mirroring how OPS-05 was grouped with PORT-02 in v2.5 Phase 21. HIST split into two phases: persistence (Phase 25: HIST-01/02, data/urgency-history.json + same-day guard) then display (Phase 26: HIST-03, portfolio.html weekly rollup) — mirrors v2.5's Phase 19→20 foundation-then-UI split, since the rollup requires the persisted history to exist first. XREP (Phase 24) and HIST persistence (Phase 25) are independent and could be implemented in parallel if desired, but are numbered sequentially per standard phase ordering.

- 2026-07-03: v2.5 roadmap created — Phase 19 (Data Foundation & Holding-News Supply), Phase 20 (Holding-Card News Display), Phase 21 (Portfolio WebSearch Research), Phase 22 (Portfolio-Analyst Re-Evaluation), Phase 23 (New-Candidates Section Removal). Phase numbering continues from v2.4's last phase (18 → 19). Derived from research/SUMMARY.md's 5-phase structure; PORT-01 grouped into Phase 19 (data supply) rather than Phase 22 (rationale integration) so that UI-05/06 (Phase 20) has a completed data-supply dependency to build on; OPS-05 grouped into Phase 21 (the new pipeline step it fail-softs) per orchestrator guidance.
- 2026-07-02: v2.4 roadmap created — Phase 15 (Curation Contract & Schema), Phase 16 (Report Generator/HTML Rendering), Phase 17 (Pipeline Integration & Orchestration), Phase 18 (Index/Nav Integration & Validation). Phase numbering continues from v2.3's last phase (14.1 → 15).
- Phase 14.1 inserted after Phase 14 (v2.3): Close gap: OPS-01/OPS-03 — run.sh EXIT_CODE常時0バグとSTEPマーカーのログ未到達を修正（監査で発見） (URGENT)

### Key Decisions

v2.6ロードマップ決定事項:

- **XREP-01/02を単一フェーズ（Phase 24）に統合**: fail-soft要件（XREP-02）はマッチング機能が導入するパイプラインステップそのものを保護するため、切り離さず同一フェーズで実装・検証する（v2.5 Phase 21のPORT-02/OPS-05統合と同じ方針）
- **HISTを永続化（Phase 25）と表示（Phase 26）に分割**: 週次ロールアップの描画には永続化された履歴データが前提となるため、foundation→UIの順で依存関係を明確化（v2.5のPhase 19→20と同じ構造）
- **Phase 24とPhase 25は独立**: 両者は異なるデータソース（meeting-result.json vs urgent/decisionフィールド）・異なる出力（news-digest.html vs data/urgency-history.json）に依存するため相互依存なし。並行実装も可能だが番号は逐次採番

v2.5の決定事項は PROJECT.md Key Decisions および `.planning/milestones/v2.5-ROADMAP.md` に集約済み。

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

（v2.6 requirements definitionで XREP-01 / PORT-F1(→HIST-01/02/03) を本ロードマップに取り込み済みのため、以前のDeferredエントリは解消。新規のDeferred項目なし）

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

## Session Continuity

Last session: 2026-07-04T02:27:07.317Z
Stopped at: Phase 25 context gathered
Resume with: `/gsd-plan-phase 24`

## Operator Next Steps

- Review ROADMAP.md draft for Phases 24-26
- Start planning with `/gsd-plan-phase 24`
