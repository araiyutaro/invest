# Roadmap: Investment Agent

## Milestones

- ✅ **v2.0 Claude Code Migration** — Phases 1-4 (shipped 2026-06-25)
- ✅ **v2.1 Report Quality & Pipeline Overhaul** — Phases 5-7 (shipped 2026-06-25)
- ✅ **v2.2 News Quality & Pipeline Metrics** — Phases 8-10 (shipped 2026-06-28)
- ✅ **v2.3 Analysis Quality & Operational Stability** — Phases 11-14.1 (shipped 2026-07-01)
- 🚧 **v2.4 News Curation Report** — Phases 15-18 (in progress)

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

### 🚧 v2.4 News Curation Report (Phases 15-18) — In Progress

**Milestone Goal:** AIが厳選したニュースダイジェスト（news-digest.html）を4紙目のレポートとして日次パイプラインに追加する。既存 filter.ts のフィルタ済み記事プール（20〜80件）からAIが重要記事10〜15件をID参照方式で選定し、市場別グルーピング・重要度順・日本語解説コメント付きで、既存3レポートと同じBloomberg風ダークテーマに統合する。

- [x] **Phase 15: Curation Contract & Schema** - AIキュレーションの出力契約（ID参照方式・市場enum・ソフト件数制約）をzodスキーマとして定義し、幻覚URL・不正市場値を構造的に防止する (completed 2026-07-02)
- [x] **Phase 16: Report Generator (HTML Rendering)** - Phase 15の契約に基づき、news-digest.htmlの本文（記事一覧・市場別グルーピング・重要度バッジ・ティッカータグ・リード文）を既存ダークテーマで描画するピュア関数を実装する (completed 2026-07-02)
- [x] **Phase 17: Pipeline Integration & Orchestration** - キュレーションAgentステップと生成ロジックを日次パイプラインへfail-soft統合し、news-digest.htmlが4紙目として自動生成される (completed 2026-07-03)
- [ ] **Phase 18: Index/Nav Integration & Validation** - index.htmlのnews-digest.htmlリンクをファイル実在時のみ条件付きで出し分け、欠落日の404リンクを防止する

## Phase Details

### Phase 16: Report Generator (HTML Rendering)

**Goal**: Phase 15の契約に基づき、news-digest.htmlの本文が記事一覧・市場別グルーピング・重要度・関連ティッカー・リード文を含む形で、既存3レポートと同一のBloomberg風ダークテーマ・ナビゲーションで描画される
**Depends on**: Phase 15
**Requirements**: CURA-03, CURA-04, CURA-06, CURA-07, CURA-08, CURA-09, UI-03
**Success Criteria** (what must be TRUE):

  1. 生成されたHTMLの各記事に見出し・ソース名・公開時刻・元記事へのリンク（escapeHtml済みhref）が表示される
  2. 各記事に日本語の「なぜ重要か」解説コメント（1〜2文）が表示される
  3. 記事が市場別（米国株/日本株/グローバル）グループの中で重要度順に配列され、各記事にHigh/Medium/Lowバッジが同一スコアから導出されて表示される
  4. 各記事に関連ティッカータグが表示され、ページ冒頭に「今日の市場を動かすもの」の2〜3文のリード文が表示される
  5. news-digest.htmlが既存3レポートと同じダークテーマCSS・モバイル対応・レポート間ナビゲーションを持ち、キュレーションデータがnullの場合もグレースフルなフォールバック表示になる

**Plans**: 3 plans (Wave 1 → Wave 2; gap closure Wave 1)
- [x] 16-01-PLAN.md — 契約拡張（CuratedArticle.tickerNames）+ アクセントカラー追加（#8b5cf6） (CURA-08, UI-03)
- [x] 16-02-PLAN.md — news-digest レンダラー generateNewsDigestHtml（TDD: 3値フォールバック・市場別グルーピング・重要度バッジ・ティッカーピル・リード文・安全なhref） (CURA-03, CURA-04, CURA-06, CURA-07, CURA-08, CURA-09, UI-03)
- [x] 16-03-PLAN.md — ギャップクローズ: .ticker-pill/.news-meta CSS 定義追加 + 複数ティッカーピルの区切り修正（検証 Truth #5 ギャップ） (CURA-08)
**UI hint**: yes

### Phase 17: Pipeline Integration & Orchestration

**Goal**: news-digest.htmlが日次パイプライン（`/invest`）の実行により自動生成され、キュレーションステップの失敗が既存3レポートの生成・デプロイを妨げない
**Depends on**: Phase 16
**Requirements**: CURA-01, OPS-04
**Success Criteria** (what must be TRUE):

  1. `/invest`コマンド実行後、`docs/YYYY-MM-DD/`に`news-digest.html`が4紙目のレポートとして生成される
  2. キュレーションAgentステップが`tmp/news.json`（フィルタ済み20〜80件）を読み込み、`tmp/news-curation.json`をID参照方式で書き出す
  3. キュレーションステップを意図的に失敗させても（例: 不正JSON出力）、他の3レポート（daily-report / meeting-minutes / portfolio-report）は正常に生成されデプロイが完了する
  4. 失敗時にログへ`[STEP:news-digest:FAIL:...]`形式の専用マーカーが記録され、成功時は`[STEP:news-digest:OK]`が記録される

**Plans**: 2 plans (Wave 1 → Wave 2)
- [x] 17-01-PLAN.md — write-news-digest.ts CLIオーケストレーター（TDD: 正常/欠損/不正の3シナリオ、D-08フォールバック常時書き出し・D-10 exit codeシグナル） (CURA-01, OPS-04)
- [x] 17-02-PLAN.md — invest.md配線: Step 3d news-curator 2体並列追加（D-01〜D-07）+ Step 3e fail-soft起動・[STEP:news-digest:*]マーカー・metrics/timing（D-08〜D-11） (CURA-01, OPS-04)

### Phase 18: Index/Nav Integration & Validation

**Goal**: index.htmlの日付エントリがnews-digest.htmlの実在有無に応じて正確にリンクを出し分け、欠落日でも404リンクを生成しない
**Depends on**: Phase 17
**Requirements**: UI-04
**Success Criteria** (what must be TRUE):

  1. news-digest.htmlが生成された日付のindex.htmlエントリに、同ファイルへのリンクが追加される
  2. news-digest.htmlが生成されなかった日付（キュレーション失敗等）のindex.htmlエントリには、当該リンクが追加されない（404リンクなし）
  3. 既存3レポート（daily-report / meeting-minutes / portfolio-report）のリンク描画ロジックには回帰がない

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
| 18. Index/Nav Integration & Validation | v2.4 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-06-24*
*Milestone v2.0 shipped: 2026-06-25*
*Milestone v2.1 shipped: 2026-06-25*
*Milestone v2.2 shipped: 2026-06-28*
*Milestone v2.3 shipped: 2026-07-01*
*Milestone v2.4 started: 2026-07-02*
