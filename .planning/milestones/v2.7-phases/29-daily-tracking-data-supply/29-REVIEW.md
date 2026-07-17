---
phase: 29-daily-tracking-data-supply
reviewed: 2026-07-15T04:21:22Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - .claude/commands/invest.md
  - src/portfolio/watchlist-data.test.ts
  - src/portfolio/watchlist-data.ts
  - src/scripts/collect-watchlist-data.test.ts
  - src/scripts/collect-watchlist-data.ts
findings:
  critical: 1
  warning: 7
  info: 3
  total: 11
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-07-15T04:21:22Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 29「Daily Tracking Data Supply」の成果物 5 ファイルをレビューした。fail-soft 設計・[PIPELINE:FAIL] 非出力・既存モジュール無改変・fetchTechnicalSnapshots 非依存（単数形 `fetchTechnicalSnapshot` のみ import）といった locked decisions は概ね遵守されている。invest.md の Step 2i 挿入も D-01/D-03/OPS-06 と整合している。

しかし **Critical 1 件**を検出した: キャッシュヒット判定がトートロジー（常に真）になっており、`tmp/technicals.json` に含まれる全スナップショット — Step 2b のモデレーター候補銘柄（ウォッチリスト外の銘柄が大半）— が `tmp/watchlist-technicals.json` にそのまま漏出する。ウォッチリスト銘柄のみを含むべき出力契約（D-11、Phase 30 の下流契約）を実運用のほぼ毎回破る。テストはキャッシュがアクティブ銘柄の部分集合であるケースしか検証しておらず、このバグを検出できない。

加えて、「同日キャッシュ」の日付未検証、キャッシュ／ニュース記事の要素レベル検証欠如（D-12 の「キャッシュは正しさの依存点にしない」に反する縮退）、fatal 経路での STEP マーカー欠落、空文字列社名による universal-match バグ再発リスク、fetchChunked の reject 非耐性（および実際には reject を検証していないテスト）を Warning として報告する。

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: キャッシュヒットのフィルタがトートロジーで、ウォッチリスト外銘柄のスナップショットが watchlist-technicals.json に漏出する

**File:** `src/scripts/collect-watchlist-data.ts:123-124`
**Issue:** `mergeWithCache` が返す `cachedTickers` は「**キャッシュに存在する全 symbol の集合**」である（`watchlist-data.ts:40`、テスト `watchlist-data.test.ts:134-141` もこの意味論を固定している）。そのため

```ts
const hitSnapshots = cachedSnapshots.filter((s) => cachedTickers.has(s.symbol));
```

は **cachedSnapshots の全要素に対して常に真**（自分自身から作った集合との照合）となり、`hitSnapshots === cachedSnapshots` である。`tmp/technicals.json` は Step 2b が `tmp/moderator-tickers.json`（Round 1 の候補銘柄 = ウォッチリストとはほぼ別集合）から生成するファイルなので、実運用ではほぼ毎回、**ウォッチリストに載っていない当日候補銘柄のスナップショットが `tmp/watchlist-technicals.json` に混入する**。D-11 の「アクティブ銘柄のうちキャッシュ済みのものをコピー」という意図に反し、Phase 30 の判定エージェントがウォッチリスト外銘柄を追跡・判定してしまう下流汚染につながる。既存テストはキャッシュ = アクティブ銘柄の部分集合のケース（`collect-watchlist-data.test.ts:162-251`）しかなく、非アクティブ銘柄を含むキャッシュのテストが存在しないため検出されない。
**Fix:**
```ts
// collect-watchlist-data.ts
const activeTickers = activeEntries.map((entry) => entry.ticker);
const activeSet = new Set(activeTickers);
const cachedSnapshots = await loadSameDayCache(TECHNICALS_CACHE_PATH);
const { missingTickers } = mergeWithCache(activeTickers, cachedSnapshots);
// アクティブ銘柄に一致するスナップショットのみコピーする（D-11）
const hitSnapshots = cachedSnapshots.filter((s) => activeSet.has(s.symbol));
```
あるいは `mergeWithCache` 自身が `hitSnapshots`（active ∩ cached）を返すようにシグネチャを拡張し、呼び出し側の再フィルタを不要にする。同時に「キャッシュがアクティブ外銘柄を含む場合、出力に含まれない」ことを検証するテストを `collect-watchlist-data.test.ts` に追加すること（このテストがあれば本バグは検出されていた）。なおキャッシュ内に同一 symbol の重複要素がある場合に出力へ重複するのも同じ箇所で `Set` による去重で防げる。

