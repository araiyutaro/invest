# Milestones

## v2.7 Entry Timing Watchlist & ETF Exclusion (Shipped: 2026-07-17)

**Phases completed:** 5 phases, 15 plans, 30 tasks

**Key accomplishments:**

- filterEtfStocks pure classification function (D-01 fail-closed + D-04 EQUITY allowlist) built via TDD, mirroring the urgency-history.ts pure-module pattern
- filter-etf-stocks.ts fail-soft CLI wrapper built via TDD: single batched yahoo-finance2 quote() call classifies highlightedStocks tickers, then rewrites tmp/meeting-result.json with ETFs deterministically excluded
- 5アナリスト+モデレーターのプロンプト（Layer 1）と Step 2g パイプライン統合（Layer 2, filter-etf-stocks.ts の fail-soft wiring）を invest.md に配線し、ETF除外の二層防御を完成させた
- 純関数モジュール src/portfolio/watchlist.ts — admitBullishStocks（強気登録・冪等・ETF第2ゲート）とpruneWatchlist（3トリガー除外・履歴保持）でウォッチリスト状態機械を実装、20件のvitestテストで全WLST要件を検証
- fail-soft CLI ラッパー write-watchlist.ts — batch quote()1回でquoteType+社名を取得しPlan 01の純関数(prune→admit)を合成、二段フェイル(ENOENT/破損)とSTEPマーカーでdata/watchlist.jsonを日次更新、11件のvitestテスト+実quote()スモークテストで検証
- invest.md Step 2g（filter-etf-stocks→validate-meeting）直後・Step 3前にwrite-watchlist.ts実行のStep 2hをfail-softで挿入し、オーケストレーター実施のスモークテスト（POWL個別株+SPY ETF fixture）で[STEP:watchlist:OK]・data/watchlist.json生成・ETF第2ゲート除外を確認、実launchd実行のライブ検証3項目はHUMAN-UATとして保留
- ウォッチリスト銘柄のテクニカル収集に必要な4純関数（形状マップ/キャッシュ突き合わせ/チャンク分割/チャンク単位フェイルソフト並列取得）をTDDで実装、fetchTechnicalSnapshots複数形への依存ゼロで並列度を構造的に制限
- 単一の fail-soft CLI `collect-watchlist-data.ts` がウォッチリスト銘柄の株価テクニカルと関連ニュースを独立ブランチで収集し、同日キャッシュ再利用・チャンク取得・銘柄単位fail-softで2つの下流供給ファイルを生成
- collect-watchlist-data.ts（29-02成果物）をinvest.mdの新Step 2iとしてStep 2h直後・Step 3より前にfail-soft配線し、日次パイプラインへの組み込みを完了
- LLM出力契約を二段階alias硬化スキーマで防御し、confluenceゲート・変化検出・market導出・skip陽性記録の4純関数をTDDで実装（TIME-02〜05）
- Plan 01の決定論コア（watchlistJudgmentSchema/applyConfluenceGate/attachActionChanges/deriveMarket/buildSkippedJudgment）を組み込むfail-soft CLIをTDDで実装し、銘柄別raw JSON検証→confluenceゲート→market/asOf決定論再付与→前日比較の全パイプラインをthrowなしで完遂
- invest.md に Step 3-J（買いタイミング判定）を Step 3-P 直後・Step 3c より前に挿入し、前日退避・raw リセット・銘柄別 model:sonnet 並列 Agent・二層防御プロンプト契約・write-watchlist-judgment.ts CLI 呼び出しを配線。実機ライブ検証は 30-HUMAN-UAT.md へ永続追跡として委譲
- Two new throw-free loaders (loadWatchlistJudgment / loadWatchlist) added to report-data-loaders.ts via strict TDD, including a D-13 stale-date guard that prevents a leftover prior-day judgment file from being displayed as today's data.
- Pure HTML-string rendering functions (formatWatchlistSectionHtml + 3 helpers) added to generate-daily-report.ts to display buy-timing judgments as badged cards, inserted between the scoring matrix and WebSearch sections with fully backward-compatible optional params.
- generate-report.ts の main() が loadWatchlistJudgment/loadWatchlist を Promise.all に追加し、generateDailyReportHtml へ判定データとウォッチリストを渡すことで、Plan 01 の fail-soft ローダーと Plan 02 のセクション描画を実パイプラインに統合した。

