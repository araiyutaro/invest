---
phase: 20-holding-card-news-display
verified: 2026-07-03T18:10:00Z
status: human_needed
score: 11/11 must-haves verified (automated)
overrides_applied: 0
human_verification:
  - test: "本フェーズのコード完成後（17:30時点）に collect-data.ts / generate-report.ts のパイプラインを再実行し、生成された docs/YYYY-MM-DD/portfolio-report.html をブラウザで開く"
    expected: "各保有銘柄カードの rationale/riskNote 直下に「関連ニュース」見出しが常に表示され、ニュースがある銘柄は最大5件の箇条書き（見出しリンク・ソース名・JST日時、name/alias一致のみ「社名一致」バッジ）が、ニュースが0件の銘柄（日本株小型株等）は「本日の関連ニュースなし」が表示され、エラーやレイアウト崩れがない。ニュースリンクのクリック先が正しい記事に遷移する"
    why_human: "本日 08:41 に実行された collect-data.ts はまだ holding-news.json 生成ロジック（Phase 19, commit 2f7eea3, 14:54 コミット）を含んでおらず、tmp/holding-news.json が現在ディスク上に存在しない。さらに docs/2026-07-03/portfolio-report.html は 09:17 生成であり、本フェーズのコード（17:21-17:30 コミット）より前の状態のまま。そのため『関連ニュース』セクションを含む実データでのライブ描画は一度も目視確認されていない。20-VALIDATION.md の Manual-Only Verifications 表、および 20-02-PLAN.md の <verification> 節・20-02-SUMMARY.md の Next Phase Readiness 節でも同一項目が『phase完了前に必要』『本プランの自動テストではカバーされない』と明記されており、実行前検証（ユニットテスト）では代替できない"
---

# Phase 20: Holding-Card News Display Verification Report

