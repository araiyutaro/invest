---
phase: 08-news-filter-module
plan: 02
subsystem: data
tags: [typescript, vitest, tdd, denylist, relevance-filter, time-filter, dedup]

requires:
  - "08-01: filter.ts Pass1/Pass2 (URL dedup + Title Jaccard dedup)"

provides:
  - "src/data/news/filter.ts: DENYLIST_PATTERNS, FINANCIAL_EXCEPTION_KEYWORDS, isDenylisted, filterByRelevance, filterByTime (全エクスポート)"
  - "src/data/news/filter.ts: filterNewsArticles 全4Passパイプライン完全版"
  - "src/data/news/filter.test.ts: FILT-01 (8件) / FILT-02 (4件) / 統合テスト追加"
  - "src/data/news/rss-sources.ts: 50文字プレフィックスdedup削除済み (DEDUP-03)"

affects:
  - "09-pipeline-integration"

tech-stack:
  added: []
  patterns:
    - "denylist + 投資キーワード例外ルール: isDenylisted はタイトルのみ照合 (Pitfall 5)"
    - "4-Pass パイプライン: Pass1 URL dedup → Pass2 Title Jaccard → Pass3 Relevance → Pass4 Time"
    - "ReadonlyArray<RegExp> でdenylistを定数定義: イミュータブル参照"

key-files:
  created: []
  modified:
    - src/data/news/filter.ts
    - src/data/news/filter.test.ts
    - src/data/news/rss-sources.ts

key-decisions:
  - "「異なる内容の記事は2件残る (DEDUP-02)」テストのデータ修正: Pass3 (denylist) 実装後「スポーツ選手が優勝」が除外されるため、両記事を投資関連記事（日銀利上げ・米国雇用統計）に置換"
  - "filterByRelevance / isDenylisted を export: Plan 09 の統合テストで直接アサート可能にするため"
  - "DENYLIST_PATTERNS を export: 将来フェーズでのキーワードリスト拡張・テスト参照を容易にするため"

requirements-completed:
  - DEDUP-03
  - FILT-01
  - FILT-02

duration: 5min
completed: 2026-06-27
---

# Phase 08 Plan 02: News Filter Module — Relevance and Time Filters Summary

**denylist + 投資キーワード例外ルール (FILT-01) と 24h 時間フィルタ (FILT-02) を TDD で実装し、rss-sources.ts の旧式 50 文字プレフィックス dedup を完全削除して filter.ts に一元化**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-27T14:08:00Z
- **Completed:** 2026-06-27T14:13:00Z
- **Tasks:** 2 (Task 1: RED+GREEN TDD / Task 2: dedup 削除)
- **Files modified:** 3

## Accomplishments

- `src/data/news/filter.ts` に `DENYLIST_PATTERNS` / `FINANCIAL_EXCEPTION_KEYWORDS` / `isDenylisted` / `filterByRelevance` / `filterByTime` を追加 (全エクスポート)
- `filterNewsArticles` を完全な 4-Pass パイプライン (Pass1→Pass2→Pass3→Pass4) に更新
- `src/data/news/filter.test.ts` に FILT-01 (8件) / FILT-02 (4件) / 統合テスト (1件) を追加
- `src/data/news/rss-sources.ts` の `title.slice(0, 50)` / `seen.has(key)` dedup ブロックを完全削除
- 全テストスイート 77 件全て PASS

## Task Commits

1. **Task 1 RED — FILT-01/02 失敗テスト追加** - `aeb2dc9` (test)
2. **Task 1 GREEN — denylist + 時間フィルタ実装** - `2e646d8` (feat)
3. **Task 2 — rss-sources.ts dedup 削除** - `1416458` (refactor)

## Files Created/Modified

- `src/data/news/filter.ts` — Pass3/Pass4 実装 + DENYLIST_PATTERNS / FINANCIAL_EXCEPTION_KEYWORDS 定数 + isDenylisted / filterByRelevance / filterByTime 関数
- `src/data/news/filter.test.ts` — FILT-01/02 テスト追加 + 既存 DEDUP-02 テストデータ修正
- `src/data/news/rss-sources.ts` — 50文字プレフィックス dedup ブロック削除

## Decisions Made

- `DENYLIST_PATTERNS` / `FINANCIAL_EXCEPTION_KEYWORDS` / `isDenylisted` を export 公開: Plan 09 統合テストでの直接アサート容易化
- denylist は タイトルのみ照合 (summary は照合対象外): RESEARCH.md Pitfall 5 に従い偽陽性を抑制

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 既存 DEDUP-02 テスト「異なる内容の記事は2件残る」のテストデータ修正**
- **Found during:** Task 1 GREEN フェーズ
- **Issue:** 既存テストが "スポーツ用品株が高騰" と "スポーツ選手が優勝" を入力として使っていた。Pass3 (denylist) 実装後、後者が `/スポーツ/` にマッチして除外され、期待値の2件ではなく1件になりテストが失敗する
- **Fix:** 両記事を denylist に引っかからない投資関連記事（「日銀が利上げを決定した」「米国雇用統計が予想を上回る結果」）に置換。DEDUP-02 テストの本来の目的（Jaccard 類似度が低い記事が dedup されない）は変わらず維持
- **Files modified:** src/data/news/filter.test.ts
- **Verification:** npx vitest run src/data/news/filter.test.ts で全19テスト通過確認
- **Committed in:** 2e646d8 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in existing test data)
**Impact on plan:** テストデータのバグ修正のみ。実装ロジックは計画通り。スコープ逸脱なし。

## Verification Results

```
grep -c "title.slice(0, 50)" src/data/news/rss-sources.ts → 0 (削除確認 OK)
grep -c "seen.has" src/data/news/rss-sources.ts → 0 (削除確認 OK)
grep -c "DENYLIST_PATTERNS" src/data/news/filter.ts → 2 (定義 + 使用)
grep -c "filterByTime" src/data/news/filter.ts → 2 (定義 + 使用)
grep -c "FILT-01" src/data/news/filter.test.ts → 8 (4件以上 OK)
grep -c "FILT-02" src/data/news/filter.test.ts → 4 (3件以上 OK)
npm test → 77 tests PASS
```

## Known Stubs

なし — Plan 08-02 の全機能が実装完了。filterNewsArticles は 4-Pass パイプライン全て実装済み。

## Threat Flags

なし — 新規ネットワークエンドポイント・認証パス・スキーマ変更なし。filter.ts は内部信頼データのみ処理するピュア関数。

## TDD Gate Compliance

- RED gate: `aeb2dc9` (test commit) — FILT-01/02/統合テスト 11 件追加、6 件 FAIL 確認 ✓
- GREEN gate: `2e646d8` (feat commit) — 全 19 テスト PASS ✓

## Self-Check: PASSED

- [x] `src/data/news/filter.ts` 存在確認 ✓ (DENYLIST_PATTERNS, filterByTime 含む)
- [x] `src/data/news/filter.test.ts` 存在確認 ✓ (FILT-01 × 8, FILT-02 × 4)
- [x] `src/data/news/rss-sources.ts` dedup 削除確認 ✓ (grep 0件)
- [x] aeb2dc9 コミット存在 ✓
- [x] 2e646d8 コミット存在 ✓
- [x] 1416458 コミット存在 ✓
- [x] npm test 77件 PASS ✓

---
*Phase: 08-news-filter-module*
*Completed: 2026-06-27*
