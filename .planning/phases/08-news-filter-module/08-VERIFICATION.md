---
phase: 08-news-filter-module
verified: 2026-06-27T14:14:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 8: News Filter Module Verification Report

**Phase Goal:** クロスソース重複排除・関連性フィルタ・時間フィルタを一元管理するピュア関数モジュール `src/data/news/filter.ts` をTDDで構築し、単体テストで動作を保証する
**Verified:** 2026-06-27T14:14:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D-02: 同一URLの記事が1件に集約され、summaryが長い方が残る | VERIFIED | `deduplicateByUrl` がsummary.length比較で長い方を保持。テスト「同一URLの記事が1件に集約される (DEDUP-01)」PASS |
| 2 | D-01: NFKC正規化後Jaccard>=0.75の類似タイトル記事が1件に集約される | VERIFIED | `JACCARD_THRESHOLD = 0.75` 定数、`deduplicateByTitle` 実装、Jaccard境界テスト PASS |
| 3 | D-01: 【速報】日経平均株価上昇 と 日経平均株価上昇 が同一視される | VERIFIED | テスト「【速報】プレフィックス付きの同一記事が1件に集約される (DEDUP-02 / D-01)」PASS。NFKC+ブラケット除去で同一トークンセットになる |
| 4 | D-03: 英語記事と日本語記事がJaccardで同一視されない | VERIFIED | `isJapaneseTitle` による言語グループ分離実装。テスト「英語記事と日本語記事がJaccardで同一視されない (D-03)」PASS |
| 5 | D-06: スポーツ選手が優勝 はdenylistで除外される | VERIFIED | `DENYLIST_PATTERNS` に `/スポーツ/` 含む。同カテゴリのテスト「プロ野球選手が引退を発表」PASS で動作保証。`スポーツ選手が優勝`は/スポーツ/にマッチし投資例外なし→除外 |
| 6 | D-05: スポーツ用品株が高騰 はdenylistで除外されない (投資キーワード例外) | VERIFIED | テスト「「スポーツ用品株が高騰」がdenylistで除外されない (投資キーワード例外, FILT-01)」PASS。`/株/` が例外として機能 |
| 7 | D-08: 25時間前のpublishedAtを持つ記事が除外される | VERIFIED | テスト「25時間前のpublishedAtを持つ記事が除外される (FILT-02)」PASS |
| 8 | D-08: 23時間前のpublishedAtを持つ記事が残る | VERIFIED | テスト「23時間前のpublishedAtを持つ記事が残る (FILT-02)」PASS |
| 9 | D-04: rss-sources.tsに title.slice(0, 50) が存在しない | VERIFIED | `grep -c "title.slice(0, 50)" src/data/news/rss-sources.ts` → 0。`seen.has` も0 |
| 10 | D-07: フィルタはdenylistのみ。allowlistは使用しない | VERIFIED | filter.ts に DENYLIST_PATTERNS + FINANCIAL_EXCEPTION_KEYWORDS のみ。allowlist定数・関数なし |

**Score:** 10/10 truths verified

---

