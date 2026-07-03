---
phase: 19-data-foundation-holding-news-supply
plan: 03
subsystem: pipeline+prompt
tags: [collect-data, portfolio-analyst, prompt-engineering, fail-soft, id-reference]

# Dependency graph
requires:
  - phase: 19-01
    provides: "index-as-ticker汚染バグ修正済みのfetchNewsByCategory（マッチング精度の土台）"
  - phase: 19-02
    provides: "buildHoldingNewsMap(articles, holdings): 決定論的な保有銘柄別ニュース抽出（純粋関数）"
provides:
  - "tmp/holding-news.json 生成（collect-data.tsパイプライン統合、fail-soft付き）"
  - "portfolio-analystプロンプトの「## 保有銘柄別関連ニュース」入力セクション（ID参照解決・全12銘柄列挙・0件明示・ガード指示・条件付きゲート）"
affects: [phase-20-holding-card-news-display, phase-22-portfolio-analyst-re-evaluation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "news.json と holding-news.json は同一try/catchブロック内で生成する（idArticlesへのhard dependency、D-06）"
    - "fail-soft二層防御: TS側catchブランチで全キー空配列マップを必ず書く（D-08） + プロンプト側で条件付き存在ゲートによりファイル欠損時もセクション省略で続行"
    - "プロンプトへのニュース注入はID参照方式を徹底（URL除外）し、TS側解決済みデータではなくLLM自身にtmp/news.jsonとの照合を指示することでURL幻覚を防止"

key-files:
  created: []
  modified:
    - src/scripts/collect-data.ts
    - .claude/commands/invest.md

key-decisions:
  - "holding-news.json生成はnews.json書き出しと同じtryブロック内に配置（idArticlesが同ブロック内でのみスコープを持つため、hard dependencyを素直に表現）"
  - "catchブランチのフォールバックはObject.fromEntries(PORTFOLIO_HOLDINGS.map((h) => [h.symbol, []]))で全12銘柄キーを保証し、既存のnews.json='[]'/portfolio.json='[]'パターンとは異なる形状（全キー空配列オブジェクト）を意図的に採用（D-08準拠、ダウンストリームでkeyアクセスがthrowしないことを保証）"
  - "invest.mdの新セクションはprev-highlighted-stocks.jsonの条件付きゲート文言（存在する場合のみ／存在しない場合は省略）をそのまま踏襲し、新規パターンを導入しない"
  - "URL除外の徹底方法はnews-curatorの前例（TS側解決・LLMはID参照のみ）と非対称: 本セクションはLLM（portfolio-analyst）自身がtmp/news.jsonとholding-news.jsonを突き合わせて解決する設計（プランのinterfaces節の明示指定通り）。二重の重要:太字ガードでURL/タイトル創作を明示的に禁止"

requirements-completed: [PORT-01]

# Metrics
duration: 17min
completed: 2026-07-03
---

# Phase 19 Plan 03: Holding-News Pipeline Integration & Prompt Injection Summary

**Plan 02のbuildHoldingNewsMapをcollect-data.tsに配線してtmp/holding-news.jsonを生成し、portfolio-analystプロンプトにID参照解決・全12銘柄列挙・創作禁止ガード・条件付きゲート付きの保有銘柄別ニュース入力セクションを追加してPORT-01を完結**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-03T05:39:00Z (worktree checkout)
- **Completed:** 2026-07-03T05:56:01Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `src/scripts/collect-data.ts` に `buildHoldingNewsMap` の呼び出しを統合し、news.json書き出し直後の同一tryブロック内で `tmp/holding-news.json` を12銘柄キーで生成（D-05/D-06）
- ニュース収集失敗時のcatchブランチを拡張し、全12銘柄が空配列の `holding-news.json` を必ず書くfail-soft経路を追加（D-08）
- `.claude/commands/invest.md` のportfolio-analystが読み込むファイルリストに `tmp/holding-news.json` を追加
- portfolio-analystプロンプト本体に「## 保有銘柄別関連ニュース」セクションを新設: tmp/news.jsonとのID照合による解決済み全文埋め込み（title/summary/source/publishedAt、URL除外、D-07）、全12銘柄必須列挙+0件銘柄への明示的「本日の関連ニュースなし」記載（D-11）、ニュースなし銘柄への言及禁止・創作禁止のガード指示（D-12）、tmp/holding-news.json欠損時にセクション全体を省略する条件付きゲート（D-08二層防御）を実装
- JSON出力フォーマット（overallComment/decision/rationale/riskNote等のフィールド名）は変更なし

## Task Commits

Each task was committed atomically:

1. **Task 1: collect-data.ts統合（fail-soft付き）** - `2f7eea3` (feat)
2. **Task 2: portfolio-analystプロンプトへのニュース入力セクション追加** - `901340c` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/scripts/collect-data.ts` - import追加（`buildHoldingNewsMap` from `../portfolio/holding-news.js`）、news.json書き出し直後に`holding-news.json`生成、catchブランチに全キー空配列フォールバックを追加
- `.claude/commands/invest.md` - Step 3d portfolio-analystのReadリストに`tmp/holding-news.json`追加、「## 保有銘柄別関連ニュース」セクション新設（条件付きゲート・ID参照解決指示・全12銘柄列挙規約・0件明示・創作禁止ガードの4要素を含む）

## Decisions Made
- holding-news.json生成をnews.jsonと同一tryブロックに配置（idArticlesスコープの制約を素直に反映、プラン指定通り）
- フォールバックマップの形状を意図的に「全キー空配列オブジェクト」とし、既存の`news.json`/`portfolio.json`の`"[]"`単純フォールバックと区別（ダウンストリームの`holdingNews[symbol]`アクセスがundefinedにならないことを保証）
- invest.mdの新セクションは既存のprev-highlighted-stocks.json条件付きゲート文言をそのまま再利用し、プロンプト内に新規パターンを増やさない設計判断を維持

## Deviations from Plan

None - plan executed exactly as written. Task 1のimport/統合位置、Task 2のセクション構成（読み込みリスト追加＋条件付きゲート＋ID参照解決指示＋全12銘柄列挙＋創作禁止ガード）はプランのaction指示・acceptance_criteriaに沿って実装済み。

## Issues Encountered

`npx tsc --noEmit -p tsconfig.json` の全体実行で `src/scripts/collect-data.test.ts:297,299,358,360` の暗黙的any型エラーが検出されたが、19-02実行時に既に `deferred-items.md` へ記録済みの既存問題（本プランのfiles_modified: `collect-data.ts` / `invest.md` には無関係）であることを再確認した。スコープ外のため修正せず。`npx vitest run` は全206件green（`collect-data.test.ts`単体14件含む）で、本プランの変更による回帰なし。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PORT-01「portfolio-analystが保有銘柄別関連ニュースを入力として受け取る」要件が本プランで完結（19-02の抽出コア + 19-03のパイプライン統合・プロンプト注入）
- Phase 20（保有銘柄カードへの関連ニュース表示、UI-05/06）は `tmp/holding-news.json` の生成が完了したことでデータ供給依存を解消済み
- ブロッカーなし。実行時検証（`collect-data`の実行によるtmp/holding-news.json生成確認、portfolio-analystの実出力確認）はHuman-UATもしくは次フェーズのライブ検証で実施予定（静的解析・ユニットテストレベルでは本プランの範囲を完了）

---
*Phase: 19-data-foundation-holding-news-supply*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: src/scripts/collect-data.ts
- FOUND: .claude/commands/invest.md
- FOUND: .planning/phases/19-data-foundation-holding-news-supply/19-03-SUMMARY.md
- FOUND commit: 2f7eea3 (feat, Task 1)
- FOUND commit: 901340c (feat, Task 2)
- FOUND commit: c91de2e (docs, plan metadata)