---

## v2.6 Digest-Meeting Cross-Reference & Urgency History (Shipped: 2026-07-04)

**Phases completed:** 3 phases, 8 plans, 18 tasks

**Key accomplishments:**

- Deterministic ticker-priority + theme-keyword matcher (`buildDigestCrossRefMap`) that maps each digest article to its meeting-discussion cross-reference, ported from `holding-news.ts`'s tested design.
- Extended `generate-news-digest.ts` with an additive optional `crossRefMap` parameter that renders passive "🗣 ミーティング言及" / "🗣 関連テーマ" chips below `.news-meta`, reusing existing `.ticker-pill` tokens plus a distinct `#a78bfa` meeting-accent border, with a byte-identical regression test guaranteeing zero-match articles are unaffected.
- Pure-function module `src/portfolio/urgency-history.ts` extracting the minimal 4-field urgency snapshot from `PortfolioAnalysis` and merging it into a date-keyed history object via immutable object-key overwrite (no I/O, no throw).
- Thin fail-soft CLI wrapper `write-urgency-history.ts` (mkdir-first, dateKey from meeting-result.json, D-13/D-14/D-06 fail-soft branches) plus invest.md Step 3f + Step 4 `git add docs/ data/` wiring, completing HIST-01/HIST-02 end-to-end persistence to git.
- Pure, throw-free 7-day window aggregation module (`computeWeeklyUrgencyRollup` + `formatDateKeyShort`) built via strict TDD RED/GREEN, covering window filtering, cross-history decision-diff, and prototype-pollution-safe key handling — 23/23 tests passing.
- Rendered the weekly urgency rollup section into portfolio-report.html via a new bespoke `formatWeeklyUrgencyRollupHtml` renderer, wired through a backward-compatible 4th parameter, and made it appear in both the null- and non-null-`portfolioAnalysis` branches per the fail-soft design (D-14).
- Added a thin fail-soft `loadUrgencyHistory` loader (type-assertion, console.warn severity per D-13) to `report-data-loaders.ts` and wired it into `generate-report.ts`'s `Promise.all` loader batch as the 4th argument to `generatePortfolioReportHtml`, closing the HIST-03 data path end-to-end.

---

## v2.5 Portfolio News Intelligence (Shipped: 2026-07-04)

**Phases completed:** 5 phases (19-23), 12 plans, 24 tasks
**Timeline:** 2026-07-03 → 2026-07-04 (2 days)
**Changes:** src/ + .claude/ で23ファイル変更 (+2,169 / -101)、165コミット
**Git range:** docs: start milestone v2.5 (65f133a) → docs(phase-23): add security threat verification (8ab5ed2)

**Delivered:** 保有銘柄ごとのニュースとWebSearchリサーチを踏まえた売却・保有再考をポートフォリオ分析に復活させ、レポートを保有銘柄の意思決定に集中させた（v1.0「Web調査後の再評価」フローのv2.x再実装）。

**Key accomplishments:**

- finnhub.ts の index-as-ticker 汚染バグをTDDで修正し、ticker一致ロジックの信頼できるデータ土台を確立（Phase 19, NEWS-04）
- 決定論的な保有銘柄別ニュース抽出（holding-news.ts、ticker一致優先+社名フォールバック・上限5件）→ tmp/holding-news.json → portfolio-analyst プロンプト注入の供給ラインを完成（Phase 19, PORT-01）
- 保有銘柄カードにID参照方式の関連ニュースサブセクション（見出し・ソース・安全リンク、0件時の明示的空状態）を描画（Phase 20, UI-05/UI-06）
- 保有12銘柄のWebSearchリサーチを fail-soft な新設パイプラインステップ Step 3-P として実装し、tmp/portfolio-research/{symbol}.json へ分離保存 + [STEP:portfolio-research:*] マーカーで失敗可視化（Phase 21, PORT-02/OPS-05）
- urgent 緊急度フラグ（alias硬化スキーマ+重大材料判定プロンプト契約）と、TS側決定論的 decisionChanged 検出（attachDecisionChanges、前日スナップショット等値比較）+ 赤「⚠ 緊急」/アンバー「判断変更」バッジ（Phase 22, PORT-03/04/05, UI-07）
- ポートフォリオレポートから「新規組入候補」セクションを通常・フォールバック両パスで削除、highlightedStocks の文脈受け渡しは維持（Phase 23, UI-08）

