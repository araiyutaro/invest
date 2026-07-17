---
phase: 30-buy-timing-judgment-agent
reviewed: 2026-07-15T12:13:38Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/meeting/types.ts
  - src/meeting/schemas.ts
  - src/meeting/schemas.test.ts
  - src/portfolio/watchlist-judgment.ts
  - src/portfolio/watchlist-judgment.test.ts
  - src/scripts/write-watchlist-judgment.ts
  - src/scripts/write-watchlist-judgment.test.ts
  - .claude/commands/invest.md
findings:
  critical: 3
  warning: 5
  info: 5
  total: 13
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-07-15T12:13:38Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Phase 30（買いタイミング判定 Agent）の8ファイルを標準深度でレビューした。フェーズ決定事項の多くは正しく実装されている: TS専用フィールド（market/asOf/previousAction/actionChanged）は raw スキーマに構造的に不在で transform は明示リテラルを返す（D-08 ✓、strip テストあり）、confluence ゲートの buy→wait 降格は決定論的（D-07 ✓）、ENOENT 判定は `.code` と `.message` の両方をチェック（✓）、`rm -rf` は raw ディレクトリのみを対象とし最終/前日ファイルを含まない（✓）、`[PIPELINE:FAIL]` 非出力は全分岐テストで担保（✓）。テスト81件は全パス。

しかし Critical を3件検出した。(1) 前日スナップショットの `judgments` フィールドの形状が未検証で、破損した prev ファイル1つが当日の全判定を空出力で上書きする全損経路（TypeError を実機再現済み）、(2) invest.md の既存 highlightedStocks 0件分岐が Step 3-J を飛ばして Step 3d へ誘導しており、0件の日に本フェーズの成果物が丸ごと実行されない、(3) invest.md 3-J.2 が「スナップショット欠落銘柄は CLI が status:skipped として記録する」と明記するが、当該銘柄は raw ファイルが生成されないため CLI からは不可視で、D-20 の陽性 skip レコードが本番経路では到達不能。

## Critical Issues

### CR-01: prev ファイルの judgments 形状未検証 — 破損1件で当日全判定が空出力に上書きされる全損経路

**File:** `src/scripts/write-watchlist-judgment.ts:36-40, 165-169, 191-203` / `src/portfolio/watchlist-judgment.ts:51-56`
**Issue:** `loadPrevJudgmentDefensive` はトップレベルが「非nullオブジェクトかつ非配列」であることしか検証せず、`judgments` フィールドの型を確認しないまま `WatchlistJudgmentFile` にキャストする。`tmp/prev-watchlist-judgment.json` が `{"date":"...","judgments":"oops"}` や `{"judgments":[null]}` や `{"judgments":[{"ticker":123}]}` の場合、`corrupted: false` で通過し、`attachActionChanges` 内で TypeError が発生する（実機再現済み: `prevJudgments.map is not a function` / `Cannot read properties of null (reading 'ticker')` / `symbol.trim is not a function`）。この throw は `main()` の `writeFile(OUTPUT_PATH)` より前に起きるため、CLI エントリの fatal catch が**検証済みの当日全判定を破棄して空出力で上書き**する。「1銘柄の不正が全体に波及しない」という本フェーズの fail-soft 設計（D-18、WR-06/WR-07 前例）と、`main()` の「throw せず全分岐で return する」契約（63-65行コメント）の両方に違反する。テストは prev のトップレベル形状（null/配列/文字列）のみカバーし、`judgments` フィールドの型不正は未カバー。
**Fix:**
```typescript
// loadPrevJudgmentDefensive 内、オブジェクト検査の直後に judgments の形状検証を追加
const record = parsed as Record<string, unknown>;
if (!Array.isArray(record.judgments)) {
  return { prev: null, corrupted: true };
}
const judgments = record.judgments.filter(
  (j): j is WatchlistJudgment =>
    typeof j === "object" && j !== null && !Array.isArray(j) &&
    typeof (j as Record<string, unknown>).ticker === "string" &&
    ((j as Record<string, unknown>).todayAction === "buy" ||
      (j as Record<string, unknown>).todayAction === "wait"),
);
return { prev: { ...(parsed as WatchlistJudgmentFile), judgments }, corrupted: false };
```
あわせて `judgments: "oops"` / `[null]` / `[{ticker:123}]` の回帰テストを追加すること。

