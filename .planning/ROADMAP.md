# Roadmap: Investment Agent

## Milestones

- ✅ **v2.0 Claude Code Migration** — Phases 1-4 (shipped 2026-06-25)
- 🚧 **v2.1 Report Quality & Pipeline Overhaul** — Phases 5-7 (in progress)

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

### 🚧 v2.1 Report Quality & Pipeline Overhaul (In Progress)

**Milestone Goal:** v1.0品質の3レポート構成を復元し、新規銘柄発掘とポートフォリオ管理を分離、GitHub Pagesへの自動デプロイを実現する。

- [x] **Phase 5: Analysis Engine Overhaul** - アナリストが独立した銘柄発掘と詳細散文分析を行う能力を確立する
- [ ] **Phase 6: 3-Report Structure** - generate-report.tsが Daily Report / Meeting Minutes / Portfolio Report の3ファイルを docs/ に出力する
- [ ] **Phase 7: Portfolio Integration & Deployment** - ポートフォリオ評価、Daily Reportとの統合、自動git pushによるGitHub Pagesデプロイを完成させる

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
- [ ] 06-01: RPT-04/PIPE-03 — generate-report.tsの3ファイル出力リファクタリングと docs/ 出力先変更
- [ ] 06-02: RPT-01/02 — Daily Report・Meeting Minutes HTMLテンプレートの実装
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
- [ ] 07-01: PORT-01/02/03/RPT-03 — Portfolio Report生成ロジックとHTMLテンプレートの実装
- [ ] 07-02: PIPE-01/02 — 自動git push統合と /invest コマンド最終調整
**UI hint**: yes

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Data Layer + Skill Foundation | v2.0 | 2/2 | Complete | 2026-06-24 |
| 2. Analyst Subagents | v2.0 | 2/2 | Complete | 2026-06-24 |
| 3. Report Builder + WebSearch Research | v2.0 | 2/2 | Complete | 2026-06-25 |
| 4. Gemini Cleanup | v2.0 | 1/1 | Complete | 2026-06-25 |
| 5. Analysis Engine Overhaul | v2.1 | 2/2 | Complete | 2026-06-25 |
| 6. 3-Report Structure | v2.1 | 0/2 | Not started | - |
| 7. Portfolio Integration & Deployment | v2.1 | 0/2 | Not started | - |

---
*Roadmap created: 2026-06-24*
*Milestone v2.0 shipped: 2026-06-25*
*Milestone v2.1 started: 2026-06-25*