**Requirements:** 11/11 complete（NEWS-04, PORT-01〜05, UI-05〜08, OPS-05 — traceability全Complete）

**Audit:** 個別マイルストーン監査はスキップ（全フェーズ VERIFICATION passed・要件トレーサビリティ全Complete のため。v2.4と同様の判断）。pre-close artifact audit: Phase 20/21/22 の Human-UAT / 実行時検証 6件をdeferredとして記録。

Known deferred items at close: 6 (see STATE.md Deferred Items)

---

## v2.4 News Curation Report (Shipped: 2026-07-03)

**Phases completed:** 4 phases (15-18), 9 plans, 17 tasks
**Timeline:** 2026-07-02 → 2026-07-03 (2 days)
**Changes:** 17 files changed (+1,410 / -10) in src/, scripts/, .claude/, docs/index.html
**Git range:** docs(15): capture phase context (398004e) → docs(phase-18): evolve PROJECT.md (3b8dbcf)

**Delivered:** AIが厳選したニュースダイジェスト（news-digest.html）を4紙目のレポートとして日次パイプラインに追加。ID参照方式で幻覚URLを構造的に防止し、fail-soft設計で既存3レポートへの影響ゼロを保証。

**Key accomplishments:**

- ID参照方式のキュレーション契約を確立: `assignArticleIds`（n01〜n80の短い連番ID付与）+ zodによる二層バリデーション（`validateRawNewsCuration` 構造検証 → `resolveNewsCuration` プール参照解決）で幻覚URL・不正market値を構造的に防止（Phase 15）
- `generateNewsDigestHtml(curation, date)` をTDDで実装: 市場別（米国株/日本株/グローバル）グルーピング・重要度順配列・High/Medium/Lowバッジ・ティッカーピル・リード文を既存3レポートと同一のBloomberg風ダークテーマで描画。null/empty/normalの3値フォールバックとXSS/tabnabbing対策済みリンクを完備（Phase 16）
- invest.md Step 3d に news-curator（opus, 2体並列）を追加し、Step 3e で write-news-digest.ts を fail-soft 起動。news-digest.html が4紙目として自動生成され、キュレーション失敗時も `[STEP:news-digest:FAIL:*]` マーカー記録の上で既存3レポートの生成・デプロイが継続することをライブ検証（Phase 17）
- docs/index.html の News Digest リンクを毎回 `fs.access()` 実在チェックから導出する方式に変更し、欠落日の404リンクを排除。118日分の実docsツリーでライブ実行検証（実在する2026-07-03のみリンク表示・既存3レポートリンクに回帰ゼロ）を人間承認の上、GitHub Pagesへ本番デプロイ（Phase 18）

**Requirements:** 12/12 complete（CURA-01〜09, UI-03/04, OPS-04 — traceability全Complete）

**Audit:** 個別マイルストーン監査はスキップ（Phase 18 VERIFICATION 3/3 passed・要件トレーサビリティ全Complete・UI-04ライブ検証+本番デプロイ済みのため）。pre-close artifact audit: all clear。

**Known deferred items at close:** 1（XREP-01 ダイジェスト記事とミーティングテーマの関連注記 — v2.5+、see STATE.md Deferred Items）

**Archive:** `.planning/milestones/v2.4-ROADMAP.md`, `.planning/milestones/v2.4-REQUIREMENTS.md`

---

## v2.3 Analysis Quality & Operational Stability (Shipped: 2026-07-01)

