# Summary: 11-01 Finnhub Company News + Time-Weighted Scoring

## What was built

Finnhub APIによるポートフォリオ保有US銘柄ごとのカンパニーニュース取得機能と、時間重み付けスコアリングによる記事優先度ソート機能を実装した。

## Key changes

- `RawNewsArticle` に `ticker?: string` フィールドを追加
- `calculatePriorityScore`: 時間ティア（0-6h=1.0, 6-12h=0.7, 12-24h=0.4）+ ポートフォリオティッカーボーナス(+0.2)でスコア計算
- `sortByPriorityScore`: スコア降順ソート（同スコアは新しい記事優先）
- `filterNewsArticles`: 第2引数 `portfolioTickers` を追加（デフォルト`[]`で後方互換）、Pass 5としてスコアソートを追加
- `fetchCompanyNews`: Finnhub company-news APIでティッカー別ニュース取得
- `FinnhubNews` インターフェースに `company` フィールド追加
- `fetchAllFinnhubNews`: `companyTickers` パラメータ追加、各ティッカーのカンパニーニュース並列取得
- `collect-data.ts`: USティッカー抽出 → fetchAllFinnhubNews に渡す → filterNewsArticles にティッカー渡す → MAX=80トリミングからソートを削除（スコアソート済み）

## Self-Check: PASSED

- 36 tests passing (filter: 32, finnhub: 4)
- TypeScript compilation clean
- Backward compatible (filterNewsArticles default arg)

## key-files

### created
- src/data/news/finnhub.test.ts

### modified
- src/data/news/types.ts
- src/data/news/filter.ts
- src/data/news/filter.test.ts
- src/data/news/finnhub.ts
- src/scripts/collect-data.ts

## Deviations

None — plan followed exactly.
