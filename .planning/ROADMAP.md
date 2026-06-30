# Roadmap: Investment Agent

## Milestones

- ✅ **v2.0 Claude Code Migration** — Phases 1-4 (shipped 2026-06-25)
- ✅ **v2.1 Report Quality & Pipeline Overhaul** — Phases 5-7 (shipped 2026-06-25)
- ✅ **v2.2 News Quality & Pipeline Metrics** — Phases 8-10 (shipped 2026-06-28)
- [ ] **v2.3 Analysis Quality & Operational Stability** — Phases 11-14 (in progress)

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

### v2.3 Analysis Quality & Operational Stability (Phases 11-14)

ニュース品質・分析品質・運用安定性・レポートUIを総合的に底上げし、毎日の自動実行パイプラインの信頼性と出力品質を向上させる。

- [x] **Phase 11: News Quality Enhancements** - Finnhubティッカー別取得・時間重み付け・クロス言語dedup (completed 2026-06-30)
- [ ] **Phase 12: Analysis Quality** - 前日レポート注入・スコアリング並列エージェント化
- [ ] **Phase 13: Operational Stability** - エラーログ・HTML保護・macOS通知検証
- [ ] **Phase 14: Report UI** - index.htmlモバイル対応・インラインチャート追加

## Phase Details

### Phase 5: Analysis Engine Overhaul

**Goal**: アナリストがポートフォリオとは独立してニュース・市況から注目銘柄を発掘し、各自が複数段落の詳細な散文分析を生成できる
**Depends on**: Phase 4 (Gemini cleanup complete)
**Requirements**: ANL-01, ANL-02, ANL-03, ANL-04
**Success Criteria** (what must be TRUE):

  1. アナリストがポートフォリオ保有銘柄とは無関係に、ニュース・市況から新規の注目銘柄を1〜3銘柄推奨できる
  2. Round 1分析がJSONの圧縮テキストではなく、各アナリスト固有の視点を持つ複数段落の散文として出力される
  3. Round 2ディスカッションでアナリスト間が互いの主張に言及した具体的な反論・支持を行う
  4. Daily Reportのスコアリングセクションに各アナリストのコメント付きスコア表が表示される

**Plans**: 2 plans

Plans:

- [x] 05-01: ANL-01/02 — 新規銘柄発掘ロジックと詳細散文分析プロンプトの実装
- [x] 05-02: ANL-03/04 — Round 2実質ディスカッションとスコアリングマトリクスの実装

### Phase 6: 3-Report Structure

**Goal**: generate-report.tsが3つの独立したHTMLファイルを docs/YYYY-MM-DD/ に生成し、Daily Report と Meeting Minutes が完全な内容で出力される
**Depends on**: Phase 5
**Requirements**: RPT-01, RPT-02, RPT-04, PIPE-03
**Success Criteria** (what must be TRUE):

  1. `/invest` コマンド実行後、`docs/YYYY-MM-DD/` ディレクトリに `daily-report.html`、`meeting-minutes.html`、`portfolio-report.html` の3ファイルが生成される
  2. Daily Report HTMLがPhase 5の独立銘柄推奨とスコアリング表を含む
  3. Meeting Minutes HTMLが各アナリストの詳細散文分析を完全な長さで表示する（JSON圧縮ではない）
  4. 既存のBloomberg風ダークテーマデザインが3ファイルすべてに維持されている

**Plans**: 2 plans

Plans:

- [x] 06-01: RPT-04/PIPE-03 — generate-report.tsの3ファイル出力リファクタリングと docs/ 出力先変更
- [x] 06-02: RPT-01/02 — Daily Report・Meeting Minutes HTMLテンプレートの実装

**UI hint**: yes

### Phase 7: Portfolio Integration & Deployment