**Phases completed:** 5 phases (11-14.1), 12 plans, 25 tasks
**Timeline:** 2026-06-30 → 2026-07-01 (2 days)
**Changes:** 130 files changed (+12,786 / -7,720)
**Git range:** feat(11-01) → f3c85db

**Key accomplishments:**

- invest.md Step 2.0 に meeting-result.json → prev-highlighted-stocks.json 変換ロジックと、Round 1 全5エージェントへの「## 前日の推奨銘柄」セクション自動注入を実装
- invest.md Step 2e に Round 2 完了確認 Bash（D-06）、Round 3 起動ログ Bash（D-05）、各エージェント完了ログ Bash（D-05）を追加し、スコアリングラウンドのパイプライン進捗を可視化
- Structured pipeline step markers (START/OK/FAIL) added to invest.md for 6 steps, SHA256 HTML checksum protection added to run.sh, macOS notification verified via launchd logs
- Added `fetchVixHistory()` to market.ts, fetching 30-day ^VIX close history via yahoo-finance2's `chart()` API and threading it through `fetchAllMarketData()` as a new `vixHistory` field, with full TDD coverage for mapping, date formatting, and error tolerance.
- Pure `renderSectorBarChart` + `renderVixLineChart` SVG-string generators (no external chart library) with TDD RED/GREEN per function, matching the codebase's existing `formatXxxHtml` convention.
- Closed the RESEARCH.md data-plumbing gap: `tmp/market.json`'s `sectors`/`vixHistory` now flow through `loadMarketData()` into `generateDailyReportHtml`'s two new inline SVG chart sections (UI-02).
- Rewrote `updateIndexHtml()` from an append-only `<li>` marker-insert into a deterministic parse+merge+group+render pipeline producing a hero section plus month-grouped `<details>` accordions, and added the matching hero/accordion/responsive CSS to `docs/index.html`.
- Added `@media (max-width: 768px)` responsive block to the shared `generateBaseStyles()` (covering 3 of 5 report HTML surfaces) and to `docs/portfolio.html`'s inline stylesheet, with new unit test coverage and dark-theme regression checks.
- Fixed scripts/run.sh's single root-cause block (claude invocation lines 35-41) so STEP markers reach the log via `--output-format stream-json --verbose` and EXIT_CODE correctly propagates claude's real exit status via `EXIT_CODE=0` + `|| EXIT_CODE=$?`, plus failed-step-name notification and WR-01/WR-03 hardening.
- Closed two v2.3-audit-flagged gaps in invest.md's deploy step: added explicit FAIL handling for update-index.ts (D-08) and eliminated a shell-injection vector in git commit/push by switching from execSync string concatenation to validated spawnSync argument arrays (D-06/WR-04).

**Audit:** v2.3-MILESTONE-AUDIT.md — passed (10/10 requirements, 0 broken flows)

**Known deferred items at close:** 8 (Human-UAT / 実行時検証待ち — see STATE.md Deferred Items)

**Archive:** `.planning/milestones/v2.3-ROADMAP.md`, `.planning/milestones/v2.3-REQUIREMENTS.md`, `.planning/milestones/v2.3-MILESTONE-AUDIT.md`

---

## v2.0 Claude Code Migration (Shipped: 2026-06-25)

**Phases completed:** 4 phases, 7 plans
**Timeline:** 2026-06-24 → 2026-06-25
**Source:** 1,661 LOC (production TS) + 475 LOC (tests) + 1,204 LOC (skill definition)

**Key accomplishments:**

- `/invest` スキルコマンドでデータ収集→分析→レポート生成の全パイプラインを一発実行可能に
- 5アナリスト+モデレーターの3ラウンド並列ミーティングを Claude Code サブエージェントで実装
- WebSearch による注目銘柄リサーチと再評価ラウンドの統合
- Bloomberg風ダークテーマ HTML レポートジェネレータの TDD 実装（23テスト）
- Gemini API 依存の完全除去（10ファイル削除、@google/* 2パッケージ除去）

**Known deferred items at close:** 5 (see STATE.md Deferred Items)

**Archive:** `.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v2.0-REQUIREMENTS.md`

---
