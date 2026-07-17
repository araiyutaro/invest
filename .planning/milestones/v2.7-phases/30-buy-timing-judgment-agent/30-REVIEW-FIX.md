---
phase: 30-buy-timing-judgment-agent
fixed_at: 2026-07-15T12:28:29Z
review_path: .planning/phases/30-buy-timing-judgment-agent/30-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 30: Code Review Fix Report

**Fixed at:** 2026-07-15T12:28:29Z
**Source review:** .planning/phases/30-buy-timing-judgment-agent/30-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8（Critical 3件 + Warning 5件。Info 5件は既定スコープ外）
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: prev ファイルの judgments 形状未検証 — 破損1件で当日全判定が空出力に上書きされる全損経路

**Files modified:** `src/scripts/write-watchlist-judgment.ts`, `src/scripts/write-watchlist-judgment.test.ts`
**Commit:** d63268c
**Applied fix:** `loadPrevJudgmentDefensive` に judgments フィールドの形状検証を追加。非配列・null/非オブジェクト要素・非文字列 ticker・不正 todayAction のいずれかを検出したら `{ prev: null, corrupted: true }` を返し throw しない（前日比較は enrichment であり、破損 prev が当日出力を破壊してはならない）。実機再現された3ケース（`judgments:"oops"` / `[null]` / `[{ticker:123}]`）の回帰テスト + 「prev 破損でも当日判定が破棄されない」統合回帰テストを追加。

### CR-02: invest.md — highlightedStocks 0件分岐が Step 3-J を飛ばして Step 3d へ誘導する

**Files modified:** `.claude/commands/invest.md`
**Commit:** debd1c5
**Applied fix:** 0件分岐パラグラフ（1479行）の遷移先を「Step 3d」から「Step 3-J」に変更し、依存関係列挙に「Step 3-J の買いタイミング判定」を追加。注目銘柄0件の日でもウォッチリスト判定が必ず実行される。

### CR-03: invest.md 3-J.2 の「CLI が status:skipped として記録」は実装と矛盾 — skip レコードが本番経路で到達不能

**Files modified:** `src/scripts/write-watchlist-judgment.ts`, `src/scripts/write-watchlist-judgment.test.ts`
**Commit:** bf9dbef
**Applied fix:** レビューの代替案（CLI 側検出、D-20 の「TS が決定論的に記録する」契約を維持する堅牢な方式）を採用。`loadActiveWatchlistTickersDefensive` を新設し、`data/watchlist.json` のアクティブ銘柄を read-only・防御的（ENOENT 空正常系 / 破損は警告して空扱いの fail-soft、エントリレベル形状検証あり）に読み、raw 判定が存在しないアクティブ銘柄に `buildSkippedJudgment` で陽性 skip レコードを合成する。raw 0件でもアクティブ銘柄があれば早期 return せず skip 合成へ進む（Agent 全滅日対応）。raw 検証失敗銘柄（failedTickers）は「読み取れた判定が無い」欠落として FAIL マーカー報告に留め、skip 合成の対象外（検証失敗と判定不能の区別を維持）。invest.md 3-J.2 の記述「CLI 側が status:skipped として記録します」はこの修正により実装と一致するため変更不要。テスト3件追加（raw 欠落銘柄の skip 合成 / raw 0件+アクティブ有 / 検証失敗銘柄の非合成）。

### WR-01: raw 検証ループの Map キーが内容 ticker 由来 — 重複/ファイル名不一致が無警告で silent overwrite

**Files modified:** `src/scripts/write-watchlist-judgment.ts`, `src/scripts/write-watchlist-judgment.test.ts`
**Commit:** 3d1b819
**Applied fix:** ファイル名由来キー（`/`→`-` 置換規約の逆変換キーを含む）と内容 ticker キーの不一致を検出したら `console.warn` + failedTickers 計上して出力に含めない。同一 ticker への重複は先勝ちで `console.warn` + failedTickers 計上。件数減少が FAIL マーカーに反映され監査ログに残る。テスト2件追加（エコーミスによる不一致 / 大小文字違いファイル名の重複）。

### WR-02: attachActionChanges が「純関数: throw なし」契約に違反 — 不正 prev 要素で TypeError

**Files modified:** `src/portfolio/watchlist-judgment.ts`, `src/portfolio/watchlist-judgment.test.ts`
**Commit:** b93a44b
**Applied fix:** 関数冒頭で非配列 prevJudgments を null 同様に扱い、prev Map 構築時に null 要素・非文字列 ticker 要素を filter で除外する defense-in-depth を実装（呼び出し元の CR-01 検証だけに依存しない）。テスト2件追加（非配列入力 / null・非文字列 ticker 要素混入）。

### WR-03: 前日の status:"skipped" レコードが通常の wait 判定として比較される — D-14 規律違反

**Files modified:** `src/scripts/write-watchlist-judgment.ts`, `src/scripts/write-watchlist-judgment.test.ts`
**Commit:** 084ece3
**Applied fix:** `main()` で `prev.judgments.filter((j) => j.status !== "skipped")` により前日 skip レコードを比較対象から除外。当日側の skipped レコードにも previousAction/actionChanged を付与しない（rest 分割代入で構造的に除去）。「比較不能（undefined）」と「変化なし（false）」の D-14 区別を skip レコードでも維持。テスト2件追加（前日 skipped は比較に寄与しない / 当日 skipped に比較プロパティ非付与）。

### WR-04: deriveMarket が大文字 `.T` のみ判定 — 小文字ティッカーが US に誤分類

**Files modified:** `src/portfolio/watchlist-judgment.ts`, `src/portfolio/watchlist-judgment.test.ts`
**Commit:** 8a10e78
**Applied fix:** `/\.T$/i.test(ticker.trim())` に変更し、normalizeHoldingSymbol（trim + toUpperCase）と同等の表記揺れ耐性を持たせた。`7203.t` と ` 7203.T ` のテスト2件追加。

### WR-05: readdir の catch-all — 権限エラー等も「アクティブ0件正常系」として [STEP:OK] を出す

**Files modified:** `src/scripts/write-watchlist-judgment.ts`, `src/scripts/write-watchlist-judgment.test.ts`
**Commit:** 69e15b5
**Applied fix:** readdir の catch で ENOENT（`.code` と `.message` の両チェック、loadPrevJudgmentDefensive と同じ規約）のみ正常系0件とし、EACCES 等の実障害は `console.error` + 空の有効 JSON 出力 + `[STEP:watchlist-judgment:FAIL:raw読込失敗]` で return（fail-soft 維持、`[PIPELINE:FAIL]` 非出力）。テスト2件追加（EACCES → FAIL マーカー / プレーン Error("ENOENT") → OK マーカーの D-19 回帰防止）。

## Skipped Issues

なし — スコープ内の全8件を修正した。

## Verification Evidence

- `npx vitest run`: **33 files / 579 tests all passed**（修正前 81件 → テスト20件追加を含む）
- `npx tsc --noEmit`: 新規エラーなし（既存の `src/scripts/collect-data.test.ts` の TS7006 4件のみ — 本フェーズ以前からの既知エラー）
- 全分岐で `[PIPELINE:FAIL]` 非出力・有効 JSON 出力の fail-soft 契約を回帰テストで維持
- Phase 30 決定事項（TS専用フィールドの構造的不在、confluence ゲート、prev 退避 + 同日ガード）は全修正で不変

---

_Fixed: 2026-07-15T12:28:29Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