## Warnings

### WR-01: loadSameDayCache が「同日」を一切検証せず、前日以前の stale スナップショットを当日データとして出力しうる

**File:** `src/scripts/collect-watchlist-data.ts:56-77`
**Issue:** 関数名・docstring・D-11 はいずれも「**同日**キャッシュ」と規定するが、実装は `generatedAt` も各 snapshot の `asOf` も検証しない。パイプライン内では Step 2b が同日に再生成するため通常は成立するが、(a) collect-watchlist-data.ts を単体実行した場合、(b) 前回 run が Step 2b 以降で中断し tmp/ に前日ファイルが残った状態でオーケストレーター（LLM）が Step 2b の fail-soft 空書き込み指示に従わなかった場合、前日の株価・RSI が「当日テクニカル」として `tmp/watchlist-technicals.json` に流れ、Phase 30 の判定を古いデータで誤らせる。
**Fix:** `loadSameDayCache` 内で `generatedAt` の日付（JST）が当日と一致しない場合はキャッシュ全体を無視して `[]` を返す:
```ts
const todayJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
const generatedDay = String((parsed as TechnicalsCacheFile).generatedAt ?? "").slice(0, 10);
if (generatedDay !== todayJst) {
  console.error("[watchlist-data] tmp/technicals.json が当日生成ではないためキャッシュを無視します");
  return [];
}
```

### WR-02: キャッシュ snapshots の要素シェイプ未検証 — 不正要素1件でテクニカルブランチ全体が空に縮退し、D-12 に反する

**File:** `src/scripts/collect-watchlist-data.ts:62-72`（`src/portfolio/watchlist-data.ts:40` で throw）
**Issue:** `loadSameDayCache` は `snapshots` が配列であることのみ確認し、要素の形状を検証しない。`snapshots: [null]` や `symbol` を欠く要素が混入すると `mergeWithCache` の `cached.map((s) => s.symbol)` は throw しないが、`new Set` に `undefined` が入り、さらに `hitSnapshots` 側や下流で不整合を起こす。要素が `null` の場合は `s.symbol` アクセスで TypeError → テクニカルブランチの外側 catch に落ち、**新規取得すれば全銘柄成功したはずなのに snapshots が空で書かれる**。D-12「キャッシュはあくまで最適化であり、正しさの依存点にしない」の明示契約に反する（破損キャッシュは無視して全銘柄新規取得にフォールバックすべき）。既存テストはファイル全体の破損（非JSON）のみ検証し、要素レベル破損は未検証。
**Fix:** `loadSameDayCache` で要素をフィルタする:
```ts
return (parsed as TechnicalsCacheFile).snapshots.filter(
  (s): s is TechnicalSnapshot =>
    typeof s === "object" && s !== null && typeof (s as TechnicalSnapshot).symbol === "string",
);
```

### WR-03: watchlist.json のエントリレベル形状未検証 — `{"AAA": null}` で `isActive` が TypeError → fatal 経路に落ち FAIL:corrupted 契約が破られる

**File:** `src/scripts/collect-watchlist-data.ts:39-42, 110`
**Issue:** `loadWatchlistDefensive` はトップレベル（null / 配列 / プリミティブ）のみ検証する。値が `null` のエントリ（`{"AAA": null}`）は有効なオブジェクトとして通過し、`getActiveWatchlistEntries` → `isActive(null)` の `entry.addedDate` アクセスで TypeError が throw される。この throw は main() 内のどの try/catch にも捕捉されず fatal 経路（CLI の `.catch`）へ落ちるため、破損 watchlist なのに `[STEP:watchlist-data:FAIL:corrupted]` が出ない。write-watchlist.ts の同関数は「型キャストのみだと TypeError → fatal 経路に落ち、FAIL マーカー契約が破られる」とコメントで明示的にこのクラスの問題を警戒しており（write-watchlist.ts:36-39）、同じ理由付けがエントリレベルにも適用されるべきである。また `addedDate` はあるが `ticker` を欠くエントリは active 判定され、`fetchOne(undefined)`・`symbol: undefined` のままニュースマップキーにまで伝播する。
**Fix:** `loadWatchlistDefensive` で不正エントリを除外（または corrupted 扱い）する:
```ts
const entries = Object.entries(parsed as Record<string, unknown>).filter(
  ([, v]) => typeof v === "object" && v !== null && typeof (v as WatchlistEntry).ticker === "string",
);
return { watchlist: Object.fromEntries(entries) as WatchlistFile, corrupted: false };
```
（Phase 28 レビュー WR-02 で write-watchlist 側に入れたエントリ検証と同水準に揃える。）