**Phase Goal:** レポート閲覧者が各保有銘柄カード上で、その判断根拠となった関連ニュースを直接確認できる
**Verified:** 2026-07-03T18:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | [Roadmap SC1] 各保有銘柄カードに tmp/news.json をID参照方式で照合解決した関連ニュース（見出し・ソース名・元記事リンク）が銘柄あたり3〜5件の上限付きで表示される（幻覚URLが構造的に発生しない） | ✓ VERIFIED | `resolvePortfolioHoldingNews`（src/portfolio/holding-news.ts:56-84）は `Map<id, article>` によるID照合のみで解決し、LLM/エージェント出力のURLは一切参照しない。上限5件は Phase19 `rankAndCapHoldingArticles`（`MAX_ARTICLES_PER_HOLDING = 5`, holding-news.ts:7,190）で供給時に強制済み。描画側 `formatHoldingNewsItemHtml`/`formatHoldingNewsSectionHtml`（generate-portfolio-report.ts:23-45）が見出しリンク・ソース名・JST日時を出力。Test 25-38（generate-report.test.ts）全 pass、`npm test` 228/228 green |
| 2 | [Roadmap SC2] 関連ニュース0件の保有銘柄も、エラーやレイアウト崩れなく通常のカードとして描画され、「本日の関連ニュースなし」等の明示的な空状態が表示される | ✓ VERIFIED（自動テストの範囲では） | `formatHoldingNewsSectionHtml` は items.length===0 でも見出し「関連ニュース」を省略せず「本日の関連ニュースなし」を描画（D-08、Pitfall 1 の空文字列返却アンチパターン不採用）。Test 33/38 で確認。ただし実データでのライブ描画は未確認（下記 Human Verification 参照）。また `<li>` インラインstyleがグローバル `li{border-left:3px solid #10b981}`（report-utils.ts:147）を打ち消しておらず、ニュース項目ごとに緑アクセントの左ボーダーが残存する（WR-02、コードレビュー既知）。これは「レイアウト崩れ」（構造破綻）ではなく意匠上の逸脱であり、SC2 の文言（エラー・崩れなし）を字義通りには破らないと判断したが、UI-SPEC ルール3 には反する |
| 3 | D-06: resolvePortfolioHoldingNews が正常IDを見出し/ソース/URL/JST日時/matchTypeへ解決する | ✓ VERIFIED | holding-news.test.ts:237以降のテストで確認。score フィールドは `ResolvedHoldingNewsItem` 型に存在しない（grep 確認済み） |
| 4 | D-10: 未知IDはそのエントリのみ drop され console.warn が出る | ✓ VERIFIED | holding-news.test.ts:269 テスト green |
| 5 | D-10: 銘柄間のID混入が起きない（Object.entries起点、プール独立再フィルタなし） | ✓ VERIFIED | holding-news.test.ts:285 テスト green、実装が `pool.filter` を含まないことを grep で確認 |
| 6 | D-09: loadHoldingNews/loadNewsPool は欠損・パース失敗（ENOENT・不正JSON文字列）で throw せず {}/[] を返す | ✓ VERIFIED（記載範囲内） / ⚠️ 追加リスクあり | report-data-loaders.test.ts で ENOENT・パース失敗系がテスト済み green。ただし実際に `resolvePortfolioHoldingNews(null, [])` および `resolvePortfolioHoldingNews({MRNA:null}, [])` を直接実行し再現したところ、いずれも `TypeError` で throw することを確認した（WR-01、コードレビュー既知）。これは「有効なJSONだが期待形状でない」ケースであり、D-09が明示的に主張する「欠損・パース失敗」の文言範囲の外側だが、ローダーのJSDoc自体が謳う「欠損は全銘柄0件と同一扱い」というfail-soft設計意図には反する。現在のtmpディレクトリにholding-news.jsonが存在しないため今日時点では未発火（後述） |
| 7 | 参照側キー正規化: resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)] でリゾルバーと同一正規化によりsymbol表記揺れでもニュースが引き当たる | ✓ VERIFIED | generate-portfolio-report.ts:58 で `normalizeHoldingSymbol(h.symbol)` 使用を確認。Test 37（表記揺れ " mrna " → MRNA キー一致）green |
| 8 | D-07: name/alias一致にのみ「社名一致」バッジ、ticker一致は無印 | ✓ VERIFIED | Test 34（name一致→バッジあり）、Test 36（ticker一致→バッジなし）green |
| 9 | D-03: ニュースリンクはescapeHtml済みhref + target="_blank" rel="noopener noreferrer" + ダークテーマ用淡色（#93c5fd/visited #c4b5fd） | ✓ VERIFIED | Test 35 green。report-utils.ts:210-215 に `.news-card a{color:#93c5fd}` / `a:visited{color:#c4b5fd}` を確認。カードdivに `class="agent-card news-card"` 併用（generate-portfolio-report.ts:59） |
| 10 | generatePortfolioReportHtml は第3引数省略の既存2引数呼び出しでも後方互換で動作する | ✓ VERIFIED | Test 38 green、デフォルト引数 `resolvedHoldingNews: ... = {}`（generate-portfolio-report.ts:115）を確認。Test 25-32（既存）も無変更で green |
| 11 | generate-report.ts が holding-news/news を読み込み resolvePortfolioHoldingNews で解決してレポートに渡す | ✓ VERIFIED | generate-report.ts:96-115 で `loadNewsPool()`/`loadHoldingNews()` を Promise.all に統合、`resolvePortfolioHoldingNews(holdingNews, newsPool)` の結果を `generatePortfolioReportHtml` の第3引数に渡す配線を grep で確認。`collect-data.ts` に差分なし |

