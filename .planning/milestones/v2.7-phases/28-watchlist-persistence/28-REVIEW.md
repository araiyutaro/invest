---
phase: 28-watchlist-persistence
reviewed: 2026-07-15T02:59:39Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/portfolio/watchlist.ts
  - src/portfolio/watchlist.test.ts
  - src/scripts/write-watchlist.ts
  - src/scripts/write-watchlist.test.ts
  - .claude/commands/invest.md
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-07-15T02:59:39Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

ウォッチリスト永続化ステートマシン（admit/prune 純関数 + fail-soft CLI ラッパー + invest.md Step 2h 配線）をレビューした。純関数層（watchlist.ts）は単体では設計通りに動作し、テストカバレッジも WLST-01〜05 を単体レベルで網羅している。しかし **CLI 合成レイヤーに Critical 統合バグが1件ある**: D-22 最適化（active 銘柄を quote() 対象から除外）と D-21 fail-closed ゲートの相互作用により、**継続的に強気の active 銘柄の lastVerdictDate が一度も更新されず、31日目に誤って expired 除外される**。これは WLST-01 の reconfirm 要件（28-01-PLAN.md 行16 に明記）の直接違反であり、通常運用で確実に到達する。

加えて、オーケストレーターが指摘した WLST-03 のエッジケース（保有銘柄の admit 素通り）は Warning と判定した（下記 WR-01 に severity 根拠を記載）。ただし **CR-01 の修正と WR-01 の修正は結合している** — CR-01 を単純修正すると WR-01 の到達性が上がるため、両方を同時に直す必要がある。

invest.md Step 2h の挿入部分（行1251-1277）は fail-soft 指示・実行順序（filter-etf-stocks / validate-meeting より後）・STEP マーカー契約とも write-watchlist.ts の実装と整合しており、問題なし。

## Critical Issues

### CR-01: 継続強気の active 銘柄が reconfirm されず、31日目に誤って expired 除外される（D-22 × D-21 fail-closed の合成バグ）

**File:** `src/scripts/write-watchlist.ts:127-129` + `src/portfolio/watchlist.ts:115-117`
**Issue:** CLI は D-22 最適化として、既に active な ticker を quote() 対象から除外する:

```typescript
const candidateTickers = bullishStocks
  .map((s) => s.ticker)
  .filter((ticker) => !existingWatchlist[ticker]?.addedDate);
```

その結果、active 銘柄は `quoteTypeByTicker` に一切エントリを持たない。ところが `admitBullishStocks` は全 bullish 銘柄を `filterEtfStocks`（第2ゲート）に通し、lookup 欠落は **fail-closed で除外**される（etf-exclusion.ts 行50-53: `!lookup → excluded`）。つまり:

1. 既に active な銘柄が当日も強気 → quote 対象外 → lookup 欠落 → `kept` から除外 → **`lastVerdictDate` が更新されない**
2. 毎日強気であり続けても `lastVerdictDate` は初回登録日のまま凍結
3. 31日目に `pruneWatchlist` が `expired` として除外する（強気継続中にもかかわらず）

これは WLST-01 の受入条件「既にアクティブな銘柄が当日再度強気なら lastVerdictDate が today に更新される（reconfirm）」（28-01-PLAN.md 行16）の違反であり、WLST-04 の expired トリガーの誤発火を引き起こす。単体テスト（watchlist.test.ts 行123-135）は `quoteTypeByTicker` に該当 ticker を渡しているため green になるが、CLI 統合ではその前提が成立しない。

なお、統合テスト `write-watchlist.test.ts:210-233`（MRNA: 保有中 + active + 当日強気 → purchased が残る）は**このバグに依存して pass している**。re-admit が fail-closed で失敗するからこそ prune 結果が残るのであり、CR-01 を修正すると意図せずこのテストが赤くなる（WR-01 参照）。

**Fix:** active な既存エントリの reconfirm を第2ゲートから分離する。最も安全なのは `admitBullishStocks` 内で「既に active な ticker は filterEtfStocks をバイパスして lastVerdictDate のみ更新」とすること（登録時に検証済み、という D-22 の根拠と整合する）:

