# Roadmap: Investment Agent

## Milestones

- ✅ **v2.0 Claude Code Migration** — Phases 1-4 (shipped 2026-06-25)
- ✅ **v2.1 Report Quality & Pipeline Overhaul** — Phases 5-7 (shipped 2026-06-25)
- ✅ **v2.2 News Quality & Pipeline Metrics** — Phases 8-10 (shipped 2026-06-28)
- ✅ **v2.3 Analysis Quality & Operational Stability** — Phases 11-14.1 (shipped 2026-07-01)
- 📋 **v2.4 (next)** — planning (`/gsd-new-milestone`)

## Phases

<details>
<summary>✅ v2.0 Claude Code Migration (Phases 1-4) — SHIPPED 2026-06-25</summary>

既存のTypeScript/yahoo-finance2/HTML層をそのまま維持しながら、AI分析層をGemini APIからClaude Codeのスキル・サブエージェントシステムへ移行。

- [x] **Phase 1: Data Layer + Skill Foundation** (2/2 plans) — completed 2026-06-24
- [x] **Phase 2: Analyst Subagents** (2/2 plans) — completed 2026-06-24
- [x] **Phase 3: Report Builder + WebSearch Research** (2/2 plans) — completed 2026-06-25
- [x] **Phase 4: Gemini Cleanup** (1/1 plan) — completed 2026-06-25

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.1 Report Quality & Pipeline Overhaul (Phases 5-7) — SHIPPED 2026-06-25</summary>

v1.0品質の3レポート構成を復元し、新規銘柄発掘とポートフォリオ管理を分離、GitHub Pagesへの自動デプロイを実現。

- [x] **Phase 5: Analysis Engine Overhaul** (2/2 plans) — completed 2026-06-25
- [x] **Phase 6: 3-Report Structure** (2/2 plans) — completed 2026-06-25
- [x] **Phase 7: Portfolio Integration & Deployment** (2/2 plans) — completed 2026-06-25

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

<details>
<summary>✅ v2.2 News Quality & Pipeline Metrics (Phases 8-10) — SHIPPED 2026-06-28</summary>

ニュース収集の品質改善（重複排除・フィルタ・件数見直し）とパイプライン実行時間の計測。

- [x] **Phase 8: News Filter Module** (2/2 plans) — completed 2026-06-27
- [x] **Phase 9: Pipeline Integration** (2/2 plans) — completed 2026-06-28
- [x] **Phase 10: Pipeline Timing** (1/1 plan) — completed 2026-06-28

Full details: `.planning/milestones/v2.2-ROADMAP.md`

</details>

<details>
<summary>✅ v2.3 Analysis Quality & Operational Stability (Phases 11-14.1) — SHIPPED 2026-07-01</summary>

ニュース品質・分析品質・運用安定性・レポートUIを総合的に底上げし、毎日の自動実行パイプラインの信頼性と出力品質を向上させる。

- [x] **Phase 11: News Quality Enhancements** (2/2 plans) — completed 2026-06-30 — Finnhubティッカー別取得・時間重み付け・クロス言語dedup
- [x] **Phase 12: Analysis Quality** (2/2 plans) — completed 2026-06-30 — 前日レポート注入・スコアリング並列エージェント化
- [x] **Phase 13: Operational Stability** (1/1 plan) — completed 2026-06-30 — エラーログ・HTML保護・macOS通知検証
- [x] **Phase 14: Report UI** (5/5 plans) — completed 2026-07-01 — index.htmlモバイル対応・インラインチャート追加
- [x] **Phase 14.1: Close gap OPS-01/OPS-03** (2/2 plans, INSERTED) — completed 2026-07-01 — run.sh EXIT_CODE捕捉・STEPマーカーログ到達・シェルインジェクション修正

Full details: `.planning/milestones/v2.3-ROADMAP.md`

</details>

### 📋 v2.4 (next milestone — planning)

次期マイルストーンは未定義。`/gsd-new-milestone` で要件定義から開始する。繰り越し候補: ニュースキュレーションHTML (CURA-01)。

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Data Layer + Skill Foundation | v2.0 | 2/2 | Complete | 2026-06-24 |
| 2. Analyst Subagents | v2.0 | 2/2 | Complete | 2026-06-24 |
| 3. Report Builder + WebSearch Research | v2.0 | 2/2 | Complete | 2026-06-25 |
| 4. Gemini Cleanup | v2.0 | 1/1 | Complete | 2026-06-25 |
| 5. Analysis Engine Overhaul | v2.1 | 2/2 | Complete | 2026-06-25 |
| 6. 3-Report Structure | v2.1 | 2/2 | Complete | 2026-06-25 |
| 7. Portfolio Integration & Deployment | v2.1 | 2/2 | Complete | 2026-06-25 |
| 8. News Filter Module | v2.2 | 2/2 | Complete | 2026-06-27 |
| 9. Pipeline Integration | v2.2 | 2/2 | Complete | 2026-06-28 |
| 10. Pipeline Timing | v2.2 | 1/1 | Complete | 2026-06-28 |
| 11. News Quality Enhancements | v2.3 | 2/2 | Complete | 2026-06-30 |
| 12. Analysis Quality | v2.3 | 2/2 | Complete | 2026-06-30 |
| 13. Operational Stability | v2.3 | 1/1 | Complete | 2026-06-30 |
| 14. Report UI | v2.3 | 5/5 | Complete | 2026-07-01 |
| 14.1. Close gap OPS-01/OPS-03 (INSERTED) | v2.3 | 2/2 | Complete | 2026-07-01 |

---
*Roadmap created: 2026-06-24*
*Milestone v2.0 shipped: 2026-06-25*
*Milestone v2.1 shipped: 2026-06-25*
*Milestone v2.2 shipped: 2026-06-28*
*Milestone v2.3 shipped: 2026-07-01*
