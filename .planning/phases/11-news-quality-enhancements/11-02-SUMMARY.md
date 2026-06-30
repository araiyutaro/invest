# Summary: 11-02 Cross-Language Dedup

## What was built

英語と日本語で同内容の記事をフィルターパイプラインの新Pass（Pass 2.5）で1件に集約するクロス言語重複排除機能を実装した。

## Key changes

- `extractProperNouns`: タイトルから固有名詞セット（4桁年、Q1-Q4、全大文字ティッカー2-5文字、大文字始まり固有名詞）を抽出
- `deduplicateCrossLanguage`: EN/JP記事ペアで共通固有名詞>=2かつ時間差<=6hの場合にsummaryが長い方を残す保守的アプローチ
- `NewsFilterStats` に `afterCrossLangDedup` フィールド追加
- `filterNewsArticles` パイプラインにPass 2.5として `deduplicateCrossLanguage` を挿入

## Self-Check: PASSED

- 53 tests passing (filter: 49, finnhub: 4)
- TypeScript compilation clean
- Backward compatible (no breaking changes)
- Conservative approach: false negatives preferred over false positives

## key-files

### created
None

### modified
- src/data/news/filter.ts
- src/data/news/filter.test.ts
- src/data/news/types.ts

## Deviations

- テストのJPタイトル "MRNA 2026年3Q 決算ミス" がASCII比率70%超で英語と判定されたため、"MRNA 2026年第3四半期決算がアナリスト予想を下回る" に変更。isJapaneseTitle の50%閾値に対する正しい動作。
