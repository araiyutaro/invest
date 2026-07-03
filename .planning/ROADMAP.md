# Roadmap: Investment Agent

## Milestones

- ✅ **v2.0 Claude Code Migration** — Phases 1-4 (shipped 2026-06-25)
- ✅ **v2.1 Report Quality & Pipeline Overhaul** — Phases 5-7 (shipped 2026-06-25)
- ✅ **v2.2 News Quality & Pipeline Metrics** — Phases 8-10 (shipped 2026-06-28)
- ✅ **v2.3 Analysis Quality & Operational Stability** — Phases 11-14.1 (shipped 2026-07-01)
- ✅ **v2.4 News Curation Report** — Phases 15-18 (shipped 2026-07-03)
- 🚧 **v2.5 Portfolio News Intelligence** — Phases 19-23 (in progress)

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

### 🚧 v2.5 Portfolio News Intelligence (Phases 19-23) — IN PROGRESS

保有銘柄ごとのニュースとWebSearchリサーチを踏まえた売却・保有再考をポートフォリオ分析に復活させ、レポートを保有銘柄の意思決定に集中させる（v1.0「Web調査後の再評価」フローのv2.x再実装）。

- [x] **Phase 19: Data Foundation & Holding-News Supply** — finnhub.tsティッカー汚染バグ修正 + 決定論的な保有銘柄別ニュース抽出をportfolio-analystへ供給 (completed 2026-07-03)
- [x] **Phase 20: Holding-Card News Display** — 保有銘柄カードへのID参照方式ニュース表示（見出し・ソース・リンク、0件時の正常描画） (completed 2026-07-03)
- [ ] **Phase 21: Portfolio WebSearch Research** — 保有銘柄ごとのWebSearchリサーチをfail-softな新設パイプラインステップとして実行
- [ ] **Phase 22: Portfolio-Analyst Re-Evaluation** — ニュース・リサーチを踏まえた判断根拠、緊急度フラグ、前日比較の決定論的判断変化検出
- [ ] **Phase 23: New-Candidates Section Removal** — ポートフォリオレポートから新規組入候補セクションを削除（成功・フォールバック両パス）

## Phase Details

### Phase 19: Data Foundation & Holding-News Supply
**Goal**: portfolio-analyst が、汚染のないティッカーデータに基づいて決定論的に抽出された保有銘柄別関連ニュースを入力として受け取る
**Depends on**: Nothing (first phase of v2.5)
**Requirements**: NEWS-04, PORT-01
**Success Criteria** (what must be TRUE):
  1. データ収集パイプライン実行後、tmp/news.json の一般記事・M&A記事の ticker フィールドが、複数の配列インデックス位置で検証しても常に undefined である（配列インデックス混入がない）
  2. tmp/news.json と12銘柄の保有リストから、ticker一致による決定論的な保有銘柄別ニュースマッピング（優先度スコア順・銘柄あたり上限付き）が生成され、ユニットテストでカバーされている
  3. portfolio-analyst のプロンプトに、保有銘柄ごとの関連ニュースが明示的な入力セクションとして含まれている
**Plans**: 3 plans
- [x] 19-01-PLAN.md — finnhub.ts index-as-ticker バグ修正 + NEWS-04 回帰テスト (Wave 1)
- [x] 19-02-PLAN.md — 決定論的な保有銘柄別ニュース抽出モジュール(TDD) + matchAliases (Wave 1)
- [x] 19-03-PLAN.md — collect-data 統合(holding-news.json) + portfolio-analyst プロンプト入力セクション (Wave 2)

### Phase 20: Holding-Card News Display
**Goal**: レポート閲覧者が各保有銘柄カード上で、その判断根拠となった関連ニュースを直接確認できる
**Depends on**: Phase 19
**Requirements**: UI-05, UI-06
**Success Criteria** (what must be TRUE):
  1. 各保有銘柄カードに、tmp/news.json をID参照方式で照合解決した関連ニュース（見出し・ソース名・元記事リンク）が銘柄あたり3〜5件の上限付きで表示される（幻覚URLが構造的に発生しない）
  2. 関連ニュースが0件の保有銘柄（日本株の小型株等）も、エラーやレイアウト崩れなく通常のカードとして描画され、「本日の関連ニュースなし」等の明示的な空状態が表示される
