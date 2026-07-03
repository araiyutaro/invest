---
phase: 21-portfolio-websearch-research
plan: 01
subsystem: schema-validation
tags: [zod, alias-transform, validation, ts, vitest]

requires:
  - phase: 19-data-foundation-holding-news-supply
    provides: WebSearchResult 型と既存 tmp/websearch/{ticker}.json 契約
provides:
  - "硬化された webSearchResultSchema（passthrough().transform() alias-transform、D-12）"
  - "src/scripts/validate-portfolio-research.ts — tmp/portfolio-research/{symbol}.json 検証スクリプト"
  - "generate-report.ts の Daily Report ローダーが portfolio-research/ を参照しないことを保証する構造的隔離テスト"
affects: [22-portfolio-analyst-re-evaluation]

tech-stack:
  added: []
  patterns:
    - "zod passthrough().transform() 2層構成（rawXSchema → canonical transform）を webSearchResultSchema にも適用（holdingEvaluationSchema/portfolioAnalysisSchema と同一パターン）"
    - "構造的隔離テスト: readdir モックへの toHaveBeenCalledWith/not.toHaveBeenCalledWith で新設ディレクトリ非参照を証明"

key-files:
  created:
    - src/scripts/validate-portfolio-research.ts
  modified:
    - src/meeting/schemas.ts
    - src/meeting/schemas.test.ts
    - src/scripts/generate-report.test.ts

key-decisions:
  - "webSearchResultSchema を holdingEvaluationSchema/portfolioAnalysisSchema と同一の rawXSchema+transform 2層構成にリファクタし、既存の tmp/websearch/{ticker}.json（候補銘柄）と本フェーズの tmp/portfolio-research/{symbol}.json の両方を保護する共有バックポートとした"
  - "隔離保証は generate-report.ts に0行追加（構造的隔離）。テストで readdir モックの呼び出し引数を検証することで、実装コードを変更せずに非参照を証明"

requirements-completed: [PORT-02]

duration: 2min
completed: 2026-07-03
---

# Phase 21 Plan 01: WebSearch Schema Hardening & Isolation Verification Summary

**webSearchResultSchema を passthrough().transform() で硬化し、フィールド名エイリアス（summary/findings/positives/negatives/concerns/articles/timestamp/date）を正準形に吸収。tmp/portfolio-research/ 検証スクリプトと Daily Report ローダーの構造的隔離テストを新設。**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-03T09:28:00Z (approx)
- **Completed:** 2026-07-03T09:30:29+09:00
- **Tasks:** 2 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- webSearchResultSchema を strict object から alias-transform 硬化スキーマへリファクタ（D-12）。正準6フィールド + 8種のエイリアスフィールドを passthrough で受理し、null合体で正準形へ解決
- Step 3-P のフォールバックJSON形状（`{ticker:"EE", researchSummary:"リサーチ失敗", ...}`）が throw せず通過することをユニットテストで保証
- validate-portfolio-research.ts を新設。tmp/portfolio-research/ 配下の全 `.json` を webSearchResultSchema で検証し、1件でも失敗すれば非0終了
- generate-report.ts のプロダクションコードを一切変更せずに、Daily Report ローダー（loadWebSearchResults/loadReevalResults）が tmp/portfolio-research/ を決して参照しないことを構造的隔離テストで証明（Pitfall 1, PORT-02）

## Task Commits

Each task was committed atomically (Task 1 followed TDD RED→GREEN):

1. **Task 1 RED: webSearchResultSchema 硬化のための失敗テスト追加** - `887afe5` (test)
2. **Task 1 GREEN: webSearchResultSchema を alias-transform で硬化** - `87ed15d` (feat)
3. **Task 2: validate-portfolio-research.ts 新設 と generate-report 隔離テスト追加** - `7992eb6` (feat)

_Note: Task 1 は tdd="true" のため test→feat の2コミット構成。REFACTOR フェーズは不要だった（実装が既存パターンに準拠し初手でクリーン）。_

## Files Created/Modified
- `src/meeting/schemas.ts` - webSearchResultSchema を rawWebSearchResultSchema（passthrough, ticker以外optional+エイリアス）+ transform（正準形解決）の2層構成にリファクタ。validateWebSearchResult のシグネチャ・戻り型は不変
- `src/meeting/schemas.test.ts` - `describe("webSearchResultSchema")` を新設。正常系/5種のエイリアスペア受理/欠落デフォルト補完/passthrough/フォールバックJSON/後方互換の9ケース
- `src/scripts/validate-portfolio-research.ts` - validate-meeting.ts を mirror。readdir → JSON.parse → webSearchResultSchema.parse() をファイルごとに実行、pass/fail をログしfailed>0で process.exit(1)
- `src/scripts/generate-report.test.ts` - "3-report output" describe 内に Test 39 を追加。main() 実行後、readdirモックが websearch/reeval を含むパスで呼ばれ portfolio-research を含むパスでは呼ばれないことを assert

## Decisions Made
- webSearchResultSchema のリファクタは既存の holdingEvaluationSchema/portfolioAnalysisSchema パターン（raw+passthrough → transform）をそのまま踏襲し、新規パターンを増やさなかった
- 隔離保証は「テストでの構造的証明」で行い、generate-report.ts への防御コード追加は行わなかった（`git diff --stat src/scripts/generate-report.ts` が空であることを確認済み）

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx tsc --noEmit -p tsconfig.json` で src/scripts/collect-data.test.ts の既存型エラー4件を検出したが、本フェーズの変更ファイル外かつ本フェーズのコミットでは触れていないことを `git log`/`git diff` で確認済み。スコープ境界ルールに従い `.planning/phases/21-portfolio-websearch-research/deferred-items.md` に記録し修正はスキップ

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- webSearchResultSchema の硬化により、Plan 02（invest.md の WebSearch リサーチ生成）が任意のエージェント発明フィールド名で tmp/portfolio-research/{symbol}.json を書いても安全に検証・正準化される
- validate-portfolio-research.ts は Plan 02 実行後の12ファイル検証にそのまま使用可能
- Daily Report ローダーの構造的隔離が保証されたため、Phase 22（portfolio-analyst 再評価統合）は tmp/portfolio-research/ を独自の読み込みパスで安全に配線できる
- ブロッカーなし

---
*Phase: 21-portfolio-websearch-research*
*Completed: 2026-07-03*

## Self-Check: PASSED

All created/modified files verified present on disk. All task commits (887afe5, 87ed15d, 7992eb6) and metadata commit (a98badf) verified in git log.