### WR-04: fatal 経路で `[STEP:watchlist-data:FAIL:<reason>]` が出力されず、Step 2i のマーカー契約が破られる

**File:** `src/scripts/collect-watchlist-data.ts:187-198`（`.claude/commands/invest.md:1296-1299`）
**Issue:** invest.md Step 2i は「スクリプト自身が stderr に `[STEP:watchlist-data:OK]` / `[STEP:watchlist-data:FAIL:<reason>]` を出力する設計」であり、オーケストレーターは追加 echo をしない。しかし CLI の fatal catch（mkdir 失敗、WR-03 の TypeError 等）は `Fatal error:` のみ出力し STEP マーカーを一切出さないため、**この経路では OK も FAIL も出ない run が発生し**、STEP マーカーを監視する運用が盲点を持つ。さらにコード内コメント「出力先にも書けない場合は invest.md 側のフォールバックに委ねる」に対応するフォールバック指示は invest.md Step 2i に存在せず（Step 2b には同種の空JSON書き込み指示があるのと対照的）、参照先のない契約になっている。
**Fix:** fatal catch にマーカーを追加する:
```ts
main().catch(async (error) => {
  console.error("Fatal error:", error);
  try {
    await writeEmptyOutputs();
  } catch { /* ... */ }
  console.error("[STEP:watchlist-data:FAIL:fatal]");
  process.exitCode = 1;
});
```
あわせて invest.md Step 2i に「スクリプトが `[STEP:watchlist-data:*]` を一切出力せずに終了した場合は両出力ファイルへ空JSONを書いて続行する」フォールバック指示を追記するか、コード内コメントの「invest.md 側のフォールバック」記述を削除して整合させること。

### WR-05: `??` フォールバックは空文字列を通すため、name/nameJa が `""` のとき universal-match バグ（全記事誤マッチ）が再発する

**File:** `src/portfolio/watchlist-data.ts:23-24`
**Issue:** docstring 自身が「空文字列を渡すと `"".includes("")===true` で常に真になり全銘柄が任意の記事タイトルに誤マッチする構造的バグ」と明記しているが、実装の `entry.name ?? entry.ticker` / `entry.nameJa ?? entry.ticker` は **`undefined` のみ**を防ぎ、`""` はそのまま通過する。watchlist.json の name/nameJa は write-watchlist.ts が yahoo-finance2 の `longName`/`shortName` から埋める LLM/API 由来データであり、空文字列の混入は排除されていない。`""` が通ると `titleIncludesAny(title, [holding.name, holding.nameJa])`（holding-news.ts:105-111）が全タイトルに真を返し、当該銘柄に記事プール上位5件が無差別に紐付く。テスト（watchlist-data.test.ts:54-64）も undefined ケースのみで `""` 入力を検証していない。
**Fix:**
```ts
symbol: entry.ticker,
name: entry.name?.trim() ? entry.name : entry.ticker,
nameJa: entry.nameJa?.trim() ? entry.nameJa : entry.ticker,
sector: "",
```
（`||` でも可。空白のみの文字列も同様に防ぐなら trim 判定が確実。）`""` 入力で ticker にフォールバックすることを検証するテストを追加すること。

### WR-06: tmp/news.json の記事要素未検証 — 不正要素1件でニュースマップ全体が `{}` に縮退し、Invalid Date は NaN スコアとして出力に混入する

