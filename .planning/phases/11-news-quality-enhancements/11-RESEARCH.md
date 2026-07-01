# Phase 11: News Quality Enhancements — Research

*Research completed: 2026-06-30*
*Source: Direct codebase analysis — all line numbers verified*

---

## 1. Finnhub API Integration (`src/data/news/finnhub.ts`)

### 現状の構造 (71行)

**`FinnhubNewsItem` インターフェース (lines 3-13)**
```typescript
interface FinnhubNewsItem {
  readonly category: string;
  readonly datetime: number;   // Unix timestamp (秒単位)
  readonly headline: string;
  readonly id: number;
  readonly image: string;
  readonly related: string;    // ティッカーシンボルを含む場合がある
  readonly source: string;
  readonly summary: string;
  readonly url: string;
}
```

**`toRawArticle()` (lines 15-24)**
- `item.datetime * 1000` で Unix秒 → Date に変換
- `category` はAPIから受け取った値をそのまま渡す
- 現在 `ticker` フィールドを設定していない → NEWS-01 (D-03) で追加が必要

**`fetchNewsByCategory(apiKey, category)` (lines 26-43)**
- エンドポイント: `https://finnhub.io/api/v1/news?category=${category}&token=${apiKey}`
- 24時間フィルタを内部適用 (lines 39-42): `item.datetime * 1000 > oneDayAgo`
- 戻り値: `Promise<ReadonlyArray<RawNewsArticle>>`

**`FinnhubNews` エクスポート型 (lines 45-48)**
```typescript
export interface FinnhubNews {
  readonly general: ReadonlyArray<RawNewsArticle>;
  readonly merger: ReadonlyArray<RawNewsArticle>;
}
```
→ NEWS-01 で `company: ReadonlyArray<RawNewsArticle>` を追加

**`fetchAllFinnhubNews()` (lines 50-70)**
- `FINNHUB_API_KEY` 未設定時: `{ general: [], merger: [] }` を返して graceful degradation (line 54)
- `general` と `merger` を `Promise.all` で並行取得 (lines 58-67)
- エラーハンドリングパターン (lines 59-66):
  ```typescript
  fetchNewsByCategory(apiKey, "general").catch((error) => {
    console.error("Failed to fetch Finnhub general news:", error);
    return [] as ReadonlyArray<RawNewsArticle>;
  })
  ```

### NEWS-01 統合ポイント

**新エンドポイント**: `GET /api/v1/company-news?symbol={symbol}&from={YYYY-MM-DD}&to={YYYY-MM-DD}&token={token}`
- レスポンス形式: `FinnhubNewsItem[]` と同一構造

**追加が必要なもの**:
1. `fetchCompanyNews(apiKey: string, symbol: string): Promise<ReadonlyArray<RawNewsArticle>>`
2. `toRawArticle()` に `ticker` パラメータを追加してオプショナルフィールドに渡す
3. `FinnhubNews` 型に `company` フィールドを追加
4. `fetchAllFinnhubNews()` 内で US ティッカー8件を `Promise.all` で並行取得

**日付フォーマット**: company-news の `from`/`to` は `YYYY-MM-DD` 形式が必要。
```typescript
const today = new Date();
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
const to = today.toISOString().slice(0, 10);
const from = yesterday.toISOString().slice(0, 10);
```

**Rate limit**: Finnhub free tier = 60 req/min。general + merger + 8 company-news = 10 リクエスト → 問題なし。

---

## 2. Filter Pipeline (`src/data/news/filter.ts`)

### エクスポート一覧 (198行)

