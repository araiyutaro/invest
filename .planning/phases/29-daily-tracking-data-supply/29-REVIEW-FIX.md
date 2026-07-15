---
phase: 29-daily-tracking-data-supply
fixed_at: 2026-07-15T04:34:30Z
review_path: .planning/phases/29-daily-tracking-data-supply/29-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 29: Code Review Fix Report

**Fixed at:** 2026-07-15T04:34:30Z
**Source review:** .planning/phases/29-daily-tracking-data-supply/29-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (Critical 1 + Warning 7 / fix_scope: critical_warning)
- Fixed: 8
- Skipped: 0

全修正後に `npx vitest run` で 528 tests GREEN（ベースライン 517 → 回帰テスト +11）を確認済み。
`npx tsc --noEmit` で修正ファイルに型エラーなし（`src/scripts/collect-data.test.ts` の既存エラー3件は修正前から存在する無関係ファイルのもの）。
locked decisions（既存モジュール無改変・fetchTechnicalSnapshots 非依存・[PIPELINE:FAIL] 非出力・watchlist.json read-only・有効JSON出力契約）はすべて維持。

## Fixed Issues

### CR-01: キャッシュヒットのフィルタがトートロジーで、ウォッチリスト外銘柄が漏出する

**Files modified:** `src/scripts/collect-watchlist-data.ts`, `src/scripts/collect-watchlist-data.test.ts`
**Commit:** 4a72355
**Applied fix:** `cachedTickers`（キャッシュ全 symbol 集合）でのトートロジー filter を `activeSet`（アクティブ銘柄集合）での filter に変更。あわせて `seen` 集合による同一 symbol の去重も実装（レビューの補足指摘）。レビューが要求した回帰テスト「キャッシュにウォッチリスト外銘柄が含まれる場合、出力に含まれない」と「重複 symbol の去重」の2件を追加し、セマンティクスをテストで検証済み。
**Note:** 論理バグ修正のため、回帰テスト GREEN を確認済みだが最終的な動作確認は人間の検証を推奨（fixed: requires human verification 相当。ただし追加テストが漏出防止を直接検証している）。

### WR-01: loadSameDayCache が「同日」を検証せず stale キャッシュを当日データとして出力しうる

**Files modified:** `src/scripts/collect-watchlist-data.ts`, `src/scripts/collect-watchlist-data.test.ts`
**Commit:** 1dbaa1c
**Applied fix:** `generatedAt` の日付検証を追加。**レビュー提案コードから意図的に適応**: 提案は generatedAt（UTC ISO）の日付部分を JST 当日と直接比較していたが、パイプラインは JST 朝8時（= UTC 前日23時）実行のため正当な同日キャッシュを誤棄却する。生成時刻・現在時刻の**双方を JST 日付に変換**してから比較する実装にした。generatedAt 欠落・不正値もキャッシュ無視として扱う。既存テストのハードコード日付（"2026-07-15T00:00:00.000Z" ×3）を動的な `new Date().toISOString()` に更新し（時刻依存の flaky 化を防止）、stale（24時間前）・generatedAt 欠落の回帰テスト2件を追加。
**Note:** 提案コードからの適応判断を含むため人間の確認を推奨（fixed: requires human verification）。

### WR-02: キャッシュ snapshots の要素シェイプ未検証で不正要素1件により全空縮退

**Files modified:** `src/scripts/collect-watchlist-data.ts`, `src/scripts/collect-watchlist-data.test.ts`
**Commit:** 8c56adb
**Applied fix:** `loadSameDayCache` の返却時に `typeof s === "object" && s !== null && typeof s.symbol === "string"` の型ガード filter を追加（D-12 準拠: 不正要素のみ除外し正常要素は活かす）。`TechnicalSnapshot` 型 import を追加。`snapshots: [null, {symbol欠落}, 正常]` で正常要素が活かされる回帰テストを追加。

### WR-03: watchlist.json のエントリレベル形状未検証で `{"AAA": null}` が fatal 経路に落ちマーカー契約違反

