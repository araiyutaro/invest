---
phase: 19-data-foundation-holding-news-supply
verified: 2026-07-03T15:05:00Z
status: passed
score: 15/15 must-haves verified
overrides_applied: 0
---

# Phase 19: Data Foundation & Holding-News Supply Verification Report

**Phase Goal:** portfolio-analyst が、汚染のないティッカーデータに基づいて決定論的に抽出された保有銘柄別関連ニュースを入力として受け取る
**Verified:** 2026-07-03T15:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (Roadmap SC1) general/merger 記事の ticker が複数配列インデックス位置で検証しても常に undefined | ✓ VERIFIED | `src/data/news/finnhub.ts:43` は `.map((item) => toRawArticle(item))`。`grep "map(toRawArticle)"` は0件。`finnhub.test.ts:68-100` が index 0,1,2 の3件配列で全 `article.ticker` が `toBeUndefined()` を検証 |
| 2 | company 記事の ticker は既存どおりティッカーシンボルを保持する | ✓ VERIFIED | `fetchCompanyNews`（line 69-71）は変更なし。既存テスト「company記事のtickerフィールドがティッカーシンボルと一致する (D-03)」green |
| 3 | 回帰テストが3件以上の配列で全インデックスの ticker undefined を検証する | ✓ VERIFIED | `finnhub.test.ts:87` `[0, 1, 2].map((index) => buildMockItem(index))` で3件検証 |
| 4 | (Roadmap SC2) ticker一致による決定論的な保有銘柄別ニュースマッピング（優先度スコア順・上限付き）が生成されユニットテストでカバーされている | ✓ VERIFIED | `src/portfolio/holding-news.ts` の `buildHoldingNewsMap` + `holding-news.test.ts` 17テスト全green |
| 5 | 12銘柄すべてのキーを持つ holding-news マップが常に生成される（0件銘柄は空配列） | ✓ VERIFIED | `holding-news.test.ts:109-121`（`toHaveLength(12)` + 各 symbol が `[]`）、throw しないことも検証 |
| 6 | ticker一致が社名一致より優先され、上限超過時に ticker一致が残る | ✓ VERIFIED | `rankAndCapHoldingArticles`（`holding-news.ts:109-129`）がticker一致グループを先に連結。`holding-news.test.ts:161-183` で3ticker+3name→cap5でticker3件全残存を確認 |
| 7 | 社名フォールバックは記事タイトルのみを照合し、summary言及ではマッチしない（D-03） | ✓ VERIFIED | `resolveNameMatchType(title, holding)` はtitle文字列のみ受け取る設計（`holding-news.ts:56-67`）。`holding-news.test.ts:81-86` でsummary言及非対応を確認（構造的に評価不可） |
| 8 | matchAliases（例: Joby, 名古屋銀）が照合に参加する（D-04） | ✓ VERIFIED | `holdings.ts:16,21` に `matchAliases: ["Joby"]` / `["名古屋銀"]`。`holding-news.test.ts:88-106` で両方のマッチをテスト |
| 9 | 1銘柄あたり最大5件に切り捨てられる（D-09） | ✓ VERIFIED | `MAX_ARTICLES_PER_HOLDING = 5`（`holding-news.ts:6`）。`holding-news.test.ts:148-159` で8件→5件切り捨てを確認 |
| 10 | 社名フォールバックは日本株に限定されず全12銘柄に適用される（D-02） | ✓ VERIFIED | `matchArticlesForHolding` は holding種別を分岐しない。`holding-news.test.ts:134-144` でMRNA（米国株）と8522.T（日本株）両方の名前一致を確認 |
| 11 | (Roadmap SC3) portfolio-analyst のプロンプトに保有銘柄ごとの関連ニュースが明示的な入力セクションとして含まれている | ✓ VERIFIED | `.claude/commands/invest.md:1589` に「## 保有銘柄別関連ニュース」セクション（出現1回、plan通り） |
| 12 | collect-data 実行後、tmp/holding-news.json が12銘柄すべてのキーで生成される（ID参照方式、D-05） | ✓ VERIFIED | `collect-data.ts:67-72` が `buildHoldingNewsMap(idArticles, PORTFOLIO_HOLDINGS)` を呼び出し書き込み。`grep -c "holding-news.json"` = 2（成功+fail-soft） |
| 13 | ニュース取得失敗時も全12銘柄が空配列の holding-news.json が必ず書かれる（D-08） | ✓ VERIFIED | `collect-data.ts:76-84` catchブランチで `Object.fromEntries(PORTFOLIO_HOLDINGS.map((h) => [h.symbol, []]))` を書き込み |
| 14 | 0件銘柄は明示的に「本日の関連ニュースなし」が列挙される（D-11） | ✓ VERIFIED | `invest.md:1593` 「記事ID配列が空の銘柄には...『本日の関連ニュースなし（ニュース不在は問題なしを意味しない）』と明記する。0件銘柄であってもこの見出し自体を省略してはならない」 |
| 15 | ニュースなし銘柄への言及禁止・創作禁止のガード指示が添付される（D-12） | ✓ VERIFIED | `invest.md:1595,1597` 二重の「重要:」太字ガード（URL/タイトル創作禁止、ニュースなし銘柄への言及禁止） |