| 関数/定数 | 行 | 役割 |
|---|---|---|
| `normalizeUrl(url)` | 11-18 | URL正規化（クエリパラメータ除去、hostname+pathname） |
| `normalizeTitle(title)` | 23-31 | NFKC正規化・ブラケット除去・空白正規化・小文字化 |
| `tokenize(normalized)` | 36-40 | 空白/句読点でsplit、2文字未満除外、Set返却 |
| `jaccardSimilarity(a, b)` | 45-50 | Jaccard類似度（両方空=1.0、union=0なら0） |
| `isDenylisted(title)` | 142-150 | denylist判定（投資キーワード例外あり） |
| `filterByRelevance(articles)` | 155-159 | denylistフィルタ（タイトルのみ対象） |
| `filterByTime(articles)` | 165-170 | 24時間フィルタ |
| `filterNewsArticles(articles)` | 179-197 | メイン4パスパイプライン → `NewsFilterResult` |
| `DENYLIST_PATTERNS` | 123-127 | スポーツ・芸能・天気の除外正規表現 |
| `FINANCIAL_EXCEPTION_KEYWORDS` | 132-136 | 投資キーワード例外正規表現 |

### 非エクスポート（内部関数）

| 関数 | 行 | 役割 |
|---|---|---|
| `isJapaneseTitle(title)` | 55-59 | 非ASCII文字 >= 50% なら日本語と判定 |
| `deduplicateByUrl(articles)` | 64-77 | URL重複除去 (Map使用)、summary長い方を残す |
| `deduplicateByTitle(articles)` | 83-117 | Jaccard重複除去 (O(n²))、**同言語グループ内のみ** |

### `filterNewsArticles()` 現行パイプライン (lines 179-197)

```
Pass 1: deduplicateByUrl()     → stats.afterUrlDedup
Pass 2: deduplicateByTitle()   → stats.afterTitleDedup
Pass 3: filterByRelevance()    → stats.afterRelevance
Pass 4: filterByTime()         → stats.final
```
戻り値: `NewsFilterResult { articles: RawNewsArticle[], stats: NewsFilterStats }`

### 現行の言語グループ分離 (lines 83-117)

- `isJapaneseTitle()` で EN/JP を判定し、`deduplicateByTitle()` 内で異言語ペアはスキップ
  ```typescript
  if (isJapaneseI !== isJapaneseJ) continue;  // line 99
  ```
- **NEWS-03**: この `continue` を拡張し、固有名詞+日付近接条件を満たす異言語ペアもdedup対象にする

### NEWS-03 統合ポイント

**オプションA**: `filterNewsArticles()` に Pass 2.5 を追加（推奨）
- `deduplicateByTitle()` 後、`filterByRelevance()` 前に cross-lang dedup を挿入
- `NewsFilterStats` に `afterCrossLangDedup?: number` を追加
- 既存 integration test (line 274-329) の stats 期待値への影響: テストデータで cross-lang dedup が発火しないよう設計すれば変更不要

**オプションB**: `deduplicateByTitle()` 内に cross-lang ロジックを追加
- コンパクトだが単一責任原則から外れる

### NEWS-02 統合ポイント

- D-06: `RawNewsArticle` に `score` フィールドを追加しない
- スコアリングは一時的な計算値として扱う
- 実装場所: `filter.ts` に `scoreArticle(article: RawNewsArticle, now: number): number` をエクスポート
- `filterNewsArticles()` でフィルタ後にスコアソートして返す（内部でスコア計算、型は変えない）

```typescript
// 一時配列パターン（型変更なし）
const scored = articles.map(a => ({ article: a, score: scoreArticle(a, Date.now()) }));
const sorted = scored.sort((a, b) => b.score - a.score || b.article.publishedAt.getTime() - a.article.publishedAt.getTime());
return sorted.map(s => s.article);
```

---

## 3. Type Definitions (`src/data/news/types.ts`)

### `RawNewsArticle` (lines 1-8) — 現状
```typescript
export interface RawNewsArticle {
  readonly title: string;
  readonly summary: string;
  readonly source: string;
  readonly url: string;
  readonly publishedAt: Date;
  readonly category: string;
  // ← ticker フィールドなし
}
```