**Goal**: Portfolio Reportがデイリーレポートの推奨銘柄を統合評価し、保有銘柄への判断とリバランス提案を含む。レポート生成後に自動でGitHub Pagesへデプロイされる
**Depends on**: Phase 6
**Requirements**: RPT-03, ANL-01, PORT-01, PORT-02, PORT-03, PIPE-01, PIPE-02
**Success Criteria** (what must be TRUE):

  1. Portfolio Report HTMLが各保有銘柄に対して「保持/買増/一部売却/全売却」の判断と根拠を表示する
  2. Portfolio ReportがDaily Reportで推奨された銘柄を「新規組入候補」として評価するセクションを含む
  3. リバランス提案セクションに具体的なアクションアイテム（例: 「XYZを5%まで買増し、ABCを全売却」）が提示される
  4. レポート生成完了後に自動で `git add docs/ && git commit && git push` が実行され、コンソールに成功メッセージが表示される
  5. `/invest` スキルコマンドが3レポートパイプライン全体（データ収集→分析→レポート生成→git push）を1コマンドで実行できる

**Plans**: 2 plans

Plans:

- [x] 07-01: PORT-01/02/03/RPT-03 — Portfolio Report生成ロジックとHTMLテンプレートの実装
- [x] 07-02: PIPE-01/02 — 自動git push統合と /invest コマンド最終調整

**UI hint**: yes

### Phase 8: News Filter Module

**Goal**: クロスソース重複排除・関連性フィルタ・時間フィルタを一元管理するピュア関数モジュール `src/data/news/filter.ts` をTDDで構築し、単体テストで動作を保証する
**Depends on**: Phase 7
**Requirements**: DEDUP-01, DEDUP-02, DEDUP-03, FILT-01, FILT-02
**Success Criteria** (what must be TRUE):

  1. 異なるソース（Finnhub/Google News/RSS）から届いた同一URLの記事が1件に集約される
  2. NFKC正規化後にJaccard類似度 ≥ 0.75 の類似タイトルを持つ記事が1件に集約される（「【速報】〜」と「〜」が同一視される）
  3. 「スポーツ選手が優勝」のような非投資記事はdenylistで除外され、「スポーツ用品株が高騰」はdenylistで除外されない
  4. 全ソースで24時間以上前の記事が除外される
  5. rss-sources.ts の50文字プレフィックスdedupが削除され、NFKC正規化+Jaccardに統一されている

**Plans**: 2 plans

Plans:
**Wave 1**