### CR-02: invest.md — highlightedStocks 0件分岐が Step 3-J を飛ばして Step 3d へ誘導する

**File:** `.claude/commands/invest.md:1479`
**Issue:** Step 3-J は既存の0件分岐パラグラフ（「`highlightedStocks` 配列が0件の場合は…**Step 3a/3b のみを飛ばして Step 3d へ進んでください**」）の**直後**に挿入された（commit 6175c7a で確認）が、このパラグラフは更新されていない。オーケストレータが逐次読解でこの指示に到達すると、0件の日は Step 3-P から直接 Step 3d へジャンプし、その間に位置する Step 3-J（1483行〜）を一度も目にしないまま通過する。ウォッチリスト判定は highlightedStocks に依存しない機能であるにもかかわらず、注目銘柄0件の日には判定が丸ごとスキップされ、`tmp/watchlist-judgment.json` に前日以前の stale データが残留する（date も古いまま）。パラグラフ内の依存関係列挙（「Step 3d のポートフォリオ分析…と Step 3c/3e は highlightedStocks に依存しない」）にも 3-J への言及がなく、スキップ解釈を補強してしまう。
**Fix:** 1479行を以下のように更新する:
```markdown
`highlightedStocks` 配列が0件の場合は「注目銘柄が0件のためWebSearchリサーチをスキップします。」と表示し、**Step 3a/3b のみを飛ばして Step 3-J へ進んでください**（Step 3-J の買いタイミング判定、Step 3d のポートフォリオ分析・ニュースキュレーション、Step 3c/3e は highlightedStocks に依存しないため、0件の日でも必ず実行します）。
```

### CR-03: invest.md 3-J.2 の「CLI が status:skipped として記録」は実装と矛盾 — skip レコードが本番経路で到達不能

**File:** `.claude/commands/invest.md:1536` / `src/scripts/write-watchlist-judgment.ts:146-150`
**Issue:** 3-J.2 は「スナップショット欠落銘柄は Agent を起動しない。**CLI 側が status:skipped として記録します**」と明記するが、CLI の skip 経路（`buildSkippedJudgment`）は **raw ファイルが存在し検証に成功した銘柄**に対してのみ発動する（`validatedByTicker` のループ内）。スナップショット欠落のアクティブ銘柄は Agent が起動されず raw ファイルが書かれないため、CLI（`data/watchlist.json` を読まない）からは存在自体が不可視であり、skip レコードは生成されない。結果として D-20/Pitfall 5 が目的とした「『今日データが無く判定不能』と『そもそもウォッチリストに存在しない』の区別」が本番オーケストレーションでは実現されず、当該銘柄は出力から無言で消える。テストファイル自身のコメント（write-watchlist-judgment.test.ts:244-247）もこの経路が入力契約上発生しないことを認めており、実装済みの skip 経路は実質デッドパスである。
**Fix:** 最小修正は invest.md 側: 3-J.2 に「スナップショット欠落のアクティブ銘柄についても、Agent を起動せずフォールバック JSON（`{"ticker": "{ticker}", "todayAction": "wait", "rationale": "テクニカルデータ欠落", "signals": []}`）を `tmp/watchlist-judgment-raw/{ticker}.json` に書くこと」を追記する。これで CLI 側の既存 skip 経路（raw あり・snapshot なし → `buildSkippedJudgment`）が正しく発動する。代替案は CLI が `data/watchlist.json` のアクティブ銘柄を読み、raw 欠落銘柄にも skip レコードを合成する方式（より堅牢だが変更が大きい）。

## Warnings

