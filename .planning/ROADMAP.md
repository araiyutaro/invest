# Roadmap: Investment Agent

## Milestones

- ✅ **v2.0 Claude Code Migration** — Phases 1-4 (shipped 2026-06-25)
- ✅ **v2.1 Report Quality & Pipeline Overhaul** — Phases 5-7 (shipped 2026-06-25)
- ✅ **v2.2 News Quality & Pipeline Metrics** — Phases 8-10 (shipped 2026-06-28)
- ✅ **v2.3 Analysis Quality & Operational Stability** — Phases 11-14.1 (shipped 2026-07-01)
- ✅ **v2.4 News Curation Report** — Phases 15-18 (shipped 2026-07-03)
- ✅ **v2.5 Portfolio News Intelligence** — Phases 19-23 (shipped 2026-07-04)
- ✅ **v2.6 Digest-Meeting Cross-Reference & Urgency History** — Phases 24-26 (shipped 2026-07-04)
- ✅ **v2.7 Entry Timing Watchlist & ETF Exclusion** — Phases 27-31 (shipped 2026-07-17)

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

<details>
<summary>✅ v2.4 News Curation Report (Phases 15-18) — SHIPPED 2026-07-03</summary>

AIが厳選したニュースダイジェスト（news-digest.html）を4紙目のレポートとして日次パイプラインに追加。ID参照方式で幻覚URLを構造的に防止し、fail-soft設計で既存3レポートへの影響ゼロを保証。

- [x] **Phase 15: Curation Contract & Schema** (2/2 plans) — completed 2026-07-02 — ID付与（n01〜n80）+ zod二層バリデーションで幻覚URL・不正market値を構造的に防止
- [x] **Phase 16: Report Generator (HTML Rendering)** (3/3 plans) — completed 2026-07-02 — generateNewsDigestHtml純関数レンダラー（市場別グルーピング・重要度バッジ・ティッカーピル・3値フォールバック）
- [x] **Phase 17: Pipeline Integration & Orchestration** (2/2 plans) — completed 2026-07-03 — news-curator 2体並列 + write-news-digest.ts fail-soft統合・[STEP:news-digest:*]マーカー
- [x] **Phase 18: Index/Nav Integration & Validation** (2/2 plans) — completed 2026-07-03 — index.htmlリンクのfs実在チェック条件付き出し分け・118日分ライブ検証・本番デプロイ

Full details: `.planning/milestones/v2.4-ROADMAP.md`

</details>

<details>
<summary>✅ v2.5 Portfolio News Intelligence (Phases 19-23) — SHIPPED 2026-07-04</summary>

保有銘柄ごとのニュースとWebSearchリサーチを踏まえた売却・保有再考をポートフォリオ分析に復活させ、レポートを保有銘柄の意思決定に集中させる（v1.0「Web調査後の再評価」フローのv2.x再実装）。

- [x] **Phase 19: Data Foundation & Holding-News Supply** (3/3 plans) — completed 2026-07-03 — finnhub.tsティッカー汚染バグ修正 + 決定論的な保有銘柄別ニュース抽出をportfolio-analystへ供給
- [x] **Phase 20: Holding-Card News Display** (2/2 plans) — completed 2026-07-03 — 保有銘柄カードへのID参照方式ニュース表示（見出し・ソース・リンク、0件時の正常描画）
- [x] **Phase 21: Portfolio WebSearch Research** (2/2 plans) — completed 2026-07-03 — 保有銘柄ごとのWebSearchリサーチをfail-softな新設パイプラインステップとして実行
- [x] **Phase 22: Portfolio-Analyst Re-Evaluation** (4/4 plans) — completed 2026-07-03 — ニュース・リサーチを踏まえた判断根拠、緊急度フラグ、前日比較の決定論的判断変化検出
- [x] **Phase 23: New-Candidates Section Removal** (1/1 plan) — completed 2026-07-04 — ポートフォリオレポートから新規組入候補セクションを削除（成功・フォールバック両パス）

Full details: `.planning/milestones/v2.5-ROADMAP.md`

</details>

<details>
<summary>✅ v2.6 Digest-Meeting Cross-Reference & Urgency History (Phases 24-26) — SHIPPED 2026-07-04</summary>

ニュースダイジェストとミーティング分析の相互参照を実現し、緊急度フラグの履歴を永続化してポートフォリオの週次振り返りを可能にする。

