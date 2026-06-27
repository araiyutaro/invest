# Phase 8: News Filter Module - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 4 (2 new, 2 modified)
**Analogs found:** 4 / 4

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/data/news/filter.ts` | utility (pure functions) | transform | `src/data/news/finnhub.ts` | role-match |
| `src/data/news/filter.test.ts` | test | unit | `src/scripts/validate-meeting.test.ts` | exact |
| `src/data/news/types.ts` | model (型追加) | — | `src/data/news/types.ts` | exact (self) |
| `src/data/news/rss-sources.ts` | utility (surgical delete) | request-response | `src/data/news/rss-sources.ts` | exact (self) |

---

## Pattern Assignments

### `src/data/news/filter.ts` (utility, transform)

**Analog:** `src/data/news/finnhub.ts`

**Imports pattern** (`finnhub.ts` lines 1-2):
```typescript
import type { RawNewsArticle } from "./types.js";
```
- ESM `.js` 拡張子必須（TypeScript ソースでも `.js` を使う）
- 型のみ参照の場合は `import type` を使用

**ReadonlyArray return type pattern** (`finnhub.ts` lines 28-30):
```typescript
async function fetchNewsByCategory(
  apiKey: string,
  category: string,
): Promise<ReadonlyArray<RawNewsArticle>> {
```
- `filter.ts` のヘルパー関数も同様に `ReadonlyArray<RawNewsArticle>` を返す
- 入力は `ReadonlyArray<RawNewsArticle>`、内部でスプレッドして変換

**24h 時間フィルタ core pattern** (`finnhub.ts` lines 39-42):
```typescript
const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
return items
  .filter((item) => item.datetime * 1000 > oneDayAgo)
  .map(toRawArticle);
```
- `filter.ts` の `filterByTime()` はこのパターンを踏襲する
- `RawNewsArticle` では `publishedAt: Date` なので `.getTime()` を使う:
  ```typescript
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return articles.filter(a => a.publishedAt.getTime() > oneDayAgo);
  ```

**Immutable array manipulation pattern** (`rss-sources.ts` lines 102-107):
```typescript
const allArticles = results.flat();
const sorted = [...allArticles].sort(
  (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
);
return sorted.slice(0, source.maxArticles);
```
- スプレッド演算子 `[...array]` で元配列を変更せずコピー
- `filter.ts` でも同様に入力配列を直接変更しない

**Null 返却・console.error pattern** (`finnhub.ts` lines 51-66):
```typescript
if (!apiKey) {
  console.error("FINNHUB_API_KEY is not set. Skipping Finnhub news fetch.");
  return { general: [], merger: [] };
}
// ...
fetchNewsByCategory(apiKey, "general").catch((error) => {
  console.error("Failed to fetch Finnhub general news:", error);
  return [] as ReadonlyArray<RawNewsArticle>;
}),
```
- プロジェクトに集中ロガーなし。`console.error` を直接使用
- エラー時は throw しない。空配列または null 返却で継続

**Delete target pattern** (`rss-sources.ts` lines 155-161) — Plan 08-02 で完全削除:
```typescript
// 削除対象: この7行を丸ごと除去する
const seen = new Set<string>();
const deduplicated = allArticles.filter((article) => {
  const key = article.title.slice(0, 50);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```
削除後、`deduplicated` の参照を `allArticles` に置き換えてソートに繋げる。

---

### `src/data/news/filter.test.ts` (test, unit)

**Analog:** `src/scripts/validate-meeting.test.ts`

`filter.ts` はピュア関数のみ（I/O なし）なので `vi.mock` 不要。`validate-meeting.test.ts` の純粋関数テストパターンが最適。

**Imports pattern** (`validate-meeting.test.ts` lines 1-2):
```typescript
import { describe, it, expect } from "vitest";
import { analystRound1OutputSchema, ... } from "../meeting/schemas.js";
```
- `filter.test.ts` では vi.mock を使わず直接 import する
- `.js` 拡張子必須:
  ```typescript
  import { describe, it, expect } from "vitest";
  import { filterNewsArticles } from "./filter.js";
  import type { RawNewsArticle } from "./types.js";
  ```

**Test helper factory pattern** (RESEARCH.md の `makeArticle` パターン):
```typescript
const makeArticle = (overrides: Partial<RawNewsArticle>): RawNewsArticle => ({
  title: 'デフォルトタイトル',
  summary: 'デフォルト本文',
  source: 'TestSource',
  url: 'https://example.com/article',
  publishedAt: new Date(),
  category: 'japan_market',
  ...overrides,
});
```
- テストケース内の article 生成はすべてこの factory を経由する
- `RawNewsArticle` の `readonly` 制約を満たすため型注釈必須

**describe/it/expect 構造** (`validate-meeting.test.ts` lines 60-70):
```typescript
describe("filterNewsArticles", () => {
  it("同一URLの記事が1件に集約される (DEDUP-01)", () => {
    const articles = [
      makeArticle({ url: 'https://nikkei.com/article/1', summary: '短い' }),
      makeArticle({ url: 'https://nikkei.com/article/1', summary: 'こちらの方が長い本文' }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].summary).toBe('こちらの方が長い本文');
  });
});
```
- テスト名に要件 ID を括弧書きで添える（`(DEDUP-01)` 等）
- `expect(...).toHaveLength()` / `expect(...).toBe()` を使用
- `beforeEach` / `afterEach` は不要（ピュア関数テストに副作用なし）

**Property assertion pattern** (`validate-meeting.test.ts` lines 66-70):
```typescript
expect(() => validateMeetingResult(validMeetingResult)).not.toThrow();
const result = validateMeetingResult(validMeetingResult);
expect(result.date).toBe("2026-06-24");
expect(result.marketOverview.trend).toBe("上昇");
```
- `not.toThrow()` パターンは今回は不要。`filterNewsArticles` は throw しない設計
- ネストされたプロパティは `result.articles[0].summary` のようにドット記法でアクセス

---

### `src/data/news/types.ts` (model, 型追加)

**Analog:** `src/data/news/types.ts` (self — 既存パターンを踏襲して追加)

**Existing readonly interface pattern** (`types.ts` lines 1-8):
```typescript
export interface RawNewsArticle {
  readonly title: string;
  readonly summary: string;
  readonly source: string;
  readonly url: string;
  readonly publishedAt: Date;
  readonly category: string;
}
```
- 全プロパティに `readonly` を付与する（イミュータビリティ必須）
- `export interface` で named export（default export は使わない）

**追加する型の構造** (RESEARCH.md Code Examples):
```typescript
export interface NewsFilterStats {
  readonly raw: number;
  readonly afterUrlDedup: number;
  readonly afterTitleDedup: number;
  readonly afterRelevance: number;
  readonly final: number;
}

export interface NewsFilterResult {
  readonly articles: ReadonlyArray<RawNewsArticle>;
  readonly stats: NewsFilterStats;
}
```
- `articles` は `ReadonlyArray<RawNewsArticle>`（`RawNewsArticle[]` ではない）
- 既存の `NewsDigest`, `MarketNews` に続けてファイル末尾に追記する

---

### `src/data/news/rss-sources.ts` (surgical delete, lines 155-161)

**Analog:** `src/data/news/rss-sources.ts` (self)

**削除対象ブロック** (`rss-sources.ts` lines 155-161):
```typescript
  const seen = new Set<string>();
  const deduplicated = allArticles.filter((article) => {
    const key = article.title.slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
```

**削除後の `fetchAllRssNews` 末尾** (`rss-sources.ts` lines 150-166 → 削除後):
```typescript
export async function fetchAllRssNews(): Promise<ReadonlyArray<RawNewsArticle>> {
  const results = await Promise.all(RSS_SOURCES.map(fetchSource));

  const allArticles = results.flat();

  return allArticles.sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );
}
```
- `deduplicated` 変数を除去し、`allArticles` を直接 `sort` して return する
- 7行削除・2行変更（`return deduplicated.sort(...)` → `return allArticles.sort(...)`）

---

## Shared Patterns

### readonly + イミュータビリティ
**Source:** `src/data/news/types.ts` (全 interface)、`src/data/news/finnhub.ts` line 29
**Apply to:** `filter.ts` の全関数シグネチャ、`types.ts` の新規 interface

```typescript
// 入力は ReadonlyArray、内部でスプレッドして新配列を生成
function deduplicateByUrl(
  articles: ReadonlyArray<RawNewsArticle>
): RawNewsArticle[] {
  const working = [...articles]; // スプレッドでコピー
  // ...
}
```

### ESM `.js` 拡張子
**Source:** `src/data/news/finnhub.ts` line 1、`src/scripts/collect-data.test.ts` lines 15-28
**Apply to:** `filter.ts` の import、`filter.test.ts` の import

```typescript
// TypeScript ソースからのインポートも .js 拡張子を使う
import type { RawNewsArticle } from "./types.js";
import { filterNewsArticles } from "./filter.js";
```

### console.error（集中ロガーなし）
**Source:** `src/data/news/finnhub.ts` lines 52, 60, 63; `src/data/news/google-news.ts` line 73
**Apply to:** `filter.ts` の warning 出力（過剰除外の検知等）

```typescript
// プロジェクト標準: console.error を直接使用
console.error("Failed to fetch Finnhub general news:", error);
```

### ReadonlyArray vs 配列リテラル
**Source:** `src/data/news/finnhub.ts` lines 28-30、`rss-sources.ts` lines 90-92
**Apply to:** `filter.ts` の全関数 return 型

```typescript
// 外部 API: ReadonlyArray<T> で返す
// 内部処理中: T[] を使い、return 時に ReadonlyArray<T> にキャスト
```

---

## No Analog Found

なし — 全4ファイルに対して既存アナログが見つかった。

---

## Metadata

**Analog search scope:** `src/data/news/`, `src/scripts/`
**Files scanned:** 6 (`types.ts`, `finnhub.ts`, `rss-sources.ts`, `google-news.ts`, `collect-data.test.ts`, `validate-meeting.test.ts`)
**Pattern extraction date:** 2026-06-27

### 削除確認コマンド (Plan 08-02 完了検証用)
```bash
grep -n "title.slice(0, 50)\|seen.has" src/data/news/rss-sources.ts
# 出力がゼロ行なら削除完了
```
