---
phase: 15-curation-contract-schema
reviewed: 2026-07-02T05:12:23Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/data/news/article-id.ts
  - src/data/news/article-id.test.ts
  - src/scripts/collect-data.ts
  - src/scripts/collect-data.test.ts
  - src/meeting/types.ts
  - src/meeting/schemas.ts
  - src/meeting/schemas.test.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-07-02T05:12:23Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 15（ニュースキュレーション契約スキーマ）の実装をレビューした。対象は記事ID付与モジュール（`assignArticleIds`）、collect-data パイプラインへの統合、2層バリデーション（`validateRawNewsCuration` / `resolveNewsCuration`）、および対応する型定義・テスト。

**検証実施内容:**
- 対象3テストファイルを実行: 35テスト全パス
- `tsc --noEmit` を HEAD とベースコミット（worktree）の両方で実行し比較: 検出された型エラー（`finnhub.ts:43`、`collect-data.test.ts` の implicit any）はすべてベースコミット時点で既存であり、本フェーズで導入されたものではないことを確認
- zod v4.3.6 の実挙動を Node で実測: 非コアフィールドへの `null` 入力が第1層で throw することを確認（WR-01）

**総評:** 幻覚URL防止の設計（title/url/source/publishedAt は必ずプールから解決し、LLM出力を信用しない）は正しく実装されており、passthrough された未知フィールドが出力オブジェクトに漏れない点も確認した。セキュリティ上の Critical 問題はない。ただし、LLM出力の現実的な形（`null` フィールド）に対する耐性ギャップが1件、`resolveNewsCuration` の「絶対に throw しない」保証の過大表明が1件、テストの実効性に関する問題が2件ある。

なお `resolveNewsCuration` / `NewsCuration` 型はまだ本番コードから消費されていないが、これは契約層のみを納品する本フェーズのプラン（15-02-PLAN.md）どおりであり、指摘対象としない。

## Warnings

### WR-01: 非コアフィールドの `null` 値が第1層バリデーションで throw し、D-09 のグレースフルデグラデーション意図と矛盾する

**File:** `src/meeting/schemas.ts:206-207, 213-214`
**Issue:** `commentary` / `tickers` / `leadIn` / `articles` は `.optional().default(...)` で定義されているが、zod v4 の `.optional()` は `undefined`（フィールド欠落）のみ許容し、`null` は throw する。実測で確認済み:

```
null commentary: THROWS
null tickers: THROWS
null leadIn: THROWS
null articles: THROWS
```

LLM は空のオプションフィールドを省略ではなく `null` で出力することが頻繁にある。コード内コメントおよび D-09 は「コア契約（id/market/importance）は厳格検証、**それ以外は passthrough + デフォルト補完**」と明記しているが、現実装では `commentary: null` 1件でキュレーション全体が第1層で失われる。これは設計意図（非コアは寛容に受理）に反する。schemas.test.ts にも null 入力のテストケースが存在しないため、このギャップが検出されていない。
**Fix:**
```typescript
const curatedArticleRawSchema = z
  .object({
    id: z.string().min(1),
    market: z.enum(["us", "japan", "global"]),
    importance: z.enum(["high", "medium", "low"]),
    commentary: z.string().nullish().transform((v) => v ?? ""),
    tickers: z.array(z.string()).nullish().transform((v) => v ?? []),
  })
  .passthrough();

const rawNewsCurationSchema = z
  .object({
    leadIn: z.string().nullish().transform((v) => v ?? ""),
    articles: z.array(curatedArticleRawSchema).nullish().transform((v) => v ?? []),
  })
  .passthrough();
```
あわせて schemas.test.ts に `null` フィールドの受理テストを追加すること。

### WR-02: `resolveNewsCuration` の「いかなる入力でも throw しない」保証が第1層の実行に暗黙依存しており、防御的ガードがない

**File:** `src/meeting/schemas.ts:240-241, 252, 262`
**Issue:** JSDoc は「いかなる入力でも throw しない（グレースフルデグラデーション）」と宣言しているが、この保証は呼び出し側が必ず `validateRawNewsCuration` を経由して `commentary` / `tickers` / `articles` のデフォルト補完を受けた場合にのみ成立する。将来の消費側（次フェーズで実装予定）が `JSON.parse(...) as RawNewsCuration` のようにキャストで渡した場合:
- `raw.articles` が `undefined` → 252行目の `for..of` で TypeError
- `item.commentary` が `undefined` → 262行目の `.trim()` で TypeError

「throw しない安全網」がこの関数の存在意義である以上、型契約だけに頼らずランタイムガードを入れるべき。
**Fix:**
```typescript
for (const item of raw.articles ?? []) {
  ...
  if ((item.commentary ?? "").trim() === "") {
```
または JSDoc を「`validateRawNewsCuration` を通過した入力に対して throw しない」に修正し、保証範囲を正確に表明する（コード側ガードを推奨）。

### WR-03: article-id.test.ts のイミュータビリティテストは要素の破壊的変更を検出できない（実効性のない検証）

**File:** `src/data/news/article-id.test.ts:26-35`
**Issue:** 「元配列は変更されず」を検証すると称するテストだが、`const original = [...articles]` は浅いコピーであり、`original[0]` と `articles[0]` は同一オブジェクト参照。仮に `assignArticleIds` が `article.id = ...; return article` と要素を破壊的に変更する実装でも、`expect(articles).toEqual(original)` は両者が同時に変異するため必ずパスし、`result[0]` への他の検証もパスする。つまりこのテストは要素の mutation に対して構造的に fail し得ない。
**Fix:**
```typescript
it("元配列は変更されず、他フィールドは保持される", () => {
  const articles = [makeArticle({ title: "記事A", url: "https://example.com/a" })];
  const snapshot = structuredClone(articles); // 深いコピーで変異を検出可能にする
  const result = assignArticleIds(articles);

  expect(articles).toEqual(snapshot);
  expect("id" in articles[0]).toBe(false); // 元要素に id が生えていないことを直接検証
  expect(result[0]).not.toBe(articles[0]); // 新オブジェクトであることを検証
  ...
});
```

