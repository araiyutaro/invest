---
phase: 20-holding-card-news-display
plan: 01
subsystem: reporting
tags: [typescript, vitest, id-resolution, fail-soft, portfolio-news]

# Dependency graph
requires:
  - phase: 19-data-foundation-holding-news-supply
    provides: "tmp/holding-news.json (buildHoldingNewsMap 出力: 銘柄別ID参照 HoldingNewsFile) と tmp/news.json 記事プール契約"
provides:
  - "resolvePortfolioHoldingNews() — holding-news.json の ID参照を news.json プールと照合解決する純粋関数（幻覚URL防止の決定論的データ層）"
  - "normalizeHoldingSymbol() — 銘柄シンボル正規化（trim+toUpperCase）の単一情報源"
  - "ResolvedHoldingNewsItem 型（score を含まない、Wave 2 が消費する契約）"
  - "loadNewsPool() / loadHoldingNews() — tmp/*.json の fail-soft ローダー（[] / {}, no-throw）"
  - "safeHref() / formatPublishedAtJst() — report-utils.ts へ汎化された共通レンダリングヘルパー"
affects: [20-02, holding-card-news-display-wave2, portfolio-report-rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ID参照方式のリゾルバー: Map<id, poolEntry> による O(1) 照合 + 未知ID console.warn+drop（news-curation resolveNewsCuration と同一設計原理をholding-newsにも適用）"
    - "銘柄シンボル正規化の単一情報源関数（normalizeHoldingSymbol）をキー生成側・参照側で共有し表記揺れによるキー不一致を構造的に排除"
    - "fail-softローダー: try/catch + console.error + 空フォールバック（[] / {}）、既存 loadPortfolioAnalysis と同一shape"

key-files:
  created:
    - src/scripts/report-data-loaders.test.ts
  modified:
    - src/portfolio/holding-news.ts
    - src/portfolio/holding-news.test.ts
    - src/scripts/report-utils.ts
    - src/scripts/generate-news-digest.ts
    - src/scripts/report-data-loaders.ts

key-decisions:
  - "resolvePortfolioHoldingNews は holding-news.ts に配置（schemas.ts ではなく、型的凝集性を優先）"
  - "正規化キーは resolver 内で normalizeHoldingSymbol(symbol) を経由して代入し、Wave 2 の参照側にも同一関数の共有を強制する設計"
  - "loadNewsPool/loadHoldingNews は zod を使わず型アサーションのみ（自社TS生成物のため。write-news-digest.ts の前例踏襲）"

patterns-established:
  - "銘柄間ID混入防止: resolvePortfolioHoldingNews は Object.entries(holdingNews) を起点にループし、プールを独立再フィルタしない（Pitfall 5 の構造的排除）"

requirements-completed: [UI-05, UI-06]

# Metrics
duration: 12min
completed: 2026-07-03
---

# Phase 20 Plan 01: Holding-Card News Data Layer Summary

**決定論的な保有銘柄ニュース解決層（resolvePortfolioHoldingNews + normalizeHoldingSymbol + fail-softローダー）を追加し、Wave 2 が消費する契約を確定**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-03T17:21:48+09:00 (first task commit)
- **Completed:** 2026-07-03T17:24:05+09:00 (last task commit)
- **Tasks:** 3 completed
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `resolvePortfolioHoldingNews()` が holding-news.json（Phase 19 出力）と news.json プールを照合し、正常解決・未知IDドロップ+warn・銘柄間ID混入防止・供給順維持・no-throw を全て満たす純粋関数として実装された
- `normalizeHoldingSymbol()` が銘柄シンボル正規化の単一情報源として確立され、resolver のキー生成に組み込まれた（Wave 2 の参照側も同一関数を使うことで表記揺れによるキー不一致が構造的に防止される）
- `safeHref` / `formatPublishedAtJst` が news-digest 内から report-utils.ts へ汎化・export され、挙動不変のまま Wave 2 のレンダリング層が再利用可能になった
- `loadNewsPool()` / `loadHoldingNews()` が fail-soft ローダーとして追加され、tmp/*.json の欠損・パース失敗時も throw せず [] / {} を返す

## Task Commits

Each task was committed atomically (TDD tasks have separate RED/GREEN commits):

1. **Task 1: normalizeHoldingSymbol() + resolvePortfolioHoldingNews() と ResolvedHoldingNewsItem 型を追加**
   - `fdac830` (test) — RED: 正規化キー生成・正常解決・未知IDドロップ・銘柄間ID混入防止・供給順維持・no-throw の失敗テスト追加
   - `2d15d7a` (feat) — GREEN: 実装追加、全27テストgreen
2. **Task 2: safeHref / formatPublishedAtJst を report-utils.ts へ汎化（挙動不変リファクタ）**
   - `9488ac9` (refactor) — report-utils.ts へ移設+export、generate-news-digest.ts から import に統合、既存14テスト無変更でgreen
3. **Task 3: loadNewsPool() / loadHoldingNews() fail-soft ローダーと新規テスト**
   - `fe9e88f` (test) — RED: 正常系/ENOENT/パース失敗系の失敗テスト追加（新規ファイル）
   - `f8967d6` (feat) — GREEN: 実装追加、全6テストgreen

**Plan metadata:** (this commit, docs: complete plan)

_Note: Task 1 and Task 3 are TDD tasks with separate test → feat commits. Task 2 is a pure refactor (no tdd flag)._

## Files Created/Modified
- `src/portfolio/holding-news.ts` - `normalizeHoldingSymbol()`, `resolvePortfolioHoldingNews()`, `ResolvedHoldingNewsItem` 型を追加
- `src/portfolio/holding-news.test.ts` - 上記3項目のユニットテスト（27テスト、うち新規16件）を追加
- `src/scripts/report-utils.ts` - `safeHref()` / `formatPublishedAtJst()` を export 付きで追加
- `src/scripts/generate-news-digest.ts` - ローカル定義を削除し report-utils.js から import するよう変更
- `src/scripts/report-data-loaders.ts` - `loadNewsPool()` / `loadHoldingNews()` fail-soft ローダーを追加
- `src/scripts/report-data-loaders.test.ts` - 新規ファイル。両ローダーの正常系/欠損系/パース失敗系テスト（6テスト）

## Decisions Made
- `resolvePortfolioHoldingNews` は `schemas.ts` ではなく `holding-news.ts` に配置（型的凝集性を優先。RESEARCH.md Open Questions Q1 RESOLVED を踏襲）
- resolver の結果キー代入は必ず `normalizeHoldingSymbol(symbol)` を経由させ、生の symbol を直接キーにしない実装とした（Wave 2 の参照側との構造的整合性を保証するため）
- `loadNewsPool`/`loadHoldingNews` は zod を使わず型アサーションのみ（自社TS生成物のため。`write-news-digest.ts` の news.json 読込前例を踏襲、RESEARCH.md Pattern 2）

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npx tsc --noEmit` で `src/scripts/collect-data.test.ts` に4件の既存TSエラー（`TS7006: implicitly has an 'any' type`）が検出されたが、本プランのタスクが触れていないファイルであり Phase 15 (`cfe6b3b`) 由来の既存issueのため対象外（scope boundary）。`.planning/phases/20-holding-card-news-display/deferred-items.md` に記録済み。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 2（レンダリング/配線層）が消費できる契約が確定: `ResolvedHoldingNewsItem` 型、`resolvePortfolioHoldingNews()`/`normalizeHoldingSymbol()`/`loadNewsPool()`/`loadHoldingNews()`/`safeHref()`/`formatPublishedAtJst()` の関数シグネチャすべて実装済み・全222テストgreen
- `generatePortfolioReportHtml` への `resolvedHoldingNews` 引数追加と `formatHoldingEvaluationsHtml` でのニュースサブセクション描画は Wave 2 の作業範囲（本プランはインターフェースファーストでデータ層のみ完結）
- 既存の `deferred-items.md`（collect-data.test.ts の pre-existing tsc エラー4件）は Wave 2 の作業に影響しないため、そのまま持ち越し

---
*Phase: 20-holding-card-news-display*
*Completed: 2026-07-03*