**Score:** 15/15 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/data/news/finnhub.ts` | index-as-ticker バグ修正済み `fetchNewsByCategory` | ✓ VERIFIED | line 43 `.map((item) => toRawArticle(item))`。exists, substantive, wired（`fetchAllFinnhubNews` から呼び出され使用） |
| `src/data/news/finnhub.test.ts` | NEWS-04 回帰テスト | ✓ VERIFIED | 新規 `it` ブロック（line 68-100）が `toBeUndefined` + 3件配列を含む |
| `src/portfolio/holding-news.ts` | 決定論的抽出モジュール（純粋関数群、150行） | ✓ VERIFIED | `buildHoldingNewsMap` / `matchesTicker` / `matchesHoldingByName` を export。`calculatePriorityScore` を import（再実装なし、`grep -c "ageHours"` = 0） |
| `src/portfolio/holding-news.test.ts` | D-01〜D-10 カバーテスト（219行） | ✓ VERIFIED | 17テスト、全 describe ブロックが D-01〜D-10 の設計判断を明示的にカバー |
| `src/portfolio/holdings.ts` | matchAliases フィールド追加 | ✓ VERIFIED | interface に `matchAliases?: ReadonlyArray<string>`、JOBY/8522.T のみ付与、POWL は未登録（意図通り） |
| `src/scripts/collect-data.ts` | holding-news.json 生成統合 | ✓ VERIFIED | import + 成功パス呼び出し + fail-softフォールバックの両方が実装され、idArticles/PORTFOLIO_HOLDINGSと正しく配線 |
| `.claude/commands/invest.md` | 保有銘柄別ニュース入力セクション | ✓ VERIFIED | Read リスト追加 + セクション本文 + 条件付きゲート + ガード指示すべて存在 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/data/news/finnhub.ts` | `toRawArticle` | 明示ラップ `.map((item) => toRawArticle(item))` | ✓ WIRED | line 43 に一致パターン確認 |
| `src/portfolio/holding-news.ts` | `calculatePriorityScore` | `filter.js` からの import | ✓ WIRED | line 1 `import { calculatePriorityScore } from "../data/news/filter.js"`、`rankAndCapHoldingArticles` 内で使用 |
| `src/portfolio/holding-news.ts` | `PortfolioHolding.matchAliases` | 社名フォールバック照合 | ✓ WIRED | `resolveNameMatchType` が `holding.matchAliases` を評価 |
| `src/scripts/collect-data.ts` | `buildHoldingNewsMap` | news.json 書き出し直後に呼び出し（D-06） | ✓ WIRED | line 67、news.json 書き出し（line 61-65）と同一 try ブロック内 |
| `.claude/commands/invest.md` | `tmp/holding-news.json` | portfolio-analyst の読み込みファイルリスト + 解決埋め込み指示 | ✓ WIRED | line 1564（Readリスト）+ line 1588-1598（セクション本文） |

### Data-Flow Trace (Level 4)