**Score:** 11/11 truths pass automated verification. 1件（真実#2）が実データでのライブ描画未確認のため human_needed。

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/portfolio/holding-news.ts` | `resolvePortfolioHoldingNews()`/`normalizeHoldingSymbol()`/`ResolvedHoldingNewsItem` | ✓ VERIFIED | 全て export 済み、実装が behavior 仕様通り |
| `src/scripts/report-data-loaders.ts` | `loadNewsPool()`/`loadHoldingNews()` fail-soft | ✓ VERIFIED（既知の追加リスクあり） | ENOENT/パース失敗は fail-soft。形状不正の有効JSONは非対応（WR-01） |
| `src/scripts/report-utils.ts` | 汎化された `safeHref()`/`formatPublishedAtJst()` | ✓ VERIFIED | export 済み、news-digest 側の挙動不変（既存テスト green） |
| `src/scripts/generate-portfolio-report.ts` | `formatHoldingNewsSectionHtml`/`formatHoldingNewsItemHtml`、拡張済み `formatHoldingEvaluationsHtml`/`generatePortfolioReportHtml` | ✓ VERIFIED | 全関数存在・配線・テスト green |
| `src/scripts/generate-report.ts` | `loadNewsPool`/`loadHoldingNews`/`resolvePortfolioHoldingNews` の統合 | ✓ VERIFIED | Promise.all + resolver呼び出し + 第3引数受け渡しを確認 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| generate-news-digest.ts | report-utils.ts | `import { safeHref, formatPublishedAtJst }` | ✓ WIRED | grep 確認、既存テスト green |
| holding-news.ts | meeting/schemas.ts | `import type NewsArticlePoolEntry` | ✓ WIRED | 型注釈確認 |
| generate-report.ts | resolvePortfolioHoldingNews | `loadHoldingNews + loadNewsPool` → resolver | ✓ WIRED | generate-report.ts:96-115 |
| generate-portfolio-report.ts | resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)] | formatHoldingNewsSectionHtml | ✓ WIRED | generate-portfolio-report.ts:58 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `formatHoldingEvaluationsHtml` | `resolvedHoldingNews` | `generate-report.ts` main() → `resolvePortfolioHoldingNews(holdingNews, newsPool)` ← `loadHoldingNews()`/`loadNewsPool()` ← `tmp/holding-news.json`/`tmp/news.json` | ⚠️ 未確認（本日分 tmp/holding-news.json が現在ディスク上に不在） | ⚠️ STATIC（今日時点） — 直近の collect-data.ts 実行（08:41）は Phase 19 の holding-news.json 生成ロジック（14:54コミット）より前のため、現在の tmp/ に holding-news.json が存在しない。次回パイプライン実行（翌日8AM cron または手動実行）で実データが流れる設計自体は正しく配線されているが、本フェーズのコードでの実データ描画は本検証時点で未実施 |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| resolvePortfolioHoldingNews が形状不正な holdingNews (`{MRNA:null}`) で throw するか | `npx tsx -e 'resolvePortfolioHoldingNews({MRNA:null},[])'` | `TypeError: entries is not iterable` | ✗ FAIL（WR-01再現、コードレビュー記載通り） |
| resolvePortfolioHoldingNews が `null` holdingNews で throw するか | `npx tsx -e 'resolvePortfolioHoldingNews(null,[])'` | `TypeError: Cannot convert undefined or null to object` | ✗ FAIL（WR-01再現） |
| `npm test` 全体 green | `npm test` | 15 files / 228 tests passed | ✓ PASS |
| `npx tsc --noEmit` エラーなし（本フェーズ差分ファイル） | `npx tsc --noEmit` | Phase20差分ファイルにエラーなし。`collect-data.test.ts` に既存4件のTS7006（Phase15由来、範囲外、deferred-items.md記載済み） | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED（本フェーズ・プロジェクトに `scripts/*/tests/probe-*.sh` 形式の probe は存在せず、PLAN/SUMMARY にも probe への言及なし）

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| UI-05 | 20-01, 20-02 | 関連ニュース（見出し・ソース名・元記事リンク）表示、ID参照方式で幻覚URL防止、3〜5件上限 | ✓ SATISFIED（自動テスト範囲） | resolver・描画・テスト全て確認済み。実データでのライブ確認は human_needed |
| UI-06 | 20-01, 20-02 | 0件銘柄も正常カード描画、エラー・空セクション崩れなし | ✓ SATISFIED（自動テスト範囲） | Test 33/38、`formatHoldingNewsSectionHtml` 空状態分岐確認。border-left残存（WR-02）は仕様逸脱だが「崩れ」の域ではないと判断 |

ORPHANED requirements: なし（REQUIREMENTS.md の Phase 20 行は UI-05/UI-06 のみで、両方とも 20-01/20-02 の `requirements:` frontmatter に宣言済み）

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/scripts/report-data-loaders.ts` / `src/portfolio/holding-news.ts` | report-data-loaders.ts:90-112, holding-news.ts:56-84 | 形状不正だが有効なJSON（`null`、`{"SYM":null}`、非配列プール等）に対してローダーはノークラッシュだが `resolvePortfolioHoldingNews` が TypeError を投げる。`generate-report.ts:108` の呼び出しはこの例外を捕捉しないため、関連ニュースデータの破損だけで3レポート全ての生成が停止する | WARNING（コードレビュー WR-01 と一致、実行再現済み） | 現時点の tmp/ にはholding-news.jsonが存在せずENOENTパスのみ通るため未発火。ただし将来 holding-news.json が部分書き込み等で壊れた場合に日次パイプライン全体が停止するリスクを残す |
| `src/scripts/generate-portfolio-report.ts` | 31 | 関連ニュース `<li>` のインラインstyleが `border-left` を明示しておらず、グローバル `li{border-left:3px solid #10b981}` を打ち消せない | WARNING（コードレビュー WR-02 と一致） | UI-SPECルール3が明示的に禁止した「ニュース項目ごとの緑アクセント左ボーダー」がそのまま描画される（意匠逸脱、構造破綻ではない） |
| `src/portfolio/holding-news.ts` | 80 | 正規化後キー衝突（"MRNA" と " mrna " が入力に共存）時、後勝ちで前エントリが無警告消失 | INFO（コードレビュー IN-01） | 現行データ生成側では発生しないが、将来のデータ源追加時に沈黙上書きの可能性 |
| `src/portfolio/holding-news.ts` | 105-111 | 空文字の name/nameJa/matchAliases が全記事にマッチする（`"".includes("")` 常時true） | INFO（コードレビュー IN-02） | 現行 PORTFOLIO_HOLDINGS は全て非空のため実害なし |
| `src/scripts/report-utils.ts` | 13-24 | `formatPublishedAtJst` がパース不能日時で "Invalid Date" をそのまま描画 | INFO（コードレビュー IN-03） | 表示上の劣化のみ |
| `src/scripts/generate-report.test.ts` | 205-232, 381-421 | テスト番号 33-35 が Daily Report のチャートテストと Portfolio Report のニューステストで重複 | INFO（コードレビュー IN-04） | トレーサビリティのみの問題 |

### Human Verification Required

#### 1. 実データでのライブ描画確認（保有銘柄カードの関連ニュースセクション）

**Test:** 本フェーズのコード（17:21-17:30コミット）が含まれた状態で `collect-data.ts` → `generate-report.ts` のフルパイプラインを実行し、生成された `docs/YYYY-MM-DD/portfolio-report.html` をブラウザで開く
**Expected:** 各保有銘柄カードの rationale/riskNote 直下に「関連ニュース」見出しが必ず表示される。ニュースがある銘柄は最大5件が供給順で箇条書き表示され（見出しリンク・ソース名・JST日時、name/alias一致のみ「社名一致」バッジ）、ニュースが0件の銘柄（日本株小型株等）は「本日の関連ニュースなし」が表示され、エラーやレイアウト崩れがない。ニュースリンクをクリックすると正しい記事URLへ遷移する
**Why human:** 本日 08:41 の `collect-data.ts` 実行は Phase 19 の `holding-news.json` 生成ロジック（14:54コミット）より前のため、現在 `tmp/holding-news.json` はディスク上に存在しない。`docs/2026-07-03/portfolio-report.html` も 09:17 生成であり、本フェーズのコード完成（17:30）より前の状態のまま。したがって「関連ニュース」セクションが実データで描画された成果物は一度も生成・目視確認されていない。この確認は 20-VALIDATION.md の Manual-Only Verifications 表、および 20-02-PLAN.md `<verification>` 節・20-02-SUMMARY.md の Next Phase Readiness 節でも「phase完了前に必要」「本プランの自動テストではカバーされない」と明記されている。ユニットテスト（Test 33-38）は固定フィクスチャによるHTML断片検証のみであり、実データのボリューム・実URL・実際のブラウザレンダリング（特にWR-02のborder-left残存が実際にどう見えるか）は代替できない

### Gaps Summary

自動テスト・静的解析（`npm test` 228/228 green、`npx tsc --noEmit` 差分ファイルにエラーなし、コードレビュー critical 0件）の範囲では UI-05/UI-06 の全 must-have が満たされている。resolver・正規化・fail-softローダー・バッジ・リンク安全性・後方互換・パイプライン配線はいずれもテストと直接コード確認で裏付けられた。

ただし本検証で新たに以下を確認した:
1. **未検証の実データ描画**: 本フェーズのコード完成後に一度もパイプラインが実行されておらず、`docs/` 配下に「関連ニュース」セクションを含む実際のレポートが存在しない。これは PLAN/VALIDATION 自身が「phase完了前に必要」と明記した Manual-Only 項目であり、status を `human_needed` とした主因
2. **WR-01（コードレビュー既知）を実行再現で確認**: `resolvePortfolioHoldingNews` は形状不正だが構文的に有効なJSON（`null` や `{"SYM":null}`）に対して TypeError を投げ、`generate-report.ts` 側に捕捉がないため3レポート全滅のクラッシュパスが成立する。現在の tmp/ には holding-news.json が存在しないため今日時点では未発火だが、次回パイプライン実行時にファイルが部分書き込み等で破損すれば発火し得る。WARNING として記録（ロードマップの2つの成功基準を字義通りには破らないためBLOCKERとはしない）
3. **WR-02（コードレビュー既知）を確認**: ニュース項目の `<li>` がグローバル `border-left` アクセントを打ち消せておらず、UI-SPECが明示的に禁止した意匠が残る。WARNING として記録（「レイアウト崩れ」には該当しないと判断）

いずれも BLOCKER には該当しないと判断したが、次回のパイプライン定期実行後に実データでの目視確認を行うこと、および WR-01/WR-02 の修正を近い将来のフォローアップとして計画することを推奨する。

---

_Verified: 2026-07-03T18:10:00Z_
_Verifier: Claude (gsd-verifier)_
