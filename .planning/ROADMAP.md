# Roadmap: Investment Agent

## Milestones

- ✅ **v2.0 Claude Code Migration** — Phases 1-4 (shipped 2026-06-25)
- ✅ **v2.1 Report Quality & Pipeline Overhaul** — Phases 5-7 (shipped 2026-06-25)
- ✅ **v2.2 News Quality & Pipeline Metrics** — Phases 8-10 (shipped 2026-06-28)
- ✅ **v2.3 Analysis Quality & Operational Stability** — Phases 11-14.1 (shipped 2026-07-01)
- ✅ **v2.4 News Curation Report** — Phases 15-18 (shipped 2026-07-03)
- ✅ **v2.5 Portfolio News Intelligence** — Phases 19-23 (shipped 2026-07-04)
- 🚧 **v2.6 Digest-Meeting Cross-Reference & Urgency History** — Phases 24-26 (in progress)

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

### 🚧 v2.6 Digest-Meeting Cross-Reference & Urgency History (Phases 24-26) — IN PROGRESS

ニュースダイジェストとミーティング分析の相互参照を実現し、緊急度フラグの履歴を永続化してポートフォリオの週次振り返りを可能にする。

- [ ] **Phase 24: Digest-Meeting Cross-Reference** — ニュースダイジェスト記事への当日ミーティング関連注記をTS側決定論的マッチングで付与（fail-soft）
- [ ] **Phase 25: Urgency History Persistence** — 保有銘柄の緊急度フラグ・判断を data/urgency-history.json に日次追記（同日再実行ガード付き）
- [ ] **Phase 26: Weekly Urgency Rollup Display** — portfolio.html に直近7日間の緊急フラグ・判断変更履歴のロールアップセクションを追加

## Phase Details

### Phase 24: Digest-Meeting Cross-Reference
**Goal**: ニュースダイジェスト（news-digest.html）の閲覧者が、各記事が当日ミーティングでどう議論されたかを一目で把握でき、その関連注記はLLMの幻覚ではなく決定論的なティッカー・キーワード照合で生成される
**Depends on**: Nothing (v2.5完了時点のnews-digest.html/meeting-result.jsonを基盤とする、v2.6内で最初のフェーズ)
**Requirements**: XREP-01, XREP-02
**Success Criteria** (what must be TRUE):
  1. ユーザーは news-digest.html の記事に、当日ミーティングで議論されたテーマ・銘柄への関連注記（バッジ等の視覚的マーカー）を確認できる
  2. 関連注記は meeting-result.json のティッカー一致優先+テーマキーワード照合によるTS側決定論的マッチングで生成され、holding-news.ts と同じ設計思想（LLMの追加呼び出しなし・幻覚URLなし）に従う
  3. クロスリファレンス処理が例外を投げても、news-digest.html および既存3レポートの生成・デプロイパイプラインは正常に完了し、専用の STEP マーカーで失敗が可視化される
  4. 当日ミーティングで議論されていない記事は、注記なしで通常通り表示される（0件時のフォールバック、レイアウト崩れなし）
**Plans**: TBD
**UI hint**: yes

### Phase 25: Urgency History Persistence
**Goal**: 保有銘柄の緊急度フラグと判断が、日次実行のたびに監査可能な履歴としてリポジトリ内に永続化され、同日の再実行によって履歴が壊れない
**Depends on**: Nothing (Phase 24とは独立、v2.5で確立した urgent/decision フィールドを基盤とする)
**Requirements**: HIST-01, HIST-02
**Success Criteria** (what must be TRUE):
  1. パイプライン実行後、data/urgency-history.json に当日の日付キーで保有12銘柄それぞれの urgent フラグと decision が記録されている
  2. data/urgency-history.json は git commit/push フローに含まれ、リポジトリ（非公開の data/、公開 docs/ ではない）に永続化される
  3. 同日中に複数回パイプラインを実行しても、同日エントリは重複追加されず上書きされる（v2.5 の同日再実行ガードと同方式）
**Plans**: TBD

### Phase 26: Weekly Urgency Rollup Display
**Goal**: ユーザーは portfolio.html 上で、直近1週間にどの保有銘柄が緊急フラグや判断変更の対象になったかを振り返ることができる
**Depends on**: Phase 25 (ロールアップの描画には data/urgency-history.json の永続化された履歴データが必要)
**Requirements**: HIST-03
**Success Criteria** (what must be TRUE):
  1. ユーザーは portfolio.html で「今週の緊急フラグ履歴」等の週次ロールアップセクションを確認できる（新規ページの追加はなし）
  2. ロールアップは data/urgency-history.json の直近7日間のエントリから、銘柄ごとの緊急フラグ発生日・判断変更を集計して表示する
  3. 履歴データが0件または7日に満たない場合でも、セクションはエラーにならず適切な空状態・部分表示を示す
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
| 21. Portfolio WebSearch Research | v2.5 | 2/2 | Complete    | 2026-07-03 |
| 22. Portfolio-Analyst Re-Evaluation | v2.5 | 4/4 | Complete    | 2026-07-03 |
| 23. New-Candidates Section Removal | v2.5 | 1/1 | Complete    | 2026-07-04 |
| 24. Digest-Meeting Cross-Reference | v2.6 | 0/? | Not started | - |
| 25. Urgency History Persistence | v2.6 | 0/? | Not started | - |
| 26. Weekly Urgency Rollup Display | v2.6 | 0/? | Not started | - |

---
*Roadmap created: 2026-06-24*
*Milestone v2.0 shipped: 2026-06-25*
*Milestone v2.1 shipped: 2026-06-25*
*Milestone v2.2 shipped: 2026-06-28*
*Milestone v2.3 shipped: 2026-07-01*
*Milestone v2.4 shipped: 2026-07-03*
*Milestone v2.5 shipped: 2026-07-04*
*Milestone v2.6 roadmap created: 2026-07-04*
</content>
