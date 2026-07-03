---
phase: 19-data-foundation-holding-news-supply
plan: 02
subsystem: portfolio
tags: [typescript, vitest, tdd, pure-functions, news-matching]

# Dependency graph
requires:
  - phase: 19-01 (this phase, wave 1 sibling)
    provides: "finnhub.ts ticker汚染バグ修正（article.ticker が general/merger 記事で undefined になる、本モジュールの入力データ品質に影響）"
provides:
  - "buildHoldingNewsMap(articles, holdings): 決定論的な保有銘柄別ニュース抽出（純粋関数、ID参照+マッチメタのみ出力）"
  - "matchesTicker / matchesHoldingByName: ticker一致 + 社名フォールバック（タイトルのみ、全12銘柄均一）"
  - "PortfolioHolding.matchAliases: 人間キュレーション済み追加エイリアス（Joby, 名古屋銀）"
affects: [19-03, phase-20-holding-card-news-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "純粋関数分割 + TDD（filter.ts / article-id.ts の前例を踏襲）"
    - "タイトルのみ照合（summary除外）でsummary言及の誤マッチを構造的に防止"
    - "ID参照 + マッチメタ方式（記事本体を保存せず、ticker/name/aliasとスコアのみ保持）"

key-files:
  created:
    - src/portfolio/holding-news.ts
    - src/portfolio/holding-news.test.ts
  modified:
    - src/portfolio/holdings.ts

key-decisions:
  - "matchType 'name'/'alias' の区別は resolveNameMatchType 内部ヘルパーで解決（name/nameJaを先に評価、次にmatchAliasesを評価）し、公開APIの matchesHoldingByName はブール値のみ返す設計に統一（プランのインターフェース指定通り）"
  - "上限超過時の切り捨ては ticker一致グループ・name/alias一致グループをそれぞれスコア降順にソートしてから連結し先頭5件を採用（D-10の『ticker優先→同格はスコア順』を素直に表現）"
  - "buildHoldingNewsMap は Date.now() を内部で1回呼び出し、全12銘柄で同一のnowを共有（時間経過による銘柄間スコアのブレを防止）"

patterns-established:
  - "保有銘柄別ニュース抽出は src/portfolio/ 配下の純粋関数モジュールとして実装し、src/data/news/filter.ts の calculatePriorityScore を再利用（スコアリングロジックの重複実装を禁止）"

requirements-completed: []  # PORT-01は19-03（collect-data.ts統合 + プロンプト注入）完了まで未充足。19-02は抽出コアのみ担当のため未マーク。

# Metrics
duration: 8min
completed: 2026-07-03
---

# Phase 19 Plan 02: Holding-News Extraction Module Summary

**決定論的な保有銘柄別ニュース抽出モジュール `holding-news.ts` を TDD で新規実装し、ticker一致優先+タイトルのみ社名フォールバック（matchAliases含む）+上限5件切り捨てをユニットテスト17件でカバー**

## Performance

- **Duration:** 8 min (14:42 〜 14:49 JST)
- **Started:** 2026-07-03T05:42:48Z
- **Completed:** 2026-07-03T05:49:55Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments
- `PortfolioHolding` に任意の `matchAliases` フィールドを追加し、JOBY (`["Joby"]`) / 8522.T (`["名古屋銀"]`) にキュレーション済みエイリアスを付与。POWL は "Powell" とFRB議長の衝突を避け未登録のまま
- `src/portfolio/holding-news.ts` を新規実装: `matchesTicker` / `matchesHoldingByName` / `matchArticlesForHolding` / `rankAndCapHoldingArticles` / `buildHoldingNewsMap` の5関数構成。すべて純粋関数・入力配列を変更しない
- ticker一致（D-01）を社名一致より優先し、社名フォールバックはタイトルのみ照合（D-03）で全12銘柄に均一適用（D-02）
- 1銘柄あたり最大5件への切り捨て（D-09）で、上限超過時は ticker一致を必ず残し、同格は `calculatePriorityScore`（`filter.ts` から再利用、再実装なし）降順でtie-break（D-10）
- fail-soft設計（D-08）: 記事が空でも常に全12銘柄のキーを持つマップを返し、throwしない
- TDD RED→GREENサイクルで17件のユニットテストを実装、全て green。既存 suite（205件）も引き続き green

## Task Commits

Each task was committed atomically:

1. **Task 1: PORTFOLIO_HOLDINGS に matchAliases フィールドを追加（D-04）** - `7939217` (feat)
2. **Task 2 RED: holding-news.test.ts に失敗テストを追加** - `322f4af` (test)
3. **Task 2 GREEN: holding-news.ts を実装** - `bd79c31` (feat)

**Plan metadata:** (this commit, pending)

_Note: Task 2 is a TDD task — RED (test) and GREEN (feat) commits are separate as required. No REFACTOR commit was needed; the implementation matched the article-id.ts/filter.ts analog shape on first pass._

## Files Created/Modified
- `src/portfolio/holdings.ts` - `PortfolioHolding` interface に任意 `matchAliases?: ReadonlyArray<string>` を追加。JOBY/8522.Tにエイリアス付与
- `src/portfolio/holding-news.ts` (NEW, 150行) - `buildHoldingNewsMap` を頂点とする純粋関数群。`calculatePriorityScore` を `filter.ts` からインポートして再利用
- `src/portfolio/holding-news.test.ts` (NEW, 219行) - D-01〜D-10を網羅する17テストケース。fixture-builder（`makeArticleWithId`, `makeHolding`）+ describe-per-concernパターン

## Decisions Made
- `matchesHoldingByName` は仕様通りブール値のみを返す公開APIとし、matchType（"name" vs "alias"）の内部判別は非公開ヘルパー `resolveNameMatchType` に分離。これにより外部インターフェース（プランの `exports` 指定）を変更せずに `matchArticlesForHolding` 内でのみ matchType を解決できる
- 大文字小文字を区別しないタイトル部分一致（`toLowerCase()`比較）を採用。英字エイリアス（"Joby"）と日本語エイリアス（"名古屋銀"）を同一ロジックで扱うため
- 上限切り捨てロジックは「ticker一致グループを先に並べ、name/alias一致グループを後に連結してからslice」という単純な形にし、D-10の「ticker優先→同格はスコア順」という自然言語仕様をそのままコードに落とし込んだ（複雑な優先度合成ロジックを避けた）

## Deviations from Plan

None - plan executed exactly as written. Task 1 と Task 2（TDD RED→GREEN）はプラン記載のインターフェース・関数分割・テストケースに沿って実装済み。REFACTORフェーズは不要だった（既存アナログ`article-id.ts`/`filter.ts`の形をなぞって書いたため、GREEN到達時点で既にクリーンな構造）。

## Issues Encountered

`npx tsc --noEmit -p tsconfig.json` の全体実行では `src/data/news/finnhub.ts:43`（NEWS-04、plan 19-01のスコープ）と `src/scripts/collect-data.test.ts` の暗黙的any型エラーが検出されたが、いずれも本プランのfiles_modified（`holdings.ts` / `holding-news.ts` / `holding-news.test.ts`）に無関係な既存の問題であることを確認済み（scoped grepで本プランのファイルにはエラーなしと確認）。Scope Boundary原則に従い修正せず、`.planning/phases/19-data-foundation-holding-news-supply/deferred-items.md` に記録した。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `buildHoldingNewsMap` / `matchesTicker` / `matchesHoldingByName` はプラン19-03から直接インポート可能（`import { buildHoldingNewsMap } from "../portfolio/holding-news.js";`）
- `PortfolioHolding.matchAliases` は 19-03 のcollect-data.ts統合時にも自動的に反映される（PORTFOLIO_HOLDINGS経由）
- PORT-01要件は本プラン単独では未充足（抽出コアのみ）。19-03（collect-data.ts統合 + invest.md Step 3dへのプロンプト注入）完了時点で要件充足・REQUIREMENTS.mdマーク完了とすべき
- ブロッカーなし。19-03は本プラン(19-02)と19-01の両方に依存（`depends_on: [19-01, 19-02]`）

---
*Phase: 19-data-foundation-holding-news-supply*
*Completed: 2026-07-03*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all 4 task/summary commit hashes (7939217, 322f4af, bd79c31, 5ef33de) confirmed present in git log.
