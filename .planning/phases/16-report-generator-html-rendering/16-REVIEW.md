---
phase: 16-report-generator-html-rendering
reviewed: 2026-07-02T06:55:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/meeting/schemas.test.ts
  - src/meeting/schemas.ts
  - src/meeting/types.ts
  - src/scripts/generate-news-digest.test.ts
  - src/scripts/generate-news-digest.ts
  - src/scripts/report-utils.test.ts
  - src/scripts/report-utils.ts
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-07-02T06:55:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 16 の差分（新規レンダラー `generate-news-digest.ts` + テスト、`tickerNames` の契約追加、パープルアクセント追加）を敵対的視点でレビューした。診断コマンドで裏取り済みの事実: 対象テスト 36 件は全パス、`npx vitest run` で確認。

**セキュリティ面は堅牢。** href の scheme 検証（`safeHref`）→ `escapeHtml` の順序が正しく、title/source/commentary/leadIn/ticker ラベル/date のすべての補間箇所がエスケープされており、`rel="noopener noreferrer"` も付与されている。XSS 経路は発見できなかった。Critical 該当なしは精査の結果であり、妥協ではない。

一方で、**CURA-08 の中核成果物である「ティッカーピル」が視覚的に成立していない**（CSS クラス未定義 + 区切りなし結合）点と、**不正な `publishedAt` 入力で "Invalid Date" がレポートに露出する**点の 2 件を Warning として検出した。いずれも既存テストではすり抜ける（テストはテキスト内容のみを検証しており、スタイル定義とエッジ入力を検証していない）。

なお `generateNewsDigestHtml` は現時点で本体コードから未参照だが、16-02-PLAN に「書き出し・パイプライン統合は Phase 17 スコープ」と明記されているため、未使用エクスポートとしては指摘しない。

## Warnings

### WR-01: `.ticker-pill` / `.news-meta` の CSS が未定義 — 複数ティッカーが区切りなしの連結テキストとして描画される

**File:** `src/scripts/generate-news-digest.ts:49-58, 77-81` / `src/scripts/report-utils.ts:84-184`
**Issue:** `formatTickerPillsHtml` は `<span class="ticker-pill">` を生成し `.join("")` で連結するが、`.ticker-pill` と `.news-meta` のスタイル定義が `generateBaseStyles` にもインラインにも存在しない（`grep` で全 src を確認済み — 参照 3 箇所、定義 0 箇所）。結果として:
1. ピルの外観（背景・パディング・角丸）が一切適用されず、CURA-08 / 16-02-PLAN の must_have「ティッカーピルが表示され」が視覚的に満たされない。
2. `join("")` はピル間に区切りを入れないため、複数ティッカー記事では「`NVDA エヌビディアMSFT マイクロソフト`」のように社名と次のシンボルが密着した可読不能なテキストになる。CSS の margin が存在しない現状ではこれを緩和するものが何もない。

既存テスト（`CURA-08` ケース）は `toContain("NVDA エヌビディア")` 等のテキスト一致のみで、スタイル定義の有無・複数ピルの分離を検証していないため、この欠陥を検出できない。
**Fix:** `generateBaseStyles` またはレンダラー側スタイルに定義を追加する:
```css
.ticker-pill {
  display: inline-block;
  background: #2a2a3e;
  border-radius: 999px;
  padding: 0.1rem 0.6rem;
  margin-right: 0.4rem;
  font-size: 0.8rem;
}
.news-meta { color: #888; font-size: 0.85rem; }
```
あわせて複数ピルのテスト（tickers 2 件の記事で両ピルが分離して出力されること）を追加する。

### WR-02: `formatPublishedAtJst` が不正な日時文字列で "Invalid Date" をレポートに露出する