**D-03 変更**: `readonly ticker?: string` を追加
- optional なので既存の `makeArticle()` テストヘルパーは変更不要
- RSS/Google News 記事は `ticker` を設定しない（ポートフォリオボーナスなし）

### `NewsFilterStats` (lines 23-30) — 現状
```typescript
export interface NewsFilterStats {
  readonly raw: number;
  readonly afterUrlDedup: number;
  readonly afterTitleDedup: number;
  readonly afterRelevance: number;
  readonly final: number;
}
```

NEWS-03 で Pass 2.5 を追加する場合: `readonly afterCrossLangDedup?: number` を追加
（optional にして後方互換を維持）

### `NewsFilterResult` (lines 31-34)
変更不要。

---

## 4. RSS / Google News Fetching

### `src/data/news/rss-sources.ts` (159行)
- `toRawArticle()` (lines 41-57): `ticker` フィールドなし（汎用ニュース）
- `fetchAllRssNews()` (line 150): 5ソースを `Promise.all` 並行取得、publishedAt降順ソートして返す
- ソース: Investing.com(20件), Yahoo!ニュース(15件), 東洋経済(10件), 日経ビジネス(10件), NHK経済(10件)

### `src/data/news/google-news.ts` (89行)
- `toRawArticle()` (lines 30-39): `ticker` フィールドなし
- `fetchGoogleNewsJapan()` (line 48): MAX_ARTICLES=20、日付降順ソート後に返す

---

## 5. Collection Pipeline (`src/scripts/collect-data.ts`)

### ニュース収集フロー (lines 31-63)

```typescript
// Line 32-36: 並行収集（Promise.all）
const [finnhubNews, googleNews, rssNews] = await Promise.all([
  fetchAllFinnhubNews(),
  fetchGoogleNewsJapan().catch(() => []),
  fetchAllRssNews().catch(() => []),
]);

// Lines 37-42: フラットマージ
const allArticles = [
  ...finnhubNews.general,
  ...finnhubNews.merger,
  ...googleNews,
  ...rssNews,
];

// Line 43: フィルタリング
const { articles: filtered, stats } = filterNewsArticles(allArticles);

// Lines 45-51: MAX=80 超過時のトリミング（現状: publishedAt 降順）
if (filtered.length > 80) {
  finalArticles = [...filtered]
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 80);
}

// Lines 52-54: MIN=20 警告
if (finalArticles.length < 20) {
  console.log(`⚠ フィルタ後の記事が${finalArticles.length}件です（MIN=20未満）`);
}
```

### NEWS-01 統合ポイント

**Line 37-42**: `finnhubNews.company` をマージ配列に追加
```typescript
const allArticles = [
  ...finnhubNews.general,
  ...finnhubNews.merger,
  ...finnhubNews.company,   // ← 追加
  ...googleNews,
  ...rssNews,
];
```

### NEWS-02 統合ポイント

**Lines 45-51**: `filterNewsArticles()` がスコアソート済みを返す場合、line 49 のソートは不要か、score→date の secondary sort のみになる。

**推奨アプローチ**: `filterNewsArticles()` 内部でスコアソートして返す（Option 1）
→ collect-data.ts の MAX=80 `.slice(0, 80)` が自然に最高優先度記事を取得

---

## 6. Portfolio Holdings (`src/portfolio/holdings.ts`)

### 全保有銘柄 (21行)

```typescript
export const PORTFOLIO_HOLDINGS: ReadonlyArray<PortfolioHolding> = [
  { symbol: "MRNA", ... },   // US株
  { symbol: "JOBY", ... },   // US株
  { symbol: "HII",  ... },   // US株
  { symbol: "POWL", ... },   // US株
  { symbol: "FLNC", ... },   // US株
  { symbol: "EE",   ... },   // US株
  { symbol: "8522.T", ... }, // 日本株 → Finnhub対象外 (D-01)
  { symbol: "5885.T", ... }, // 日本株
  { symbol: "5576.T", ... }, // 日本株
  { symbol: "7711.T", ... }, // 日本株
  { symbol: "NXT",  ... },   // US株
  { symbol: "BWMX", ... },   // US株
];
```