- [x] 08-01-PLAN.md — 型定義・URL dedup・タイトルJaccard dedup の TDD 実装 (DEDUP-01/02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-02-PLAN.md — 関連性denylistフィルタ・24時間時間フィルタの TDD 実装と rss-sources.ts dedup 削除 (DEDUP-03/FILT-01/02)

### Phase 9: Pipeline Integration

**Goal**: filter.ts を collect-data.ts と invest.md に統合し、フィルタ済み記事（MIN=20, MAX=80件）のみが tmp/news.json に書き込まれ、アナリストに供給される
**Depends on**: Phase 8
**Requirements**: INTG-01, INTG-02, FILT-03, FILT-04
**Success Criteria** (what must be TRUE):

  1. `collect-data.ts` 実行後に `tmp/news.json` にはフィルタ済み記事のみが保存される（非投資記事・重複記事なし）
  2. コンソールに「生記事数 → dedup後 → フィルタ後」の3段階の記事数統計がログ出力される
  3. アナリストへの記事供給数が50件固定ではなく、フィルタ後の実数（MIN=20, MAX=80）になっている
  4. invest.md 内の `slice(0, 50)` や「最新50件」などのハードコードが除去されている

**Plans**: 1 plan

Plans:

- [x] 09-01: INTG-01/FILT-03/04 — collect-data.ts への filter.ts 統合・記事数フロア/シーリング・統計ログ実装
- [x] 09-02: INTG-02 — invest.md の50件ハードキャップ除去とフィルタ済み全記事供給

### Phase 10: Pipeline Timing

**Goal**: `/invest` コマンドの最終出力にパイプライン全体とステップ別の実行時間が表示される
**Depends on**: Phase 9
**Requirements**: METR-01, METR-02
**Success Criteria** (what must be TRUE):

  1. `/invest` コマンドの最終出力にパイプライン全体の実行時間が表示される（例: `Total: 4m 23s`）
  2. データ収集・Round 1分析・Round 2分析・レポート生成・デプロイの各ステップ別実行時間が最終出力に表示される

**Plans**: 1 plan

Plans:

- [x] 10-01: METR-01/02 — performance.now() 計測・tmp/pipeline-metrics.json 書き出し・invest.md 最終表示の実装

### Phase 11: News Quality Enhancements

**Goal**: アナリストに供給されるニュースが銘柄別Finnhubデータ・時間重み付け・クロス言語dedupによって品質向上する
**Depends on**: Phase 10
**Requirements**: NEWS-01, NEWS-02, NEWS-03
**Success Criteria** (what must be TRUE):

  1. Finnhub APIがポートフォリオ保有ティッカー（例: AAPL, MSFT）ごとのカンパニーニュースを取得し、汎用ニュースと統合されてtmp/news.jsonに保存される
  2. 直近6時間以内のニュース記事が優先スコアを持ち、古い記事より上位に配置されてアナリストに渡される
  3. 英語と日本語で同内容の記事（例: Reuters英語版とロイター日本語版）がクロス言語dedupで1件に集約される

**Plans**: 2 plans

Plans:

- [x] 11-01: NEWS-01/NEWS-02 — Finnhubティッカー別カンパニーニュース取得と時間重み付けスコアリング
- [x] 11-02: NEWS-03 — クロス言語（英日）重複排除

### Phase 12: Analysis Quality

**Goal**: アナリストが前日の推奨銘柄を追跡した継続的な議論を行い、Round 3スコアリングが専用並列エージェントで高速実行される
**Depends on**: Phase 11
**Requirements**: ANLQ-01, ANLQ-02
**Success Criteria** (what must be TRUE):

  1. Round 1のアナリストプロンプトに前日のmeeting-result.jsonの内容が含まれ、前日推奨銘柄への見解変化がアナリスト発言に明示的に現れる
  2. Round 3スコアリングが5つの専用並列エージェントとして起動され、Round 2の全アナリスト応答完了後に実行される
  3. パイプライン実行ログにRound 3の並列起動確認と各エージェントの完了メッセージが表示される

**Plans**: TBD

### Phase 13: Operational Stability

**Goal**: 自動実行パイプラインが障害時に失敗ステップを特定できるログを出力し、重要HTMLファイルが保護され、macOS通知で進捗が確認できる
**Depends on**: Phase 12
**Requirements**: OPS-01, OPS-02, OPS-03
**Success Criteria** (what must be TRUE):

  1. パイプラインが途中失敗した場合、logs/pipeline-YYYY-MM-DD.logに失敗ステップ名・エラーメッセージ・スタックトレースが記録される
  2. docs/index.htmlおよびdocs/portfolio.htmlがスクリプト外（手動編集・auto-run等）からの変更を防ぐ保護機構が機能している
  3. macOS通知でパイプライン開始・完了・失敗が報告される（terminal-notifierの動作がlaunchd環境で検証済み）

**Plans**: TBD

### Phase 14: Report UI

**Goal**: index.htmlがモバイル端末でも快適に閲覧でき、Daily ReportにVIX・セクターパフォーマンス等のビジュアルチャートが追加される
**Depends on**: Phase 13
**Requirements**: UI-01, UI-02
**Success Criteria** (what must be TRUE):

  1. index.htmlがモバイル端末（375px幅）で崩れずに表示され、リンク・テキストが読みやすいサイズで閲覧できる
  2. Daily ReportにVIX推移・セクターパフォーマンスのインラインチャート（SVGまたはCSSベース）が表示される
  3. 既存のBloomberg風ダークテーマが維持されながらモダンなデザインに刷新されている

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
| 9. Pipeline Integration | v2.2 | 2/2 | Complete   | 2026-06-28 |
| 10. Pipeline Timing | v2.2 | 1/1 | Complete    | 2026-06-28 |
| 11. News Quality Enhancements | v2.3 | 2/2 | Complete    | 2026-06-30 |
| 12. Analysis Quality | v2.3 | 0/? | Not started | - |
| 13. Operational Stability | v2.3 | 0/? | Not started | - |
| 14. Report UI | v2.3 | 0/? | Not started | - |

---
*Roadmap created: 2026-06-24*
*Milestone v2.0 shipped: 2026-06-25*
*Milestone v2.1 shipped: 2026-06-25*
*Milestone v2.2 shipped: 2026-06-28*
*Milestone v2.3 started: 2026-06-30*
