---
phase: 15-curation-contract-schema
plan: 02
subsystem: api
tags: [zod, validation, contract-schema, news-curation, tdd]

# Dependency graph
requires: []
provides:
  - "NewsCuration / CuratedArticle readonly型（src/meeting/types.ts）"
  - "validateRawNewsCuration() — 構造検証（id必須、market/importance enum厳格、passthrough+デフォルト補完）"
  - "resolveNewsCuration() — プール参照解決（ID実在チェック、重複drop、空commentary drop、件数ソフトクランプ、title/url/source解決）"
  - "NewsArticlePoolEntry型（tmp/news.jsonプールの最小形状）"
affects: [16-report-ui-news-digest, 17-pipeline-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "二層バリデーション: zodスキーマ（構造検証・throw）+ TS解決関数（クロスリファレンス検証・console.warn+drop、throwしない）"
    - "ID参照方式による幻覚URL防止: LLMにurl/titleを一切出力させず、resolveNewsCurationが常にプールから実データを解決する"
    - "件数ソフトクランプ: zodスキーマでは配列長を制約せず、resolveNewsCuration内でtruncate/warnのみの処理とする"

key-files:
  created:
    - src/meeting/schemas.test.ts
  modified:
    - src/meeting/types.ts
    - src/meeting/schemas.ts

key-decisions:
  - "D-09に従い、curatedArticleRawSchema/rawNewsCurationSchemaはportfolioAnalysisSchema系のpassthroughパターンを踏襲し、コア契約(id/market/importance)のみ厳格検証、他はoptional().default()で欠落耐性を持たせた"
  - "D-03/D-04/D-05に従い、zodスキーマに配列長のハード制約(.min/.max)を一切書かず、件数の妥当性判定はresolveNewsCuration内のsliceとconsole.warnのみで表現した（Pitfall 1回避）"
  - "resolveNewsCurationはいかなる入力でもthrowしない設計とし、不明ID/重複ID/空commentaryはdrop + console.warnで処理（D-08/D-10、グレースフルデグラデーション）"

patterns-established:
  - "契約層の二層構造: 第1層(zod構造検証、throw素通し) + 第2層(プール参照解決関数、console.warn+drop)。今後のtmp/*.json契約でこのパターンを踏襲する"

requirements-completed: [CURA-02, CURA-05]

# Metrics
duration: 17min
completed: 2026-07-02
---

# Phase 15 Plan 02: Curation Contract Schema Summary

**zodによるNewsCuration契約の二層バリデーション実装（validateRawNewsCurationによる構造検証 + resolveNewsCurationによるプール参照解決）で幻覚URL・不正market値を構造的に防止**

## Performance

- **Duration:** 17 min
- **Started:** 2026-07-02T13:47:45+09:00 (base commit)
- **Completed:** 2026-07-02T14:04:07+09:00
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `NewsCuration`/`CuratedArticle` readonly型を `src/meeting/types.ts` に追加（market/importanceは英語小文字enumリテラルユニオン、D-06/D-07）
- `validateRawNewsCuration()` — 第1層構造検証。市場enum（us/japan/global）・重要度enum（high/medium/low）を厳格検証し、範囲外値（"US"/"米国"/"europe"/"critical"等）は throw する（CURA-05）。articles/commentary/tickers欠落時はデフォルト補完、未知フィールドはpassthrough許容（D-09）
- `resolveNewsCuration()` — 第2層プール参照解決。LLM出力の `id` のみを信頼し、title/url/source/publishedAtを常にプールから解決（CURA-02、幻覚URL防止）。不明ID・重複ID・空commentaryはdrop+console.warn、15件超はAgentの重要度順のままslice(0,15)でtruncate（再ソートなし、D-03）、10件未満・0件はwarnのみで受理（D-04/D-05）、いかなる入力でもthrowしない
- fixtureベースの単体テスト17ケースを `src/meeting/schemas.test.ts` に新規作成し、正常系・欠落耐性・未知フィールド許容・不正enum・不明ID/重複ID/空commentary/件数過不足/tickerマージの全ケースをカバー

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: 型定義と構造検証スキーマ（validateRawNewsCuration）**
   - RED: `a8913a4` (test) — validateRawNewsCurationの失敗テスト追加
   - GREEN: `d638cd9` (feat) — CuratedArticle/NewsCuration型 + curatedArticleRawSchema/rawNewsCurationSchema/validateRawNewsCuration実装
2. **Task 2: プール参照解決関数（resolveNewsCuration）とソフトクランプ**
   - RED: `9f73005` (test) — resolveNewsCurationの失敗テスト追加
   - GREEN: `f8fd33f` (feat) — NewsArticlePoolEntry型 + resolveNewsCuration実装

_Note: 各タスクをRED(test)→GREEN(feat)の2コミットで実行。REFACTORコミットは不要（実装がRESEARCH.md/PATTERNS.mdの完成形コード例をそのまま踏襲したため、追加のリファクタリングは発生しなかった）。_

## Files Created/Modified
- `src/meeting/types.ts` - `CuratedArticle`/`NewsCuration` readonly型を追加（既存 PortfolioAnalysis 型の直後）
- `src/meeting/schemas.ts` - `curatedArticleRawSchema`/`rawNewsCurationSchema`/`validateRawNewsCuration`/`NewsArticlePoolEntry`/`resolveNewsCuration` を追加（既存 portfolioAnalysisSchema の直後）
- `src/meeting/schemas.test.ts` (新規) - 17件のfixtureベース単体テスト（validateRawNewsCuration 8件、resolveNewsCuration 9件）

## Decisions Made
- `NewsArticlePoolEntry` を `export` した（RESEARCH.md/PATTERNS.mdのコード例では非exportだったが、Phase 17がこの型をimportしてプール構築に使う必要があるため。契約自体はPhase 15で完全定義するというCONTEXT.mdの方針に沿う判断）
- テストのfixtureファクトリ（`makePoolEntry`/`makeRawArticle`）は既存 `filter.test.ts` の `makeArticle` パターンを踏襲し、`.test.ts` 内にインライン定義（Pitfall 4準拠、独立JSONファイルは作成しない）

## Deviations from Plan

None - plan executed exactly as written. RESEARCH.md/PATTERNS.mdに完成形として提示されていたコード例をそのまま実装に反映した（型・スキーマ・resolveNewsCurationロジックとも設計案から変更なし）。`NewsArticlePoolEntry`のexport可否のみ、Phase 17での利用を見越してexportする判断をしたが、これは既存の「命名詳細はClaude's Discretion」の範囲内の調整でありplan逸脱ではない。

## Issues Encountered
None. 実行前に `npx tsc --noEmit` を実行したところ `src/data/news/finnhub.ts` と `src/scripts/collect-data.test.ts` に本プラン範囲外の既存型エラーが存在することを確認したが、これは本プランが変更していないファイルであり、スコープ境界（Out-of-scope discoveries）に従い対応せず記録のみ行う。`src/meeting/` 配下には型エラーなし。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 16（Report Generator/HTML Rendering）が `NewsCuration | null` を受け取るピュアレンダラーを実装する際、本プランの `NewsCuration`/`CuratedArticle` 型をそのまま契約として利用できる
- Phase 17（Pipeline Integration）が `resolveNewsCuration(raw, pool, date, generatedAt)` を呼び出す際、`NewsArticlePoolEntry[]` として `tmp/news.json`（JSON.parse後、publishedAtはstring）をそのまま渡せる
- 本プランのスコープ外だった記事ID付与（`assignArticleIds()`、D-01/D-02、`collect-data.ts`組み込み）はPlan 15-01（Wave 1の並行プラン）が担当する想定。Phase 17統合前に15-01の完了を確認する必要がある
- ブロッカーなし

---
*Phase: 15-curation-contract-schema*
*Completed: 2026-07-02*

## Self-Check: PASSED

- FOUND: src/meeting/types.ts
- FOUND: src/meeting/schemas.ts
- FOUND: src/meeting/schemas.test.ts
- FOUND: .planning/phases/15-curation-contract-schema/15-02-SUMMARY.md
- FOUND: a8913a4 (test: validateRawNewsCuration RED)
- FOUND: d638cd9 (feat: validateRawNewsCuration GREEN)
- FOUND: 9f73005 (test: resolveNewsCuration RED)
- FOUND: f8fd33f (feat: resolveNewsCuration GREEN)
- FOUND: c22b63c (docs: plan metadata commit)
- `npm test` full suite: 158 passed (10 files), including 17 new tests in schemas.test.ts