```typescript
export function admitBullishStocks(/* ... */): WatchlistFile {
  const bullishOnly = bullishStocks.filter((s) => s.verdict === "強気");

  // 既に active な銘柄は登録時に第2ゲート検証済み（D-22）— reconfirm のみ行う
  const isAlreadyActive = (t: string) =>
    watchlist[normalizeHoldingSymbol(t)]?.addedDate !== undefined;
  const reconfirms = bullishOnly.filter((s) => isAlreadyActive(s.ticker));
  const newCandidates = bullishOnly.filter((s) => !isAlreadyActive(s.ticker));

  const { kept } = filterEtfStocks(newCandidates, quoteTypeByTicker);

  return [...reconfirms, ...kept].reduce<WatchlistFile>(/* 既存 reduce と同じ */, watchlist);
}
```

**重要:** この修正を入れると、prune 直後（同一実行内）は該当エントリが非 active になっているため `isAlreadyActive` は false になり、reconfirm パスには乗らない — つまり downgraded/purchased/expired された銘柄が同一実行で復活することはない（prune→admit 順の意図は保たれる）。ただし「保有中 + 当日強気」の新規 ticker は依然 admit されるため、WR-01 の holdings フィルタを**同時に**入れること。修正後は `write-watchlist.test.ts:210-233` の期待値が holdings フィルタ経由で守られることを確認する。

## Warnings

### WR-01: admitBullishStocks が PORTFOLIO_HOLDINGS を除外せず、保有銘柄が active 登録され得る（WLST-03 のゲート欠落）

**File:** `src/portfolio/watchlist.ts:103-133` + `src/scripts/write-watchlist.ts:148-149`
**Issue:** オーケストレーター指摘のエッジケース。`admitBullishStocks` は候補を holdings と照合せず、CLI は prune→admit の順で合成するため、**保有中かつ未登録の ticker** が highlightedStocks に強気で登場すると active 登録される。現行コードでの実際の挙動を精査した結果、指摘の「毎run prune+re-admit 反復」とは少し異なり、D-22 の影響で**隔日振動**になる:

- Run N: 保有銘柄 X（未登録）が強気 → 新規候補として quote 取得 → ゲート通過 → **active 登録**（WLST-03 違反状態で書き込まれる）
- Run N+1: X は active → prune が purchased episode を追記して非 active 化。当日も強気でも D-22 で quote 対象外 → fail-closed で re-admit されない（= CR-01 と同じ機構）
- Run N+2: X は非 active → 強気なら再び新規候補として **active 登録**。以後、保有＋強気が続く限り隔日で purchased episode が history に積み上がる

**Severity 判定（WLST-03 に対する評価）:** Warning とする。根拠: (1) 上流パイプラインが highlightedStocks から保有銘柄を除外しており本番到達性は低い、(2) 到達しても自己修復的（翌run で prune）でデータ破壊はない、(3) ただし WLST-03「PORTFOLIO_HOLDINGS に含まれる銘柄は自動除外」の防御は prune 側にしか存在せず、書き込み後の watchlist に「保有中かつ active」という不変条件違反の状態が現れる日が発生する。防御的深層化（この phase の設計は「呼び出し側の絞り込みを信用しない」— watchlist.ts:110 に自ら明記）の観点で、admit 側にもゲートが必要。

**さらに重要:** CR-01 の修正（active バイパス）を入れると、「保有中 + active + 毎日強気」のケースで prune の purchased 除外が翌run の reconfirm で毎回打ち消される経路が生まれるため、**CR-01 修正時にこの holdings フィルタは必須**になる。

なお `write-watchlist.ts:146-147` のコメント「prune を admit より先に実行し、purchased/downgraded が『今日も強気』に優先されるようにする」は、新規 ticker については成立していない（admit が後勝ちする）。現状 active ticker で成立して見えるのは CR-01 のバグの副作用にすぎない。コメントも修正すること。

**Fix:** `admitBullishStocks` に holdings 引数を追加し、purchased ticker を候補から除外する:

