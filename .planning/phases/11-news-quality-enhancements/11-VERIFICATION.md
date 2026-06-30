---
status: passed
phase: 11
phase_name: News Quality Enhancements
verified_at: 2026-06-30
requirements: NEWS-01, NEWS-02, NEWS-03
must_haves_verified: 3/3
---

# Verification: Phase 11 — News Quality Enhancements

## Goal Verification

**Phase Goal:** アナリストに供給されるニュースが銘柄別Finnhubデータ・時間重み付け・クロス言語dedupによって品質向上する

**Result:** PASSED — 全3要件を充足

## Success Criteria Check

### SC-1: Finnhubティッカー別カンパニーニュース取得・統合
**Status:** PASSED

Evidence:
- `finnhub.ts:46-72` — `fetchCompanyNews` がティッカー別に company-news API を呼び出す
- `finnhub.ts:80-112` — `fetchAllFinnhubNews(companyTickers)` が各ティッカーを並列取得
- `collect-data.ts:32-34` — USティッカーを `PORTFOLIO_HOLDINGS` から抽出（`.` 含むJP銘柄を除外）
- `collect-data.ts:37` — `fetchAllFinnhubNews(usTickers)` に渡す
- `collect-data.ts:44` — `...finnhubNews.company` で汎用ニュースと統合
- `finnhub.test.ts` — 4テストで company フィールド・ticker フィールドの存在と値を検証

### SC-2: 時間重み付けスコアリングによる記事優先度ソート
**Status:** PASSED

Evidence:
- `filter.ts:235-257` — `calculatePriorityScore` が3段階時間ティア（0-6h=1.0, 6-12h=0.7, 12-24h=0.4）+ ポートフォリオティッカーボーナス(+0.2)を計算
- `filter.ts:259-270` — `sortByPriorityScore` がスコア降順（同スコアは新しい記事優先）でソート
- `filter.ts:290` — `filterNewsArticles` パイプラインの Pass 5 として統合
- `filter.test.ts` — 7テスト（calculatePriorityScore） + 4テスト（sortByPriorityScore） + 2テスト（統合）で検証

### SC-3: クロス言語（英日）重複排除
**Status:** PASSED

Evidence:
- `filter.ts:61-77` — `extractProperNouns` がタイトルから固有名詞セット（年、四半期、ティッカー、固有名詞）を抽出
- `filter.ts:79-122` — `deduplicateCrossLanguage` が共通固有名詞>=2 + 時間差<=6h のEN/JPペアを集約（summary長い方を残す）
- `filter.ts:287` — パイプラインの Pass 2.5 として統合
- `types.ts:26` — `afterCrossLangDedup` フィールドを `NewsFilterStats` に追加
- `filter.test.ts` — 8テスト（extractProperNouns） + 7テスト（deduplicateCrossLanguage） + 2テスト（統合）で検証

## Test Suite

- **Total:** 117 tests passing
- **filter.test.ts:** 49 tests (dedup, relevance, time, priority score, cross-language)
- **finnhub.test.ts:** 4 tests (company news API)
- **collect-data.test.ts:** 13 tests (integration, pipeline)
- **Other:** 51 tests (market, portfolio, existing)

## Requirement Traceability

| Requirement | Description | Status |
|-------------|-------------|--------|
| NEWS-01 | Finnhubティッカー別カンパニーニュース取得 | Verified |
| NEWS-02 | 時間重み付けスコアリング | Verified |
| NEWS-03 | クロス言語重複排除 | Verified |

## Notes

- 後方互換性維持: `filterNewsArticles` の第2引数はデフォルト `[]`、`fetchAllFinnhubNews` もデフォルト `[]`
- 保守的アプローチ: クロス言語dedupは偽陰性より偽陽性を避ける設計（共通トークン>=2必須）
- `isJapaneseTitle` の50%閾値により、ASCII比率の高い短いJPタイトルは英語と判定される（既知の制約、意図的な設計）
