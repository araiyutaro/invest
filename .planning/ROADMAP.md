# Roadmap: Investment Agent

## Milestones

- ✅ **v2.0 Claude Code Migration** — Phases 1-4 (shipped 2026-06-25)
- ✅ **v2.1 Report Quality & Pipeline Overhaul** — Phases 5-7 (shipped 2026-06-25)
- ✅ **v2.2 News Quality & Pipeline Metrics** — Phases 8-10 (shipped 2026-06-28)
- ✅ **v2.3 Analysis Quality & Operational Stability** — Phases 11-14.1 (shipped 2026-07-01)
- ✅ **v2.4 News Curation Report** — Phases 15-18 (shipped 2026-07-03)
- ✅ **v2.5 Portfolio News Intelligence** — Phases 19-23 (shipped 2026-07-04)
- ✅ **v2.6 Digest-Meeting Cross-Reference & Urgency History** — Phases 24-26 (shipped 2026-07-04)
- 🚧 **v2.7 Entry Timing Watchlist & ETF Exclusion** — Phases 27-31 (in progress)

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

### 🚧 v2.7 Entry Timing Watchlist & ETF Exclusion (Phases 27-31) — IN PROGRESS

強気評価された個別銘柄（ETF除外）をウォッチリストとして永続追跡し、株価・ニュースに基づく日次の買いタイミング判定で「今日買うべき / 待つべき」を Daily Report に表示する。

- [x] **Phase 27: ETF Exclusion** - アナリスト推奨銘柄からETFをプロンプト指示＋TS側`quoteType`決定論検証の二層防御で除外 (completed 2026-07-15)
- [x] **Phase 28: Watchlist Persistence** - 強気銘柄を`data/watchlist.json`にティッカーキー方式で日次登録し、降格・購入済み・失効を理由付きで自動除外 (completed 2026-07-15)
- [ ] **Phase 29: Daily Tracking Data Supply** - ウォッチリスト銘柄の株価・テクニカル・関連ニュースを銘柄単位fail-softで収集し判定エージェントへ供給
- [ ] **Phase 30: Buy-Timing Judgment Agent** - 複数シグナル合致に基づく「今日買うべき/待つべき」判定をLLM+TS zod検証ハイブリッドで日次生成
- [ ] **Phase 31: Daily Report Watchlist Section** - Daily Reportにウォッチリストセクションを追加し判定バッジ・理由・前日比変化を表示

## Phase Details

### Phase 27: ETF Exclusion

**Goal**: アナリストが推奨する銘柄候補（picks / highlightedStocks）からETFが構造的に排除され、ウォッチリストや各レポートのハイライト銘柄に一切ETFが混入しない
**Depends on**: Nothing (first phase of v2.7)
**Requirements**: ETF-01, ETF-02
**Success Criteria** (what must be TRUE):

  1. 全5アナリストエージェントのプロンプトに、ETFを推奨銘柄（picks）から除外する明示的指示が含まれている
  2. meeting-result確定後、TS側で`yahoo-finance2`の`quote().quoteType`照合により、米国ETF・日本ETF（`.T`サフィックスでは判別不能なため`quoteType`必須）の両方がhighlightedStocksから決定論的に除外される
  3. 個別銘柄のquoteType lookupに失敗した場合でもパイプラインがthrowせず、安全側（除外 or 通過の明示方針）で処理が継続する
  4. 除外ロジックの単体テストが米国ETF・日本ETF・個別株それぞれの分類を正しく検証している

**Plans**: 3/3 plans complete
Plans:
**Wave 1**

- [x] 27-01-PLAN.md — 純関数 etf-exclusion.ts（quoteType allowlist フィルタ + 単体テスト, TDD）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 27-02-PLAN.md — fail-soft CLI filter-etf-stocks.ts（単一 batch quote 照合 + 書き戻し + テスト）

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 27-03-PLAN.md — invest.md 配線（5アナリスト+モデレーターのプロンプト指示 + Step 2g wiring）

### Phase 28: Watchlist Persistence

**Goal**: 当日「強気」評価された銘柄（ETF除外後）が`data/watchlist.json`に日次で蓄積され、降格・購入・長期未確認の各理由に応じて理由付きで自動除外される、監査可能な状態テーブルとして機能する
**Depends on**: Phase 27 (ETF除外済みのhighlightedStocksが入力となるため)
**Requirements**: WLST-01, WLST-02, WLST-03, WLST-04, WLST-05
**Success Criteria** (what must be TRUE):

  1. 当日ミーティングで`verdict: 強気`となった銘柄（ETF除外後）が、ティッカーキー方式の`data/watchlist.json`に`addedDate`/`lastVerdictDate`付きで自動登録される（過去分の遡及なし、当日以降のみ）
  2. 翌日以降の再評価でverdictが中立/弱気に転落した銘柄は、レコード削除ではなく`removedReason: downgraded`付きでウォッチリストから除外される
  3. portfolio.jsonの保有銘柄に現れたティッカーは`removedReason: purchased`付きで自動除外される
  4. 強気再確認が一定期間（設計時に確定する日数）ない銘柄は`removedReason: expired`付きで時間ベースに自動失効し、リストが無限に肥大しない
  5. 除外・失効後もレコードは履歴として保持され、いつ・なぜ除外されたかを追跡できる

**Plans**: 3/3 plans complete
Plans:

**Wave 1**