### WR-01: raw 検証ループの Map キーが内容 ticker 由来 — 重複/ファイル名不一致が無警告で silent overwrite

**File:** `src/scripts/write-watchlist-judgment.ts:127-137`
**Issue:** `validatedByTicker.set(normalizeHoldingSymbol(judgment.ticker), ...)` は JSON **内容**の ticker をキーにする。LLM が ticker をエコーし損ねた場合（例: `BBB.json` の内容が `{"ticker":"AAA",...}`）、AAA の正当な判定が別ファイルの内容で無警告に上書きされ、BBB の判定は出力から消える。件数減少は `failedTickers` に計上されず `[STEP:watchlist-judgment:OK]` が出るため、欠落が監査ログに残らない。ファイル名（オーケストレータ管理で信頼できる）と内容 ticker の整合チェックがない。
**Fix:** ループ内で `normalizeHoldingSymbol(ticker.replace(/-/g, "/"))` 相当のファイル名由来キーと内容キーの不一致を検出したら `console.warn` して failedTickers に加える、または少なくとも `validatedByTicker.has(key)` の場合に warn を出して先勝ちにする。

### WR-02: attachActionChanges が「純関数: throw なし」契約に違反 — 不正 prev 要素で TypeError

**File:** `src/portfolio/watchlist-judgment.ts:41-66`
**Issue:** doc コメントは「純関数: throw なし」と宣言するが、`prevJudgments` が配列でない・要素が null・`ticker` が非文字列の場合に TypeError を throw する（CR-01 の関数レベル側面。実機再現済み）。呼び出し元の検証（CR-01 の修正）だけに依存すると、将来の別呼び出し元で同じ全損経路が再発し得る。
**Fix:** 関数冒頭で防御する（defense-in-depth）:
```typescript
if (prevJudgments === null || !Array.isArray(prevJudgments)) {
  return judgments.map((j) => ({ ...j }));
}
const prevByTicker = new Map(
  prevJudgments
    .filter((j) => typeof j === "object" && j !== null && typeof j.ticker === "string")
    .map((j) => [normalizeHoldingSymbol(j.ticker), j] as const),
);
```

### WR-03: 前日の status:"skipped" レコードが通常の wait 判定として比較される — D-14 規律違反

**File:** `src/scripts/write-watchlist-judgment.ts:169` / `src/portfolio/watchlist-judgment.ts:51-52`
**Issue:** 前日の出力に含まれる skip レコード（`todayAction: "wait", status: "skipped"` = 判定不能）が `attachActionChanges` の prev Map にそのまま入るため、当日 buy の銘柄に `previousAction: "wait", actionChanged: true` が付与される。実際には前日は「判定していない」のであり、「wait と判定した」わけではない。D-14 の「比較できなかった（undefined）と変化がなかった（false）を区別する」規律に照らすと、skipped な prev は比較不能（プロパティ非付与）として扱うべき。逆方向（当日 skipped レコードに previousAction が付く）も同様に意味が壊れる。
**Fix:** `main()` の呼び出し時に skip レコードを比較対象から除外する:
```typescript
const prevComparable = prev?.judgments.filter((j) => j.status !== "skipped") ?? null;
const finalJudgments = attachActionChanges(processedJudgments, prevComparable);
```
当日側も、`status === "skipped"` のレコードには previousAction/actionChanged を付与しない分岐を検討すること。

### WR-04: deriveMarket が大文字 `.T` のみ判定 — 小文字ティッカーが US に誤分類

**File:** `src/portfolio/watchlist-judgment.ts:72-74`
**Issue:** Map キー照合は `normalizeHoldingSymbol`（trim + toUpperCase）で表記揺れに耐えるのに対し、`deriveMarket` は生の `judgment.ticker` に `/\.T$/`（大文字・非ケースインセンシティブ）を適用する非対称がある。schema は ticker を正規化しないため、LLM が `7203.t` や ` 7203.T `（末尾空白）をエコーすると `market: "US"` に誤分類され、レポートの市場セクション振り分けが壊れる。
**Fix:** `return /\.T$/i.test(ticker.trim()) ? "JP" : "US";` とするか、呼び出し側で `deriveMarket(normalizeHoldingSymbol(judgment.ticker))` に統一する。