**Files modified:** `src/scripts/collect-watchlist-data.ts`, `src/scripts/collect-watchlist-data.test.ts`
**Commit:** 6809207
**Applied fix:** `loadWatchlistDefensive` に、値が null / 非オブジェクト / `ticker` 非文字列のエントリを除外するエントリレベル filter を追加（Phase 28 レビュー WR-02 で write-watchlist 側に入れた検証と同水準）。`ticker` を欠くエントリの `fetchOne(undefined)` 伝播も同時に解消。null エントリ混在時に fatal に落ちず OK マーカーが出ること、全エントリ不正時はアクティブ0件の正常系になることの回帰テスト2件を追加。

### WR-04: fatal 経路で STEP マーカーが出力されず、invest.md 側フォールバックも参照先がない

**Files modified:** `src/scripts/collect-watchlist-data.ts`, `.claude/commands/invest.md`
**Commit:** d915390
**Applied fix:** CLI の fatal catch に `console.error("[STEP:watchlist-data:FAIL:fatal]")` を追加（OK/FAIL いずれも出ない run を排除）。あわせて invest.md Step 2i に「マーカーを一切出力せずに終了した場合は両出力ファイルへ有効な空JSONを書いて続行する」フォールバック指示（Bash コマンド付き）を追記し、コード内コメントの参照先を実在させた。fatal 経路は `import.meta.url` ガード内のため vitest からの直接テストは不可（既存テスト構成と同じ制約）。

### WR-05: `??` フォールバックが空文字列を素通しし universal-match バグが再発しうる

**Files modified:** `src/portfolio/watchlist-data.ts`, `src/portfolio/watchlist-data.test.ts`
**Commit:** e1564c5
**Applied fix:** `toPortfolioHoldingShape` の name/nameJa フォールバックを `entry.name ?? entry.ticker` から `entry.name?.trim() ? entry.name : entry.ticker` に変更（レビュー推奨の trim 判定を採用、空白のみ文字列も防止）。docstring に WR-05 の理由付けを追記。`""` および空白のみ入力で ticker にフォールバックする回帰テスト3件を追加。

### WR-06: tmp/news.json の記事要素未検証で全損・NaN スコア混入

**Files modified:** `src/scripts/collect-watchlist-data.ts`, `src/scripts/collect-watchlist-data.test.ts`
**Commit:** 156e2f1
**Applied fix:** モジュールレベルの型ガード `isValidPoolArticle`（object 判定 + id/title/publishedAt の string 判定 + `Date.parse` 検証）を新設し、Date 復元 map の前段で filter するよう変更。null 要素・title 非文字列・publishedAt 不正の混入時に有効記事のみでマップが構築され NaN スコアが出力されないことの回帰テストを追加。

### WR-07: fetchChunked が fetchOne の reject に非耐性で、テストも実際には reject を検証していない

**Files modified:** `src/portfolio/watchlist-data.ts`, `src/portfolio/watchlist-data.test.ts`
**Commit:** fc171b5
**Applied fix:** レビュー推奨の「実装を docstring の主張に合わせる」案を採用。`batches[i].map(fetchOne)` を per-ticker try/catch 付きの明示 async ラムダに変更（reject は null = omit 扱い、蓄積済み結果を保全）。docstring を実装と整合するよう更新。テストの自作 catch（実際には reject しない）を実際に `throw` する fetchOne に修正し、チャンク跨ぎで結果が保全されることを検証。明示ラムダ化により IN-02（map の index 引数流入ハザード）も副次的に解消。

## Skipped Issues

なし。

## Out of Scope (Info — 未対応)

- IN-01: writeEmptyOutputs と正常系の JSON 整形不一致（fix_scope 対象外）
- IN-02: `map(fetchOne)` の関数参照渡しハザード — **WR-07 の修正で副次的に解消済み**
- IN-03: fake timers テストの assertion が弱い（fix_scope 対象外）

---

_Fixed: 2026-07-15T04:34:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