### NEWS-01 対象 US ティッカー抽出パターン

```typescript
import { PORTFOLIO_HOLDINGS } from "../portfolio/holdings.js";

const US_TICKERS = PORTFOLIO_HOLDINGS
  .filter(h => !h.symbol.endsWith(".T"))
  .map(h => h.symbol);
// → ["MRNA", "JOBY", "HII", "POWL", "FLNC", "EE", "NXT", "BWMX"] (8件)
```
ハードコードよりも動的フィルタ推奨（ポートフォリオ変更への追従）

---

## 7. Existing Tests (`src/data/news/filter.test.ts`)

### テストパターン

**`makeArticle()` ファクトリ (lines 5-13)**
```typescript
const makeArticle = (overrides: Partial<RawNewsArticle>): RawNewsArticle => ({
  title: "デフォルトタイトル",
  summary: "デフォルト本文",
  source: "TestSource",
  url: "https://example.com/article",
  publishedAt: new Date(),
  category: "japan_market",
  ...overrides,
});
```
- `ticker?: string` 追加後も `Partial<RawNewsArticle>` のため既存テストは変更不要
- 新テストでは `{ ticker: "MRNA", publishedAt: new Date(Date.now() - 1*60*60*1000) }` のように override

**テスト構成**

| describe | 行範囲 | テスト数 |
|---|---|---|
| URL dedup (DEDUP-01) | 15-76 | 4件 |
| Title Jaccard dedup (DEDUP-02) | 78-134 | 3件 |
| Language group separation (D-03) | 136-155 | 1件 |
| Relevance filter (FILT-01) | 157-234 | 7件 |
| Time filter (FILT-02) | 236-272 | 3件 |
| Integration 全4Pass (stats検証) | 274-329 | 1件 |

**Stats 検証の具体例 (lines 322-328)**
```typescript
expect(result.stats.raw).toBe(7);
expect(result.stats.afterUrlDedup).toBe(6);
expect(result.stats.afterTitleDedup).toBe(5);
expect(result.stats.afterRelevance).toBe(4);
expect(result.stats.final).toBe(3);
```
→ cross-lang dedup を追加する場合、この integration test のテストデータが cross-lang dedup を発火しないよう設計する（英語同士・日本語同士のみ使用）

**フレームワーク**: vitest (`describe`, `it`, `expect`) — `@testing-library` 等は不使用

---

## 8. Dependencies (`package.json`)

```json
{
  "dependencies": {
    "dotenv": "^17.3.1",
    "fast-xml-parser": "^5.5.6",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3",
    "yahoo-finance2": "^3.13.2",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^25.3.3",
    "vitest": "^4.0.18"
  }
}
```

- **NLP ライブラリなし** → D-10 確認済み
- `zod` は既存（NEWS-03 では使わないが他で利用）
- 固有名詞抽出は正規表現のみで実装: 英語は `\b[A-Z][a-zA-Z]+\b`、日本語はカタカナ語 `[ァ-ヶー]{3,}` + 英字混在語

---

## 9. Integration Plan Summary

### 実装順序（依存関係グラフ）

```
Step 1: types.ts
  └── RawNewsArticle に `readonly ticker?: string` を追加 (D-03)
  └── NewsFilterStats に `readonly afterCrossLangDedup?: number` を追加 (NEWS-03)

Step 2: finnhub.ts  ← types.ts に依存
  ├── fetchCompanyNews(apiKey, symbol) を追加
  ├── toRawArticle() に ticker パラメータを追加
  └── FinnhubNews 型に company フィールドを追加

Step 3: filter.ts  ← types.ts に依存（独立して開発可能）
  ├── NEWS-02: scoreArticle(article, now) をエクスポート
  ├── NEWS-02: filterNewsArticles() の最後にスコアソートを追加
  ├── NEWS-03: deduplicateCrossLanguage() を追加
  └── NEWS-03: filterNewsArticles() に Pass 2.5 として挿入

Step 4: collect-data.ts  ← finnhub.ts + filter.ts に依存
  ├── NEWS-01: finnhubNews.company をマージ配列に追加
  └── NEWS-02: MAX=80 sort ロジックをスコア基準に更新（filterNewsArticles がソート済みを返す場合は slice(0,80) のみ）
```