### WR-04: collect-data.ts のモジュールトップレベル `main()` 自動実行がテストの信頼性を損なう（既存問題だが新規テストにも波及）

**File:** `src/scripts/collect-data.ts:106-109`, `src/scripts/collect-data.test.ts:133-148, 323-345`
**Issue:** （ベースコミットから存在する既存問題だが、本フェーズで追加された CURA-02 テストも同じ構造の上に載っているため記録する）

1. `main().catch(...)` がモジュールトップレベルで実行されるため、テストが `await import("./collect-data.js")` した瞬間に await されないバックグラウンドの `main()` 実行が走る。最初にインポートしたテストでは、明示的な `await main()` と自動実行が同一モックに並行して書き込み、`writeFileMock.mock.calls` に二重の呼び出しが混入し得る。現状は `find()` ベースの緩い検証で偶然パスしているが、呼び出し回数や順序を検証するテストを将来追加すると即座に不安定化する。
2. Test 5（133-148行）は本番の catch ロジックをテスト内に手書きで再実装しており（`await main().catch((error) => { ...; process.exit(1); })`）、本番コードのトップレベル `.catch` が削除されてもパスする。本番のエラーハンドリングを何も検証していない空虚なテスト。

**Fix:** エントリポイント実行をガードし、テストからのインポートで副作用が走らないようにする:
```typescript
import { pathToFileURL } from "node:url";

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```
Test 5 はガード付きエントリポイントを直接検証する形に書き直すか、少なくとも「テスト内で catch を再実装している」旨のコメントを外して実態に合わせること。

## Info

### IN-01: ticker マージの重複排除が大文字小文字を区別する

**File:** `src/meeting/schemas.ts:276`
**Issue:** `[...new Set([source.ticker, ...item.tickers])]` は `"AAPL"` と `"aapl"` を別要素として両方保持する。LLM 出力のティッカー表記ゆれで重複が残り得る。
**Fix:** マージ前に `toUpperCase()` で正規化する。

### IN-02: `assignArticleIds` の2桁ゼロ埋めが collect-data.ts の MAX=80 クランプに暗黙結合している

**File:** `src/data/news/article-id.ts:25`
**Issue:** 100件以上の入力で `"n100"` が生成される（一意性は保たれるため正しさは壊れないが、ドキュメントの「2桁固定」前提が崩れる）。クランプ値は別モジュール（collect-data.ts）のリテラル `80` であり、変更時にこの関数のコメントが陳腐化する。
**Fix:** `padStart(2, "0")` を維持するなら、共有定数 `MAX_NEWS_ARTICLES = 80` を article-id.ts 側にエクスポートして collect-data.ts から参照し、結合を明示化する。

### IN-03: `.passthrough()` は zod v4 で非推奨

**File:** `src/meeting/schemas.ts:209, 216`
**Issue:** プロジェクトは zod ^4.3.6 を使用。`.passthrough()` は動作するが v4 では deprecated であり、`z.looseObject({...})` が推奨形。既存コード（150, 160行）も同パターンのため、一括移行が望ましい。
**Fix:** `z.looseObject({ ... })` へ置換。

### IN-04: collect-data.ts のクランプ閾値がマジックナンバー（schemas.ts と不整合なスタイル）

**File:** `src/scripts/collect-data.ts:52-57`
**Issue:** （既存）`80` / `20` がリテラルで3箇所に散在。本フェーズで追加した schemas.ts は `MAX_ARTICLES` / `MIN_ARTICLES` の名前付き定数を採用しており、同一コードベース内でスタイルが不整合。
**Fix:** `const MAX_NEWS = 80; const MIN_NEWS = 20;` を定義して参照。

### IN-05: Google News / RSS の取得失敗が無言で握りつぶされる

**File:** `src/scripts/collect-data.ts:39-40`
**Issue:** （既存）`.catch(() => [] as ...)` はエラーを一切ログせず空配列にフォールバックする。ニュースソースの恒常的障害に気づけない。Finnhub 失敗時は全ソースの結果を破棄して `[]` を書く一方、Google/RSS 失敗は無言継続という非対称な劣化ポリシーも意図的か確認する価値がある。
**Fix:** `.catch((e) => { console.warn("Google News取得失敗（続行）:", e); return []; })` のようにログを残す。

### IN-06: リポジトリの `tsc --noEmit` が clean でない（すべて既存エラー、本フェーズ起因ではない）

**File:** `src/data/news/finnhub.ts:43`, `src/scripts/collect-data.test.ts:297, 299, 358, 360`
**Issue:** `tsc --noEmit` で TS2345（finnhub.ts の map コールバック第2引数の型不一致）と TS7006（implicit any）が報告される。ベースコミットの worktree で同一エラーを確認済みであり、本フェーズで導入されたものではない。ただし型チェックが CI ゲートとして機能していない状態が続くと、今後のフェーズで新規型エラーの混入を検出できない。
**Fix:** finnhub.ts:43 の `(item, ticker?)` シグネチャを修正し、`npm run typecheck`（`tsc --noEmit`）をテストと並ぶゲートに追加する（別フェーズ対応で可）。

---

_Reviewed: 2026-07-02T05:12:23Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
