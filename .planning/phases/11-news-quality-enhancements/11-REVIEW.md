---
status: clean
phase: 11
depth: standard
files_reviewed:
  - src/data/news/types.ts
  - src/data/news/filter.ts
  - src/data/news/finnhub.ts
  - src/scripts/collect-data.ts
findings_count: 2
critical: 0
warning: 0
info: 2
---

# Code Review: Phase 11 — News Quality Enhancements

## Summary

Phase 11 の全ソースファイルをレビュー。Critical/Warning の問題なし。Immutable パターン、エラーハンドリング、後方互換性すべて良好。

## Findings

### Info-01: 不要な配列コピー

**File:** `src/scripts/collect-data.ts:50,53`
**Severity:** Info

`filterNewsArticles` の戻り値 `filtered` は `sortByPriorityScore` 内で `[...articles].sort()` により新しい配列が生成されているため、`let finalArticles = [...filtered]` と `[...filtered].slice(0, 80)` の追加コピーは不要。

```typescript
// 現状（不要なコピー）
let finalArticles = [...filtered];
if (filtered.length > 80) {
  finalArticles = [...filtered].slice(0, 80);
}

// 改善案
let finalArticles = filtered.length > 80
  ? filtered.slice(0, 80)
  : filtered;
```

影響: パフォーマンスへの実質的影響はない（記事数は最大80件程度）。

### Info-02: jpNouns の重複計算

**File:** `src/data/news/filter.ts:107`
**Severity:** Info

`deduplicateCrossLanguage` 内で `extractProperNouns(jpArticle.title)` が EN 記事ごとに再計算される。JP 記事の固有名詞を事前計算することで計算量を削減可能。

```typescript
// 改善案: jpEntries 構築時に nouns を事前計算
const jpEntries = articles
  .map((a, i) => ({ a, i, nouns: isJapaneseTitle(a.title) ? extractProperNouns(a.title) : null }))
  .filter(({ nouns }) => nouns !== null);
```

影響: 記事数100件未満では無視できる。将来的に記事数が増加した場合のみ検討。

## Positive Observations

- Immutable パターンが一貫して使用されている（`ReadonlyArray`, `[...].sort()`, `[...].filter()`）
- `filterNewsArticles` の第2引数がデフォルト値で後方互換を維持
- Finnhub API キーがエラーメッセージに含まれない設計
- `fetchCompanyNews` の各ティッカーエラーが個別にキャッチされ、1銘柄の失敗が全体を止めない
- テストカバレッジが充実（53テスト）
