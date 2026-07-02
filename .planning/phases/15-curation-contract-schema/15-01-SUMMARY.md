---
phase: 15-curation-contract-schema
plan: 01
subsystem: data
tags: [typescript, news-pipeline, id-assignment, vitest, tdd]

# Dependency graph
requires:
  - phase: 14.1-report-ui (news filter pipeline)
    provides: filterNewsArticles / RawNewsArticle type contract in src/data/news/
provides:
  - "assignArticleIds 純関数（src/data/news/article-id.ts）— 記事配列に入力順で連番ID（n01…n80）を付与"
  - "NewsArticleWithId 型 — RawNewsArticle を extends し readonly id: string を追加"
  - "collect-data.ts の tmp/news.json 出力への ID 付与組み込み"
affects: [16-report-generator, 17-pipeline-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "純関数によるID付与（.map() で新配列を返し元配列を変更しない、既存 filter.ts の deduplicateByUrl 等と同じイミュータビリティ規約）"
    - "短い連番ID方式（配列インデックス暗黙参照・URLハッシュは不採用）でLLMの記事参照を構造的に幻覚URLから守る"

key-files:
  created:
    - src/data/news/article-id.ts
    - src/data/news/article-id.test.ts
  modified:
    - src/scripts/collect-data.ts
    - src/scripts/collect-data.test.ts

key-decisions:
  - "ID桁数は2桁ゼロ埋め固定（MAX=80件クランプに対しn01〜n99で十分カバー）"
  - "catch フォールバックの空配列書き出しはID付与対象がないため変更しない（T-15-02: accept）"

patterns-established:
  - "Pattern: 記事配列へのID付与は純関数で完結させ、書き込み直前に一度だけ呼び出す（collect-data.ts 内 try ブロック、writeFile 直前）"

requirements-completed: [CURA-02]

# Metrics
duration: 20min
completed: 2026-07-02
---

# Phase 15 Plan 01: Curation Contract Schema (Article ID Assignment) Summary

**短い連番ID（n01…n80）を記事配列に付与する純関数 assignArticleIds を実装し、collect-data.ts の tmp/news.json 出力に組み込んだ。これによりキュレーションAgentは短いIDをコピーするだけで記事参照でき、URL/タイトルの幻覚生成を構造的に防止する基盤が完成。**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-02T04:59:00Z
- **Completed:** 2026-07-02T05:02:17Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `assignArticleIds` 純関数と `NewsArticleWithId` 型を実装（TDD: RED→GREEN）
- `collect-data.ts` の `tmp/news.json` 書き出し直前に ID 付与を組み込み（TDD: RED→GREEN）
- 既存 collect-data テスト（14件）+ 新規テストとも全green、全体スイート146件も回帰なし

## Task Commits

Each task was committed atomically:

1. **Task 1: assignArticleIds 純関数と単体テスト** - `424b155` (test), `07f717a` (feat)
2. **Task 2: collect-data.ts への ID 付与組み込みとテスト** - `cfe6b3b` (test), `997b078` (feat)

_Note: TDD tasks have RED (test) → GREEN (feat) commit pairs per task, as specified by the plan's `type: tdd`._

## Files Created/Modified
- `src/data/news/article-id.ts` - `assignArticleIds` 純関数 + `NewsArticleWithId` 型（RawNewsArticle extends）
- `src/data/news/article-id.test.ts` - 単体テスト（入力順ID付与・イミュータビリティ・80件2桁ゼロ埋め・空配列）
- `src/scripts/collect-data.ts` - `assignArticleIds` の import と news.json 書き出し直前への組み込み
- `src/scripts/collect-data.test.ts` - news.json 出力の各要素に id が付与されることを検証するテストケースを追加

## Decisions Made
- ID桁数は2桁ゼロ埋め固定（`padStart(2, "0")`）。MAX=80件クランプに対し十分な桁数であるため、可変桁ロジックは導入しない。
- catch フォールバック（`writeFile(..., "[]", "utf-8")`）はプラン記載どおり変更なし。ID付与対象がない空配列のため改変不要。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## TDD Gate Compliance

Both tasks followed RED → GREEN gate sequence, verified in git log:
- Task 1: `424b155` test(15-01) → `07f717a` feat(15-01)
- Task 2: `cfe6b3b` test(15-01) → `997b078` feat(15-01)

No REFACTOR commits were needed (implementation was minimal and clean on first pass).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 16 (Report Generator/HTML Rendering) can rely on `tmp/news.json` articles always carrying a stable, short `id` field for cross-referencing in curation output.
- Phase 17 (Pipeline Integration) can trust the ID assignment happens deterministically in TS before any LLM/Agent interaction — no downstream changes needed to preserve this guarantee.
- No blockers identified.

---
*Phase: 15-curation-contract-schema*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: src/data/news/article-id.ts
- FOUND: src/data/news/article-id.test.ts
- FOUND: .planning/phases/15-curation-contract-schema/15-01-SUMMARY.md
- FOUND: 424b155 (test: assignArticleIds RED)
- FOUND: 07f717a (feat: assignArticleIds GREEN)
- FOUND: cfe6b3b (test: collect-data ID integration RED)
- FOUND: 997b078 (feat: collect-data ID integration GREEN)
- FOUND: 54e5d37 (docs: plan completion commit)