**Plans**: 2 plans
  - [x] 20-01-PLAN.md — 決定論的データ層: resolvePortfolioHoldingNews リゾルバー・fail-soft ローダー・共通ヘルパー汎化
  - [x] 20-02-PLAN.md — 保有銘柄カードのニュースサブセクション描画（空状態含む）とパイプライン配線
**UI hint**: yes

### Phase 21: Portfolio WebSearch Research
**Goal**: 保有銘柄ごとに最新材料のWebSearchリサーチが実行され、一部または全部が失敗してもパイプライン全体が継続する
**Depends on**: Nothing new (12銘柄の保有リストのみに依存、Phase 19/20と並行実装可能)
**Requirements**: PORT-02, OPS-05
**Success Criteria** (what must be TRUE):
  1. 12銘柄それぞれについてWebSearchによる最新材料リサーチ（決算・訴訟・規制変更・大型契約・ガイダンス変更等）が実行され、結果が tmp/portfolio-research/{symbol}.json という Daily Report 用ディレクトリ（tmp/websearch/）とは分離された専用領域に保存される
  2. 一部または全部の銘柄でWebSearchリサーチが失敗しても、ポートフォリオレポートを含む4レポート全ての生成・デプロイが継続し、専用の [STEP:portfolio-research:*] マーカーで失敗が可視化される
**Plans**: TBD

### Phase 22: Portfolio-Analyst Re-Evaluation
**Goal**: 保有銘柄の売却・保有判断が、ニュース・リサーチ結果を踏まえた再考であることがレポート上で確認でき、重大材料と前日からの判断変化が視覚的に強調される
**Depends on**: Phase 19, Phase 21
**Requirements**: PORT-03, PORT-04, PORT-05, UI-07
**Success Criteria** (what must be TRUE):
  1. 保有銘柄に関連ニュースやリサーチ結果が存在する場合、その銘柄の売却・保有判断（rationale）がその内容へ明示的に言及している
  2. 決算ミス・訴訟・規制変更・大型契約・ガイダンス引下げ等の重大材料を検知した保有銘柄に緊急度フラグ（urgent）が付与され、カード上に赤/アンバー系の視覚的強調として表示される
  3. 前日のポートフォリオ判断スナップショットとの差分がTS側で決定論的に計算され（LLM自己申告ではない）、判断が変化した銘柄のカードに変化バッジが表示される
**Plans**: TBD
**UI hint**: yes

### Phase 23: New-Candidates Section Removal
**Goal**: ポートフォリオレポートが保有銘柄の意思決定に集中し、Daily Reportと重複する新規組入候補セクションが表示されない
**Depends on**: Phase 22
**Requirements**: UI-08
**Success Criteria** (what must be TRUE):
  1. ポートフォリオレポートHTMLに「新規組入候補」セクションが、通常パス（portfolioAnalysis 有り）・フォールバックパス（portfolioAnalysis === null）の両方で存在しない
  2. portfolio-analyst への文脈情報としての highlightedStocks の受け渡しは維持されている（プロンプト入力からは削除されない）
**Plans**: TBD
**UI hint**: yes

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
| 21. Portfolio WebSearch Research | v2.5 | 0/? | Not started | - |
| 22. Portfolio-Analyst Re-Evaluation | v2.5 | 0/? | Not started | - |
| 23. New-Candidates Section Removal | v2.5 | 0/? | Not started | - |

---
*Roadmap created: 2026-06-24*
*Milestone v2.0 shipped: 2026-06-25*
*Milestone v2.1 shipped: 2026-06-25*
*Milestone v2.2 shipped: 2026-06-28*
*Milestone v2.3 shipped: 2026-07-01*
*Milestone v2.4 shipped: 2026-07-03*
*Milestone v2.5 roadmap created: 2026-07-03*
</content>