- [x] **Phase 24: Digest-Meeting Cross-Reference** (3/3 plans) — completed 2026-07-04 — ニュースダイジェスト記事への当日ミーティング関連注記をTS側決定論的マッチングで付与（fail-soft、XREP-01/02）
- [x] **Phase 25: Urgency History Persistence** (2/2 plans) — completed 2026-07-04 — 保有銘柄の緊急度フラグ・判断を data/urgency-history.json に日次追記（同日再実行ガード、HIST-01/02）
- [x] **Phase 26: Weekly Urgency Rollup Display** (3/3 plans) — completed 2026-07-04 — portfolio-report.html に直近7日間の緊急フラグ・判断変更ロールアップを純関数集計・fail-soft描画で追加（HIST-03）

Full details: `.planning/milestones/v2.6-ROADMAP.md`

</details>

<details>
<summary>✅ v2.7 Entry Timing Watchlist & ETF Exclusion (Phases 27-31) — SHIPPED 2026-07-17</summary>

強気評価された個別銘柄（ETF除外）をウォッチリストとして永続追跡し、株価・ニュースに基づく日次の買いタイミング判定で「今日買うべき / 待つべき」を Daily Report に表示する。

- [x] **Phase 27: ETF Exclusion** (3/3 plans) — completed 2026-07-15 — アナリスト推奨銘柄からETFをプロンプト指示＋TS側`quoteType`決定論検証の二層防御で除外
- [x] **Phase 28: Watchlist Persistence** (3/3 plans) — completed 2026-07-15 — 強気銘柄を`data/watchlist.json`にティッカーキー方式で日次登録し、降格・購入済み・失効を理由付きで自動除外
- [x] **Phase 29: Daily Tracking Data Supply** (3/3 plans) — completed 2026-07-15 — ウォッチリスト銘柄の株価・テクニカル・関連ニュースを銘柄単位fail-softで収集し判定エージェントへ供給
- [x] **Phase 30: Buy-Timing Judgment Agent** (3/3 plans) — completed 2026-07-15 — 複数シグナル合致に基づく「今日買うべき/待つべき」判定をLLM+TS zod検証ハイブリッドで日次生成
- [x] **Phase 31: Daily Report Watchlist Section** (3/3 plans) — completed 2026-07-17 — Daily Reportにウォッチリストセクションを追加し判定バッジ・理由・前日比変化を表示

Full details: `.planning/milestones/v2.7-ROADMAP.md`

</details>

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
| 15. Curation Contract & Schema | v2.4 | 2/2 | Complete    | 2026-07-02 |
| 16. Report Generator (HTML Rendering) | v2.4 | 3/3 | Complete    | 2026-07-02 |
| 17. Pipeline Integration & Orchestration | v2.4 | 2/2 | Complete    | 2026-07-03 |
| 18. Index/Nav Integration & Validation | v2.4 | 2/2 | Complete    | 2026-07-03 |
| 19. Data Foundation & Holding-News Supply | v2.5 | 3/3 | Complete    | 2026-07-03 |
| 20. Holding-Card News Display | v2.5 | 2/2 | Complete    | 2026-07-03 |
| 21. Portfolio WebSearch Research | v2.5 | 2/2 | Complete    | 2026-07-03 |
| 22. Portfolio-Analyst Re-Evaluation | v2.5 | 4/4 | Complete    | 2026-07-03 |
| 23. New-Candidates Section Removal | v2.5 | 1/1 | Complete    | 2026-07-04 |
| 24. Digest-Meeting Cross-Reference | v2.6 | 3/3 | Complete    | 2026-07-04 |
| 25. Urgency History Persistence | v2.6 | 2/2 | Complete    | 2026-07-04 |
| 26. Weekly Urgency Rollup Display | v2.6 | 3/3 | Complete    | 2026-07-04 |
| 27. ETF Exclusion | v2.7 | 3/3 | Complete   | 2026-07-15 |
| 28. Watchlist Persistence | v2.7 | 3/3 | Complete   | 2026-07-15 |
| 29. Daily Tracking Data Supply | v2.7 | 3/3 | Complete   | 2026-07-15 |
| 30. Buy-Timing Judgment Agent | v2.7 | 3/3 | Complete   | 2026-07-15 |
| 31. Daily Report Watchlist Section | v2.7 | 3/3 | Complete    | 2026-07-17 |

---
*Roadmap created: 2026-06-24*
*Milestone v2.0 shipped: 2026-06-25*
*Milestone v2.1 shipped: 2026-06-25*
*Milestone v2.2 shipped: 2026-06-28*
*Milestone v2.3 shipped: 2026-07-01*
*Milestone v2.4 shipped: 2026-07-03*
*Milestone v2.5 shipped: 2026-07-04*
*Milestone v2.6 shipped: 2026-07-04*
*Milestone v2.7 shipped: 2026-07-17*