- [x] 28-01-PLAN.md — 純関数 watchlist.ts（型定義・admitBullishStocks・pruneWatchlist・EXPIRY_CALENDAR_DAYS・getActiveWatchlistEntries + 単体テスト, TDD, WLST-01〜05）

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 28-02-PLAN.md — fail-soft CLI write-watchlist.ts（batch quote() で quoteType+社名, ENOENT/破損二段フェイル, prune→admit 合成, [STEP:watchlist:*] マーカー + テスト）

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 28-03-PLAN.md — invest.md 配線（Step 2g 直後に write-watchlist 新ステップを fail-soft 挿入 + launchd 実行の human-verify）

### Phase 29: Daily Tracking Data Supply

**Goal**: ウォッチリストに登録された各銘柄について、当日の株価・テクニカル指標・関連ニュースが判定エージェントへ確実に供給され、1銘柄の取得失敗が他銘柄処理やパイプライン全体を止めない
**Depends on**: Phase 28 (追跡対象となるアクティブなウォッチリストが存在すること)
**Requirements**: TRAC-01, TRAC-02, TRAC-03, OPS-06
**Success Criteria** (what must be TRUE):

  1. ウォッチリスト銘柄それぞれの当日株価・テクニカル指標（MA/RSI/出来高等）が`collect-technicals`パターンを流用して日次収集される
  2. ウォッチリスト銘柄それぞれの関連ニュースが`tmp/news.json`から`holding-news`パターン流用のTS側決定論マッチングで抽出される
  3. 追跡データ収集は銘柄単位でfail-softに実装されており、1銘柄のAPI取得失敗（レート制限含む）が他銘柄の処理やパイプライン全体の失敗につながらないことがテストで確認できる
  4. 新パイプラインステップに専用`[STEP:*]`マーカーがあり、失敗時も既存4レポートの生成・デプロイが継続する

**Plans**: TBD

### Phase 30: Buy-Timing Judgment Agent

**Goal**: ウォッチリスト銘柄それぞれについて、供給された実データに基づく複数シグナル合致の根拠を伴う「今日買うべき / 待つべき」の日次判定が、前日との比較を踏まえてブレなく生成される
**Depends on**: Phase 29 (判定に必要な株価・テクニカル・ニュースデータが供給されていること)
**Requirements**: TIME-01, TIME-02, TIME-03, TIME-04, TIME-05
**Success Criteria** (what must be TRUE):

  1. 判定エージェントがウォッチリスト銘柄ごとに「今日買うべき / 待つべき」の二値判定と判定理由を日次で出力する
  2. 判定出力はTS側zodスキーマ（`passthrough().transform()`によるalias硬化）で検証され、LLMが不正・ゆらぎのあるフィールド名を出力してもパイプラインが停止しない
  3. 前日の判定スナップショットがindependent-then-compare方式でプロンプトに注入され、判定が「待ち→買い」等に変化した場合はTS側決定論で検出される（Phase 22 decisionChangedパターン流用、フリップフロップ緩和）
  4. 判定理由が実際に供給されたデータの複数シグナル合致（confluence ≥2、例: MA位置＋RSI＋出来高＋ニュース材料）に基づいており、存在しない指標値を創作していないことがプロンプト契約とレビューで確認できる
  5. 米国株は前日終値ベース、日本株は寄付き前という基準時点の違いが、判定入力（as-ofタイムスタンプ）と表示の両方で区別され、ルックアヘッドバイアスが構造的に防止される

**Plans**: TBD

### Phase 31: Daily Report Watchlist Section

**Goal**: Daily Reportの閲覧者が、ウォッチリスト銘柄ごとの「今日買うべき」判定と前日からの変化を一目で把握できる
**Depends on**: Phase 30 (表示する判定データが存在すること)
**Requirements**: UI-09, UI-10
**Success Criteria** (what must be TRUE):

  1. Daily Reportにウォッチリストセクションが追加され、各銘柄に「今日買うべき」バッジ（または「待ち」表示）・判定理由・会社名が表示される
  2. 前日からの判定変化（新規買いシグナル点灯・買い→待ち転落）が、既存のurgent/decisionChangedバッジと同様の視覚様式で区別表示される
  3. ウォッチリストが空・1件・複数件のいずれの状態でもレポートが正常に描画される（fail-softローダー、既存3+1レポートの生成・デプロイへの影響なし）

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
| 24. Digest-Meeting Cross-Reference | v2.6 | 3/3 | Complete    | 2026-07-04 |
| 25. Urgency History Persistence | v2.6 | 2/2 | Complete    | 2026-07-04 |
| 26. Weekly Urgency Rollup Display | v2.6 | 3/3 | Complete    | 2026-07-04 |
| 27. ETF Exclusion | v2.7 | 3/3 | Complete   | 2026-07-15 |
| 28. Watchlist Persistence | v2.7 | 3/3 | Complete   | 2026-07-15 |
| 29. Daily Tracking Data Supply | v2.7 | 0/0 | Not started | - |
| 30. Buy-Timing Judgment Agent | v2.7 | 0/0 | Not started | - |
| 31. Daily Report Watchlist Section | v2.7 | 0/0 | Not started | - |

---
*Roadmap created: 2026-06-24*
*Milestone v2.0 shipped: 2026-06-25*
*Milestone v2.1 shipped: 2026-06-25*
*Milestone v2.2 shipped: 2026-06-28*
*Milestone v2.3 shipped: 2026-07-01*
*Milestone v2.4 shipped: 2026-07-03*
*Milestone v2.5 shipped: 2026-07-04*
*Milestone v2.6 shipped: 2026-07-04*
*Milestone v2.7 roadmap created: 2026-07-15*