```typescript
export function admitBullishStocks(
  watchlist: WatchlistFile,
  bullishStocks: MeetingResult["highlightedStocks"],
  quoteTypeByTicker: ReadonlyMap<string, QuoteTypeLookup>,
  nameByTicker: ReadonlyMap<string, { readonly name?: string; readonly nameJa?: string }>,
  holdings: ReadonlyArray<PortfolioHolding>,
  today: string,
): WatchlistFile {
  const held = new Set(holdings.map((h) => normalizeHoldingSymbol(h.symbol)));
  const bullishOnly = bullishStocks.filter(
    (s) => s.verdict === "強気" && !held.has(normalizeHoldingSymbol(s.ticker)),
  );
  // 以下既存ロジック
}
```

### WR-02: loadExistingWatchlist / main がシェイプ未検証の JSON でクラッシュし、FAIL マーカー契約が破られる

**File:** `src/scripts/write-watchlist.ts:28-41, 129, 148` + `src/portfolio/watchlist.ts:167`
**Issue:** `JSON.parse(raw) as WatchlistFile` は型キャストのみで実行時検証がない。JSON として valid だが形状が不正なケースで main が throw する:

- ファイル内容が `null` → 行129 `existingWatchlist[ticker]` で TypeError
- ファイル内容が文字列/数値 → `Object.entries` の挙動が不定（文字列は index キーで走査される）
- エントリに `history` が欠落（手編集・旧フォーマット）→ `removeEntry` の `[...entry.history]`（watchlist.ts:167）で TypeError

いずれも `main().catch` → `process.exit(1)` の fatal 経路に落ち、設計上の契約である `[STEP:watchlist:FAIL:<reason>]` マーカーが出力されない（invest.md 行1269-1271 は「スクリプト自身がマーカーを出す」設計を明記）。Step 2h 自体は終了コード無視の fail-soft なのでパイプラインは止まらないが、可観測性の契約が破れる。同種の fail-soft ガードは Phase 27 で highlightedStocks 側に追加済み（コミット 8f4d2ac）であり、このコードベースの規約に照らして watchlist ロードにも必要。

また `meetingResult.highlightedStocks` の要素も未検証で、`ticker` 欠落要素があると `normalizeHoldingSymbol(undefined)` の `.trim()` で同様に fatal クラッシュする（watchlist.ts:118, 190）。

**Fix:** loadExistingWatchlist で非 null プレーンオブジェクト検証を行い、不正形状は `corrupted: true` に落とす:

```typescript
const parsed: unknown = JSON.parse(raw);
if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
  return { watchlist: {}, corrupted: true };
}
return { watchlist: parsed as WatchlistFile, corrupted: false };
```

あわせて `removeEntry` 側は `[...(entry.history ?? []), episode]`、highlightedStocks 要素は `typeof s?.ticker === "string"` でフィルタする防御を推奨。

### WR-03: ticker 正規化がレイヤー間で非対称 — lookup ミスによる fail-closed 誤除外の可能性

**File:** `src/portfolio/watchlist.ts:115-120` + `src/scripts/write-watchlist.ts:127-129`
**Issue:** `admitBullishStocks` は watchlist キーを `normalizeHoldingSymbol(stock.ticker)` で正規化する（行118）一方、`filterEtfStocks`（内部で `quoteTypeByTicker.get(stock.ticker)`）と `nameByTicker.get(stock.ticker)`（行120）は**未正規化の raw ticker** で lookup する。CLI 側の Map は Yahoo が返す `record.symbol`（正規化された大文字シンボル）をキーにしており、CLI 行129 の `existingWatchlist[ticker]` も raw ticker で正規化済みキーを引く。`pruneWatchlist` は逆に highlighted 側を正規化しており（行190）、admit と prune で扱いが非対称。

meeting-result の ticker が小文字・前後空白付き（LLM 生成 JSON では起こり得る）の場合:
- `existingWatchlist["aapl"]` がミス → active なのに新規候補扱い（重複 quote 取得、実害小）
- quote 応答の symbol "AAPL" と raw "aapl" が不一致 → lookup 欠落 → **fail-closed で有効な強気銘柄が黙って除外**される