**File:** `src/scripts/collect-watchlist-data.ts:156-167`
**Issue:** 記事配列の要素形状を検証せず `{ ...a, publishedAt: new Date(a.publishedAt) }` にかける。(a) 要素が `null` の場合 `a.publishedAt` アクセスで即 throw → 内側 catch で articles=[] となり**正常な記事も含めて全ウォッチリスト銘柄のニュースが失われる**。(b) `title` が string でない記事は `buildHoldingNewsMap` 内の `title.toLowerCase()`（holding-news.ts:109）で throw → 外側 catch で `{}` 書き込みとなり同様に全損する（buildHoldingNewsMap の throw-free 契約 D-08 は正しい入力が前提であり、無改変流用の責務として呼び出し側が入力を保証すべき）。(c) `publishedAt` が欠落・不正な記事は Invalid Date となり `getTime()` = NaN → `score: NaN` が `watchlist-news.json` に出力され、下流の JSON 消費側で `NaN` は `null` にシリアライズされる等の歪みを生む。有効JSON出力の契約自体は守られるが、要素1件の破損で全損する粒度は fail-soft 設計（D-20）の趣旨に合わない。
**Fix:** map 前に要素をフィルタする:
```ts
articles = Array.isArray(parsed)
  ? (parsed as ReadonlyArray<Record<string, unknown>>)
      .filter(
        (a) =>
          a !== null && typeof a === "object" &&
          typeof a.id === "string" && typeof a.title === "string" &&
          typeof a.publishedAt === "string" && !Number.isNaN(Date.parse(a.publishedAt)),
      )
      .map((a) => ({ ...(a as object), publishedAt: new Date(a.publishedAt as string) }) as NewsArticleWithId)
  : [];
```

### WR-07: fetchChunked は fetchOne の reject に耐性がなく、docstring の主張と「reject テスト」は実態と乖離している

**File:** `src/portfolio/watchlist-data.ts:88-103`（テスト: `src/portfolio/watchlist-data.test.ts:203-225`）
**Issue:** docstring は「万一 reject しても Promise.all のチャンク単位分離は破壊されない」と主張するが、実装では `fetchOne` が reject すると `Promise.all` が reject → `fetchChunked` 全体が reject し、**それまでに蓄積した全チャンクの結果（`results`）ごと失われる**。「チャンク単位分離」は保たれない。さらにこれを検証すると称するテスト「一部 ticker で fetchOne が reject する場合でも…」は、`throw` を**自分で catch して null を返す** fetchOne を渡しており（test:206-212）、実際には一度も reject していない — reject 耐性は未検証のままテスト名だけが緑になる（テスト信頼性の問題）。現状 `fetchTechnicalSnapshot` は内部 try/catch で reject しない（technicals.ts:141-158）ため実害は顕在化しないが、契約コメント・テストと実装の三者が食い違っている。
**Fix:** 実装を主張に合わせるのが安全:
```ts
const batchResults = await Promise.all(
  batches[i].map(async (symbol) => {
    try {
      return await fetchOne(symbol);
    } catch {
      return null;
    }
  }),
);
```
その上でテストの fetchOne を実際に `Promise.reject` させて他銘柄の snapshot が保持されることを検証する。実装を変えない場合は docstring の「reject しても…破壊されない」記述を削除し、テスト名を「null を返す場合」に修正すること。

## Info

### IN-01: writeEmptyOutputs と正常系で JSON 整形が不一致

**File:** `src/scripts/collect-watchlist-data.ts:82-89`
**Issue:** 正常系は `JSON.stringify(..., null, 2)` で pretty-print するが、`writeEmptyOutputs`（および技術ブランチの縮退書き込み line 146-150）は compact。同一アーティファクトのフォーマットが経路により変わり、diff 目視やログ調査で無用のノイズになる。
**Fix:** 全書き込み箇所を `JSON.stringify(payload, null, 2)` に統一する。

### IN-02: `batches[i].map(fetchOne)` は関数参照渡しで (element, index, array) が渡る — 潜在ハザード

**File:** `src/portfolio/watchlist-data.ts:96`
**Issue:** `Array.prototype.map` は `fetchOne(symbol, index, array)` として呼び出す。現在の `fetchTechnicalSnapshot(symbol: string)` は単一引数のため実害はないが、将来 fetchOne 系関数にオプショナル第2引数（例: yf インスタンスやオプション）が追加されると index が渡る古典的バグ（`map(parseInt)` 型）になる。
**Fix:** `batches[i].map((symbol) => fetchOne(symbol))` と明示ラムダにする（WR-07 の修正を採用すれば自然に解消する）。

### IN-03: fake timers テストの assertion が弱く、sleep を削除しても成功する

**File:** `src/portfolio/watchlist-data.test.ts:236-254`
**Issue:** 「チャンク間の待機ロジックが存在する」テストは最終的な結果件数（6件）しか検証しておらず、`sleep` 呼び出しを実装から削除してもそのまま成功する。待機ロジックの存在を保証するテストになっていない。
**Fix:** タイマーを進める前の時点で `fetchOne` の呼び出し回数が 5（第1チャンクのみ）であることを assert し、`advanceTimersByTimeAsync(300)` 後に 6 になることを検証する。

---

_Reviewed: 2026-07-15T04:21:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
