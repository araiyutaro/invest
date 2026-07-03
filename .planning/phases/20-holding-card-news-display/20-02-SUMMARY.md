---
phase: 20-holding-card-news-display
plan: 02
subsystem: reporting
tags: [typescript, vitest, html-rendering, portfolio-report, holding-card-news]

# Dependency graph
requires:
  - phase: 20-holding-card-news-display (plan 01)
    provides: "resolvePortfolioHoldingNews()/normalizeHoldingSymbol()/ResolvedHoldingNewsItem/loadNewsPool()/loadHoldingNews()/safeHref()/formatPublishedAtJst()"
provides:
  - "formatHoldingNewsSectionHtml()/formatHoldingNewsItemHtml() — 保有銘柄カードの関連ニュースサブセクション描画（複数件/0件空状態/社名一致バッジ/安全リンク）"
  - "generatePortfolioReportHtml(result, portfolioAnalysis, resolvedHoldingNews = {}) — 後方互換の3引数シグネチャ"
  - "generate-report.ts main() 配線済みパイプライン: loadNewsPool/loadHoldingNews → resolvePortfolioHoldingNews → generatePortfolioReportHtml"
affects: [portfolio-report-rendering, docs-portfolio-report-html]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Heading always shown, body swaps on empty（formatMarketGroupsHtml と同一パターン。formatRebalanceActionsHtml/formatNewCandidatesHtml の空文字列返却アンチパターンは踏襲しない）"
    - "参照側キー正規化: resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)] ?? [] でリゾルバー側と同一正規化を強制しキー不一致を構造的に排除"
    - "後方互換デフォルト引数（generate-daily-report.ts の marketData パターン踏襲）"

key-files:
  created: []
  modified:
    - src/scripts/generate-portfolio-report.ts
    - src/scripts/generate-report.test.ts
    - src/scripts/generate-report.ts

key-decisions:
  - "サブセクション見出しは <h4> ではなく <p> タグを使用（.agent-card h4 グローバルルールとの衝突回避、UI-SPEC制約2）"
  - "カードdivに class=\"agent-card news-card\" の2クラス併用を追加し、新規CSS追加なしでリンク色を自動適用"
  - "<li>/<ul> にインラインstyleを明示指定し、グローバル li/ul ルール（border-left・margin-bottom）を打ち消す（UI-SPEC制約3/4）"

requirements-completed: [UI-05, UI-06]

# Metrics
duration: 3min
completed: 2026-07-03
---

# Phase 20 Plan 02: Holding-Card News Rendering + Pipeline Wiring Summary

**保有銘柄カードに関連ニュースサブセクション（複数件描画・0件空状態・社名一致バッジ・安全リンク）を描画し、generate-report.ts の実行パイプラインに resolver を配線して UI-05/UI-06 を完成**

## Performance

- **Duration:** 3 min (RED commit to final feat commit)
- **Started:** 2026-07-03T17:29:29+09:00 (first task commit — RED)
- **Completed:** 2026-07-03T17:30:48+09:00 (last task commit)
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- `formatHoldingNewsItemHtml`/`formatHoldingNewsSectionHtml` が UI-SPEC の Component/Markup Contract を逐語実装: 見出しリンク（`safeHref` gate + `escapeHtml`）、ソース名・JST日時、`matchType !== "ticker"` の場合のみ「社名一致」バッジ、0件時は見出し常時表示 + 「本日の関連ニュースなし」で空状態を描画
- `formatHoldingEvaluationsHtml` を拡張し `resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)] ?? []` で参照側キーを正規化。Wave 1 のリゾルバーと同一関数を共有することで、LLM(portfolio-analyst)出力の symbol 表記揺れ（例 " mrna "）があってもニュースが正しく引き当たることをテストで確認（サイレント0件表示の構造的防止、T-20-07 mitigation）
- `generatePortfolioReportHtml` に第3引数 `resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> = {}` を後方互換のデフォルト引数として追加。既存2引数呼び出し（Test 25-32）は無変更で green
- カードdivに `class="agent-card news-card"` の2クラス併用を追加し、新規CSSなしで `.news-card a` のリンク色（既定/visited/hover）を自動適用
- `generate-report.ts` main() の `Promise.all` に `loadNewsPool()`/`loadHoldingNews()` を追加し、`resolvePortfolioHoldingNews(holdingNews, newsPool)` の解決結果を `generatePortfolioReportHtml` の第3引数に渡す配線を完成。`collect-data.ts`（Phase 19書き込み側）は無変更