**File:** `src/scripts/generate-news-digest.ts:31-42`
**Issue:** `new Date(publishedAtIso)` は不正入力（空文字・非 ISO 文字列）で Invalid Date を返し、`toLocaleString` はそのまま文字列 `"Invalid Date"` を返すため、公開レポートのメタ行にそのまま表示される。`publishedAt` の供給元は `tmp/news.json` のプールで、`NewsArticlePoolEntry`（schemas.ts:227-234）は TypeScript interface に過ぎず zod 検証がない — 収集系の不具合や外部 API の欠損値がそのまま到達し得る。Phase 15/16 の設計思想は「いかなる入力でも throw せずグレースフルにデグラデーション」（schemas.ts:240-242）だが、このパスだけ無防備で設計方針と不整合。
**Fix:**
```typescript
function formatPublishedAtJst(publishedAtIso: string): string {
  const d = new Date(publishedAtIso);
  if (Number.isNaN(d.getTime())) return ""; // または publishedAtIso をそのまま表示
  return d.toLocaleString("ja-JP", { /* 既存オプション */ });
}
```
呼び出し側（`formatArticleCardHtml`）で空文字時に「 ・ 」区切りを省略する調整も行う。

## Info

### IN-01: `safeHref` が大文字スキームの正当な URL をリンク化しない

**File:** `src/scripts/generate-news-digest.ts:60-63`
**Issue:** `url.startsWith("http://")` は大小文字を区別するため、`HTTPS://example.com` のような正当な URL がプレーンテキストにフォールバックする。フェイルセーフ方向の誤りなのでセキュリティ問題ではないが、外部ニュースソース由来の URL 表記ゆれで見出しリンクが失われ得る。
**Fix:** `const lower = url.toLowerCase(); return lower.startsWith("http://") || lower.startsWith("https://") ? url : null;`

### IN-02: `date` 引数が curation 非 null 時に無視され、分岐によってタイトルの由来が変わる

**File:** `src/scripts/generate-news-digest.ts:122-147`
**Issue:** null フォールバック時は引数 `date` を、非 null 時は `curation.date` をタイトルに使う。両者が食い違う呼び出しでは分岐によってページタイトルが変わり、契約が曖昧。
**Fix:** どちらか一方に統一する（例: 常に `curation?.date ?? date`）か、非 null 時も引数 `date` を使う。

### IN-03: `renderShell` で `timestamp` のみ未エスケープ補間

**File:** `src/scripts/generate-news-digest.ts:115`
**Issue:** `${timestamp}` は `toLocaleString` の出力で実質安全だが、同ファイルの「全補間箇所を escapeHtml する」方針（16-02-PLAN key_links）と不整合。将来 timestamp の生成方法が変わった際の残存リスク。
**Fix:** `${escapeHtml(timestamp)}` に統一する。

### IN-04: leadIn が空文字でも「今日の市場を動かすもの」見出し + 空段落が描画される

**File:** `src/scripts/generate-news-digest.ts:94-100, 146`
**Issue:** `articles` が非空で `leadIn === ""`（zod デフォルト補完で発生し得る）の場合、見出しだけの空カードがページ冒頭に出る。
**Fix:** `curation.leadIn.trim() === ""` のときは leadIn セクションを省略する。

### IN-05: テストヘルパー `jstTime` が実装と同一ロジックの鏡写し（トートロジー検証）

**File:** `src/scripts/generate-news-digest.test.ts:78-87, 99`
**Issue:** 期待値を実装と同じ `toLocaleString` オプションで導出しているため、タイムゾーンやフォーマット指定の誤りを検出できない（実装とテストが同時に間違えば通る）。
**Fix:** 少なくとも 1 ケースはリテラル期待値で固定する（例: `expect(html).toContain("7/2 15:30")`）。

### IN-06: schemas.test.ts の複数ケースが console.warn を stub せず stderr にノイズを出す

**File:** `src/meeting/schemas.test.ts:123-149, 225-256`
**Issue:** 「プール実在 ID」「ticker マージ」「tickerNames 透過」等のケースは MIN_ARTICLES 未満警告（`選定1件 < 10件`）を毎回 stderr に出力する（vitest 実行で確認済み）。テスト失敗ではないが出力ノイズで実際の警告を埋もれさせる。
**Fix:** `beforeEach` で `vi.spyOn(console, "warn").mockImplementation(() => {})` を一括適用する（既存の `afterEach` の `restoreAllMocks` はそのまま有効）。

---

_Reviewed: 2026-07-02T06:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