### 各機能の実装場所マップ

| 機能 | ファイル | 変更種別 |
|---|---|---|
| NEWS-01: ticker フィールド | `types.ts` line 7後 | フィールド追加 |
| NEWS-01: company news fetch 関数 | `finnhub.ts` | 新規関数追加 |
| NEWS-01: FinnhubNews 型拡張 | `finnhub.ts` line 45-48 | フィールド追加 |
| NEWS-01: fetchAllFinnhubNews 拡張 | `finnhub.ts` line 50-70 | US ticker 並行取得追加 |
| NEWS-01: pipeline 統合 | `collect-data.ts` line 38 | `...finnhubNews.company` 追加 |
| NEWS-02: scoreArticle 関数 | `filter.ts` | 新規エクスポート |
| NEWS-02: sort 適用 | `filter.ts` filterNewsArticles 末尾 | sort 追加 |
| NEWS-02: collect-data sort 更新 | `collect-data.ts` line 49 | score 基準 sort に変更 |
| NEWS-03: cross-lang dedup 関数 | `filter.ts` | 新規内部関数 |
| NEWS-03: Pass 2.5 挿入 | `filter.ts` line 182-186 | pipeline 変更 |
| NEWS-03: stats フィールド追加 | `types.ts` line 23-30 | optional フィールド追加 |

### 推奨 Wave 分割

- **Plan 11-01**: NEWS-01（データ層） — types.ts + finnhub.ts + collect-data.ts 統合
- **Plan 11-02**: NEWS-02 + NEWS-03（フィルタ層） — filter.ts 拡張 + テスト

---

## 10. Risk Areas

1. **Finnhub company-news API 日付フォーマット**: `from`/`to` は `YYYY-MM-DD` 形式。`Date.toISOString().slice(0, 10)` で取得。タイムゾーン差異に注意（UTC基準）。

2. **`ticker` 未設定記事のスコアリング**: RSS・Google News 記事は `ticker === undefined` のため、ポートフォリオボーナス (+0.2) は付与されない。`article.ticker !== undefined` チェック必須。

3. **スコアの型安全性**: D-06 により `RawNewsArticle` に `score` フィールドなし。一時的な `{ article: RawNewsArticle; score: number }[]` 配列を使うパターンが最も安全。

4. **cross-lang dedup と integration test の stats 競合**: `afterCrossLangDedup` を optional にすれば既存テストに影響しないが、新テストで stats を明示的に検証すること。

5. **固有名詞抽出の精度限界**: 日本語側のカタカナ語 (`/[ァ-ヶー]{3,}/g`) は企業名（モデルナ、ジョビー等）を拾えるが、漢字固有名詞（例: 名古屋銀行）は抽出困難。D-08（保守的アプローチ）なので false negative は許容。

6. **日付近接の時間閾値**: D-07 で「日付近接」の具体的な時間幅が明示されていない。CONTEXT.md 実装メモに従うか、±2h を定数として実装して調整しやすくすること。

7. **company-news とカテゴリニュースの重複**: `MRNA` の company-news と `general` ニュースで同記事が来た場合、既存の Pass 1 (URL dedup) と Pass 2 (Jaccard dedup) が除去する。特別対応不要。

8. **`makeArticle()` テストヘルパーへの影響**: `ticker` フィールドは optional なので既存の `makeArticle()` 呼び出しは変更不要。新テストでは `ticker: "MRNA"` を明示的に渡す。