### WR-05: readdir の catch-all — 権限エラー等も「アクティブ0件正常系」として [STEP:OK] を出す

**File:** `src/scripts/write-watchlist-judgment.ts:91-97`
**Issue:** `readdir(RAW_DIR)` の catch は理由を問わず `rawFiles = []` に落とすため、EACCES / EIO 等の実障害でも「アクティブ銘柄0件」+ `[STEP:watchlist-judgment:OK]` として成功報告される。D-19 が正常系として想定するのはディレクトリ不存在（ENOENT）のみのはず。障害が OK マーカーで隠蔽されると、判定が丸ごと欠けた日を監査ログから検出できない。
**Fix:** ENOENT（`.code` と `.message` の両チェック、loadPrevJudgmentDefensive と同じ規約）のみ正常系0件とし、それ以外は `console.error` + 空出力 + `[STEP:watchlist-judgment:FAIL:raw読込失敗]` で return する。

## Info

### IN-01: schemas.ts — 同一モジュールからの重複 import 文

**File:** `src/meeting/schemas.ts:2-10`
**Issue:** `./types.js` からの `import type` が2文に分かれている（2-9行のブロックと10行の `WatchlistJudgment` 単独文）。
**Fix:** 1つの import 文に統合する。

### IN-02: applyConfluenceGate の警告ログにティッカーが含まれない

**File:** `src/portfolio/watchlist-judgment.ts:16-19`
**Issue:** 降格時の `console.warn` が signals 件数のみで、どの銘柄が降格されたかログから特定できない。CLI 側も `downgradedCount` の集計のみ。
**Fix:** 引数に `ticker` を含める（呼び出し元は既に judgment 全体を持っている）か、CLI 側で降格銘柄名を warn に出す。

### IN-03: fallbackDate が UTC 日付 — JST 朝実行では前日日付になる

**File:** `src/scripts/write-watchlist-judgment.ts:85, 195`
**Issue:** `new Date().toISOString().slice(0, 10)` は UTC 基準。パイプラインは JST 8:00 実行（= UTC 23:00 前日）のため、meeting-result 読込失敗時の空出力 date が前日になる。空 judgments のため 3-J.0 の退避ガードには実害が及ばないが、監査時に日付がずれる。
**Fix:** 他スクリプトの JST 日付導出ヘルパがあればそれを使う。なければ `Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" })` 等で JST 日付を導出する。

### IN-04: technicals snapshot の asOf 型未検証

**File:** `src/scripts/write-watchlist-judgment.ts:111-115, 160`
**Issue:** snapshot フィルタは `symbol` の string 型のみ確認し、`asOf` は未検証。`asOf` が欠落なら JSON.stringify で落ちるため無害だが、数値等の非文字列なら出力へそのまま透過する。
**Fix:** フィルタ条件に `typeof s.asOf === "string"` を追加する。

### IN-05: signals に要素単位フェイルソフトがない — 非文字列1要素で銘柄全体が検証失敗

**File:** `src/meeting/schemas.ts:399`
**Issue:** `signals: z.array(z.string()).optional()` は厳格で、1要素でも非文字列（LLM が数値やオブジェクトを混入）だと当該銘柄の parse 全体が失敗し failedTickers 落ちする。keyArticles（D-12）や lenientHoldings（WR-01 前例）の要素単位フェイルソフトと非対称。影響は当該1銘柄に閉じ、FAIL マーカーも出るため per-ticker 独立性は保たれている。
**Fix:** `z.array(z.unknown()).optional().transform((items) => items?.filter((s): s is string => typeof s === "string"))` のように要素単位で不正値を drop する（confluence ゲートは正準 signals 件数を読むため、drop 後の件数で自然に降格判定される）。

---

_Reviewed: 2026-07-15T12:13:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