### ROADMAP Success Criteria

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | 異なるソース（Finnhub/Google News/RSS）から届いた同一URLの記事が1件に集約される | VERIFIED | `deduplicateByUrl` + URL正規化テスト群PASS |
| 2 | NFKC正規化後にJaccard類似度 ≥ 0.75 の類似タイトルを持つ記事が1件に集約される（「【速報】〜」と「〜」が同一視される） | VERIFIED | 閾値0.75定数 + 【速報】プレフィックステスト PASS |
| 3 | 「スポーツ選手が優勝」のような非投資記事はdenylistで除外され、「スポーツ用品株が高騰」はdenylistで除外されない | VERIFIED | FILT-01テスト群全PASS（両方向の動作保証） |
| 4 | 全ソースで24時間以上前の記事が除外される | VERIFIED | `filterByTime` 実装 + FILT-02テスト群PASS |
| 5 | rss-sources.ts の50文字プレフィックスdedupが削除され、NFKC正規化+Jaccardに統一されている | VERIFIED | rss-sources.ts から dedup ブロック完全削除確認。filter.ts に一元化済み |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/data/news/types.ts` | NewsFilterStats, NewsFilterResult 型定義 | VERIFIED | 両インターフェースとも `readonly` プロパティ付きで定義済み |
| `src/data/news/filter.ts` | filterNewsArticles, normalizeUrl, normalizeTitle, tokenize, jaccardSimilarity 他 | VERIFIED | 全9関数/定数がnamed export。197行、ピュア関数のみ |
| `src/data/news/filter.test.ts` | DEDUP-01/02/D-03/FILT-01/02 全テストケース、min_lines 150 | VERIFIED | 329行、19テストケース。ラベル参照数: DEDUP-01×4、DEDUP-02×3、D-03×1、FILT-01×8、FILT-02×4 |
| `src/data/news/rss-sources.ts` | 50文字プレフィックスdedup削除済み | VERIFIED | `title.slice(0, 50)` 0件、`seen.has` 0件。`allArticles.sort(...)` 直接返却 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/data/news/filter.ts` | `src/data/news/types.ts` | `import type { RawNewsArticle, NewsFilterResult }` | WIRED | line 1: `import type { RawNewsArticle, NewsFilterResult } from "./types.js"` |
| `src/data/news/filter.test.ts` | `src/data/news/filter.ts` | `import { filterNewsArticles }` | WIRED | line 2: `import { filterNewsArticles } from "./filter.js"` |
| `isDenylisted` | `DENYLIST_PATTERNS + FINANCIAL_EXCEPTION_KEYWORDS` | 両方を`.some()`で参照 | WIRED | lines 143–149で両定数を参照し除外判定 |
| `rss-sources.ts` | dedup責務の移譲 | `title.slice(0,50)` 削除 | WIRED | 旧dedupブロック完全削除。filter.tsに責務一元化 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `filter.ts` | `articles: ReadonlyArray<RawNewsArticle>` | 関数引数（ピュア関数、I/Oなし） | N/A (データ変換のみ) | VERIFIED — ピュア関数モジュール。データはすべて引数から取得し、副作用なし |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 全テストケース19件PASS | `npx vitest run src/data/news/filter.test.ts` | 19 tests passed, 4ms | PASS |
| 全体テストスイートPASS | `npm test` | 77 tests passed (4 test files) | PASS |
| rss-sources.ts dedup削除確認 | `grep -c "title.slice(0, 50)" src/data/news/rss-sources.ts` | 0 | PASS |
| filter.ts exports確認 | `grep "^export" src/data/news/filter.ts` | 9エクスポート確認 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEDUP-01 | 08-01-PLAN | Finnhub/Google News/RSS間でURL完全一致による重複記事が排除される | SATISFIED | `deduplicateByUrl` 実装、テスト4件PASS |
| DEDUP-02 | 08-01-PLAN | タイトルのNFKC正規化後のJaccard類似度による重複記事が排除される | SATISFIED | `deduplicateByTitle` + 閾値0.75実装、テスト3件PASS |
| DEDUP-03 | 08-02-PLAN | 既存rss-sources.tsの50文字プレフィックスdedupがタイトル正規化Jaccardに置換される | SATISFIED | rss-sources.ts のdedupブロック完全削除確認 |
| FILT-01 | 08-02-PLAN | 非投資記事（スポーツ、芸能、天気等）がキーワードdenylistにより除外される | SATISFIED | `isDenylisted` + 投資例外ルール実装、テスト8件PASS |
| FILT-02 | 08-02-PLAN | 全ニュースソースに統一の24時間以内時間フィルタが適用される | SATISFIED | `filterByTime` 実装、テスト4件PASS |

**REQUIREMENTS.md との整合性:** DEDUP-01/02/03・FILT-01/02 全て "Complete" とマーキング済み。フェーズ8対象外のFILT-03/04・INTG-01/02・METR-01/02 は未チェック（Phase 9/10 対象）。孤立要件なし。

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | 検出なし |

スキャン対象: `filter.ts`、`filter.test.ts`、`types.ts`、`rss-sources.ts`
- 未解決デットマーカー (TBD/FIXME/XXX): 0件
- プレースホルダー文言: 0件
- console.log (フィルタ関数内): 0件
- return null/return []/return {} スタブ: 0件 (filterByTime等の空配列返却はフィルタ結果として正当)

---

### Human Verification Required

なし — 本フェーズはピュア関数モジュールのTDD構築のみ。全挙動がユニットテストで機械的に検証可能。

---

## Summary

Phase 8 のゴールは完全に達成されている。

`src/data/news/filter.ts` は以下を実現するピュア関数モジュールとして実装された:
- **Pass 1 (DEDUP-01):** URL正規化（クエリパラメータ除去）による重複排除。summaryが長い方を保持
- **Pass 2 (DEDUP-02):** NFKC正規化 + 【】ブラケット除去 + Jaccard閾値0.75によるタイトル類似度重複排除。同一言語グループ内のみ比較（D-03）
- **Pass 3 (FILT-01):** denylist（娯楽・スポーツ・天気）+ 投資キーワード例外ルール
- **Pass 4 (FILT-02):** 24時間以内時間フィルタ

`rss-sources.ts` の旧式50文字プレフィックスdedup（DEDUP-03）は完全削除され、フィルタ責務が filter.ts に一元化されている。

全19テスト・全体77テストがPASS。デットマーカーなし。

---

_Verified: 2026-06-27T14:14:00Z_
_Verifier: Claude (gsd-verifier)_