| Artifact | データ変数 | ソース | 実データ流入 | Status |
|----------|-----------|--------|--------------|--------|
| `collect-data.ts` の `holdingNews` | `buildHoldingNewsMap(idArticles, PORTFOLIO_HOLDINGS)` の返り値 | `idArticles`（実ニュースフィルタ結果）と実12銘柄定数 | 静的フォールバック・ハードコード空値ではない。実データ引数を渡す実装 | ✓ FLOWING |
| `invest.md` の holding-news セクション | `tmp/holding-news.json` の内容をLLMが読み込み解決 | collect-data.tsが実行時に生成する実ファイル | ファイルが存在すれば実データ、存在しなければセクション省略ゲートあり | ✓ FLOWING（構造上、静的値へのフォールバックなし） |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| finnhub.ts バグ修正の回帰テスト | `npx vitest run src/data/news/finnhub.test.ts` | 5 tests passed | ✓ PASS |
| holding-news.ts 抽出ロジック全体 | `npx vitest run src/portfolio/holding-news.test.ts`（`npx vitest run` に含む） | 17 tests passed | ✓ PASS |
| 全 suite 回帰確認 | `npx vitest run` | 206 tests passed, 14 files | ✓ PASS |
| 型チェック（フェーズ対象ファイル） | `npx tsc --noEmit -p tsconfig.json` | 対象ファイル（finnhub.ts/holdings.ts/holding-news.ts/collect-data.ts/invest.md）に関するエラー0件。既存の `collect-data.test.ts` implicit-any 4件のみ残存（Phase 15由来、deferred-items.mdに記録済み、本フェーズのスコープ外と確認） | ✓ PASS |
| collect-data.ts と holding-news.json の実行時生成（Finnhub API実呼び出し） | （未実行） | ライブ実行はネットワーク副作用を伴うため本検証では未実行 | ? SKIP（理由: 外部API呼び出しを伴うため。ユニットテストで純粋関数レベルは十分カバー済み） |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| NEWS-04 | 19-01 | 汎用ニュース記事の ticker フィールドに配列インデックスが混入する finnhub.ts のバグが修正され、ticker が正当な値のみを持つ | ✓ SATISFIED | 上記 truth 1-3 参照 |
| PORT-01 | 19-02 + 19-03 | portfolio-analyst が保有銘柄ごとの関連ニュース（ticker一致で決定論的抽出、優先度スコア順・上限付き）を入力として受け取る | ✓ SATISFIED | 上記 truth 4-15 参照 |

両requirement IDともREQUIREMENTS.mdのTraceabilityテーブルでPhase 19にマッピング済みで、オーファン要件なし。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| なし | - | TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER等のデバッグマーカーはフェーズ対象7ファイルいずれにも検出されず | - | - |
| `.planning/REQUIREMENTS.md` | 11,15 | NEWS-04/PORT-01 のチェックボックスが `[ ]`（未チェック）のまま、Traceabilityテーブルも「Pending」のまま | ℹ️ Info | 機能には影響しないドキュメント更新漏れ。フェーズ完了を正確に反映するため、REQUIREMENTS.mdのチェックボックスとTraceability status列を更新することを推奨 |
| `src/scripts/collect-data.test.ts` | - | holding-news.json 生成（成功パス・fail-softパス）を直接検証するintegrationテストが存在しない（news.json/portfolio.jsonには類似のTest 3/4/6が存在するが、holding-news.jsonの類似テストはなし） | ℹ️ Info | Plan 19-03のacceptance_criteriaはtsc型チェックのみを要求しており逸脱ではない。buildHoldingNewsMap自体は17件のユニットテストで徹底的にカバー済みのため機能リスクは低いが、将来の回帰保護のためcollect-data.test.tsへの統合テスト追加を推奨（次フェーズ以降で対応可） |

### Human Verification Required

なし。本フェーズの成果物（データ抽出ロジック・パイプライン配線・プロンプトテキスト）はすべて静的解析・grep・ユニットテスト実行で決定論的に検証可能であり、UI描画やリアルタイム挙動を含まない。collect-data.ts の実ライブ実行によるtmp/holding-news.json生成確認、およびportfolio-analystの実出力確認は、次フェーズ（Phase 20カード表示）以降のHuman-UATで自然に検証される見込み（19-03-SUMMARY.mdにも同様の記載あり）。

### Gaps Summary

ブロッカーなし。全15件の観測可能な真実がコードベース内で検証され、全206件のユニットテストがgreenで、フェーズ対象ファイルに型エラーは残存していない（既存の無関係なcollect-data.test.tsのimplicit-anyエラー4件はPhase 15由来でdeferred-items.mdに正しく記録済み）。軽微な情報レベルの指摘として、(1) REQUIREMENTS.mdのチェックボックス/Traceability状態が未更新であること、(2) collect-data.tsのholding-news.json統合に対する専用integrationテストが未追加であることの2点があるが、いずれもフェーズゴール「portfolio-analystが汚染のないティッカーデータに基づき決定論的抽出された保有銘柄別関連ニュースを入力として受け取る」の達成を妨げるものではない。

---

*Verified: 2026-07-03T15:05:00Z*
*Verifier: Claude (gsd-verifier)*