## Task Commits

Each task was committed atomically (Task 1 is TDD with separate RED/GREEN commits):

1. **Task 1: ニュースサブセクション描画 + formatHoldingEvaluationsHtml/シグネチャ拡張**
   - `b2f64d7` (test) — RED: Test 33-38（0件空状態、社名一致バッジ、リンク属性、ticker無印、キー正規化、後方互換）の失敗テスト追加
   - `503fbae` (feat) — GREEN: `formatHoldingNewsItemHtml`/`formatHoldingNewsSectionHtml` 実装、`formatHoldingEvaluationsHtml`/`generatePortfolioReportHtml` 拡張、全14 Portfolio Reportテストgreen
2. **Task 2: generate-report.ts パイプラインへ loadNewsPool/loadHoldingNews + resolver を配線**
   - `a5ec435` (feat) — `Promise.all` 拡張、`resolvePortfolioHoldingNews` 呼び出し、`generatePortfolioReportHtml` 第3引数配線。全228テストgreen、tsc新規エラーなし、`collect-data.ts` 無変更

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `src/scripts/generate-portfolio-report.ts` - `formatHoldingNewsItemHtml`/`formatHoldingNewsSectionHtml` を追加、`formatHoldingEvaluationsHtml`/`generatePortfolioReportHtml` を拡張、import を `safeHref`/`formatPublishedAtJst`/`normalizeHoldingSymbol`/`ResolvedHoldingNewsItem` に拡張
- `src/scripts/generate-report.test.ts` - Test 33-38（UI-05/UI-06のユニットテスト6件）を追加
- `src/scripts/generate-report.ts` - `loadNewsPool`/`loadHoldingNews`/`resolvePortfolioHoldingNews` の import 追加、main() の `Promise.all` とレポート生成呼び出しを配線

## Decisions Made

- サブセクション見出しは UI-SPEC 制約2に従い `<h4>` ではなく `<p>` を使用（`.agent-card h4` グローバルルールとの色/マージン衝突回避）
- `<li>`/`<ul>` に UI-SPEC 制約3/4のインラインstyleを逐語適用し、グローバル `li`（`border-left`アクセント）・`ul`（`margin-bottom`）ルールを打ち消し
- キー正規化テスト（Test 37）は共有フィクスチャ `validPortfolioAnalysis` を直接改変せず、ローカルスコープで `holdings` を map して symbol のみ差し替えたコピーを使用（他テストへの副作用を回避）

## Deviations from Plan

None - plan executed exactly as written. PATTERNS.md の target implementation を逐語採用した。

## Issues Encountered

None new. `npx tsc --noEmit` で Wave 1 から持ち越しの `src/scripts/collect-data.test.ts` 既存TSエラー4件（`TS7006`）が引き続き検出されるが、本プランのタスクが触れていないファイルであり Phase 15 由来の既存issueのため対象外（scope boundary、`.planning/phases/20-holding-card-news-display/deferred-items.md` に記録済み、変更なし）。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UI-05（関連ニュース表示・幻覚URL防止）と UI-06（0件銘柄の正常描画）が閲覧者に届く形で完成。全228テストgreen、tsc新規エラーなし
- 手動確認（Manual-Only, 20-VALIDATION.md）: パイプライン実行後 `docs/YYYY-MM-DD/portfolio-report.html` をブラウザで開き、日本株0件銘柄の空状態表示とニュースリンク遷移先の目視確認が phase完了前に必要（本プランの自動テストではカバーされない視覚的検証）
- 既存の `deferred-items.md`（collect-data.test.ts の pre-existing tsc エラー4件）はこのプランの作業に影響しないため、そのまま持ち越し

---
*Phase: 20-holding-card-news-display*
*Completed: 2026-07-03*