fail-closed なので危険側には倒れないが、正当な銘柄のサイレント欠落と、正規化を1箇所に集約する設計意図（WatchlistEntry の doc コメント行30「ticker キーは normalizeHoldingSymbol で正規化済みの値と同一である前提」）に反する。

**Fix:** lookup 前に一貫して正規化する。最小修正は CLI 側で Map 構築時と `candidateTickers` 算出時に `normalizeHoldingSymbol` を適用し、`admitBullishStocks` 内の `nameByTicker.get` も正規化キーで引くこと:

```typescript
// write-watchlist.ts
const candidateTickers = bullishStocks
  .map((s) => normalizeHoldingSymbol(s.ticker))
  .filter((ticker) => !existingWatchlist[ticker]?.addedDate);
// fetchQuoteTypesAndNames 内: quoteTypeByTicker.set(normalizeHoldingSymbol(symbol), ...)
```

## Info

### IN-01: ENOENT 判定の `message.includes("ENOENT")` が破損ファイルを欠損と誤判定し得る

**File:** `src/scripts/write-watchlist.ts:36-38`
**Issue:** Node 20+ の `JSON.parse` SyntaxError メッセージはファイル内容の断片を含む（例: `Unexpected token 'E', "ENOENT..." is not valid JSON`）。ファイル先頭付近に "ENOENT" という文字列を含む破損ファイルは `corrupted: false`（欠損扱い）と誤判定され、D-18 が保全すべき既存ファイルが空 watchlist で上書きされる。テストモック規約（`new Error("ENOENT")`）とのトレードオフとして doc コメントに明記されているが、テスト側で `Object.assign(new Error("not found"), { code: "ENOENT" })` を使えば `.code` チェックのみで済み、この誤判定経路を消せる。
**Fix:** テストのモックを ErrnoException 形式に変え、`.message.includes` フォールバックを削除する。

### IN-02: writeFile が非アトミック — 書き込み中断で watchlist.json 自体が破損する

**File:** `src/scripts/write-watchlist.ts:151`
**Issue:** `writeFile` 直書きのため、プロセス中断・ディスクフルで部分書き込みが起きると watchlist.json が破損する。次回実行は D-18 で corrupted を検出しスキップするが、蓄積した history は失われたまま（自己回復しない）。`write-urgency-history.ts:74` と同一パターンなのでコードベース内では一貫しているが、watchlist は履歴が資産となる長寿命ファイルであり、tmp 書き込み + `rename` のアトミックパターンへの移行を推奨（両スクリプト同時に）。
**Fix:** `await writeFile(WATCHLIST_PATH + ".tmp", json); await rename(WATCHLIST_PATH + ".tmp", WATCHLIST_PATH);`

### IN-03: candidateTickers の重複排除なし

**File:** `src/scripts/write-watchlist.ts:127-129`
**Issue:** highlightedStocks に同一 ticker が重複して含まれる場合（LLM 生成 JSON で起こり得る）、`candidateTickers` に重複が入り batch quote() に重複シンボルを渡す。動作は正しい（Map への set は冪等）が無駄な API ペイロードになる。
**Fix:** `const candidateTickers = [...new Set(bullishStocks.map(...))]...`

---

## 参考: レビューしたがクリーンだった点

- `calendarDaysBetween`（watchlist.ts:138-142）: `Date.parse("YYYY-MM-DD")` は仕様上 UTC 解釈のため差は常に 86,400,000ms の整数倍。DST/タイムゾーンの off-by-one なし。境界テスト（=30 は維持 / 31 で失効）も正しい
- `pruneWatchlist` の優先順位 purchased > downgraded > expired は early-return 構造で正しく実装され、テストで検証済み
- 除外済みエントリの二重 prune 防止（`!isActive` early return）は正しい
- `isValidDateKey` の再利用により `__proto__` 等の prototype-pollution キーは date キー検証で構造的に拒否される
- invest.md Step 2h（行1251-1277）: fail-soft 指示、`[PIPELINE:FAIL]` 禁止、実行順序制約（filter-etf-stocks / validate-meeting より後）、STEP マーカー契約の記述はすべて実装と整合
- 不変性規約（mutate なし・spread merge）は全関数で遵守されている

---

_Reviewed: 2026-07-15T02:59:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
