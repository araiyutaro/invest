---
phase: 16-report-generator-html-rendering
reviewed: 2026-07-02T07:25:00Z
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
  info: 9
  total: 11
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-07-02T07:25:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

ギャップクロージャープラン 16-03 適用後の再レビュー。診断コマンドで裏取り済みの事実: 対象 3 テストファイル 37 件は全パス（`npx vitest run` で確認）。

**前回レビューの WR-01（`.ticker-pill` / `.news-meta` CSS 未定義 + 区切りなし連結）は解消を確認した。** `report-utils.ts:176-191` に `.ticker-pill`（inline-block・pill 形状・margin-right 0.4rem）と `.news-meta` の CSS が追加され、`generate-news-digest.ts:57` のピル結合が `.join(" ")` に変更された。回帰テスト（`generate-news-digest.test.ts:230-241`: 複数ティッカーの分離 + CSS 定義の出力確認）も追加されている。

**セキュリティ面は引き続き堅牢。** href の scheme 検証（`safeHref`）→ `escapeHtml` の順序が正しく、title/source/commentary/leadIn/ticker ラベル/date のすべての補間箇所がエスケープされ、`rel="noopener noreferrer"` も付与されている。XSS 経路は発見できなかった。Critical 該当なしは精査の結果であり、妥協ではない。

未解消の Warning が 2 件残る: (1) 前回から持ち越しの **不正 `publishedAt` で "Invalid Date" がレポートに露出する**問題（16-03 のスコープ外で未修正）、(2) 今回新規に検出した **`resolveNewsCuration` の重複 ID 排除がドキュメント化された契約（「初出のみ採用」）から逸脱するエッジケース**。

なお `generateNewsDigestHtml` / `resolveNewsCuration` は現時点で本体コードから未参照だが、16-CONTEXT に「パイプライン統合は Phase 17 スコープ」と明記されているため、未使用エクスポートとしては指摘しない。

## Warnings

### WR-01: `formatPublishedAtJst` が不正な日時文字列で "Invalid Date" をレポートに露出する（前回 WR-02 から持ち越し・未修正）

**File:** `src/scripts/generate-news-digest.ts:31-42`
**Issue:** `new Date(publishedAtIso)` は不正入力（空文字・非 ISO 文字列）で Invalid Date を返し、`toLocaleString` は文字列 `"Invalid Date"` を返すため、公開レポートのメタ行にそのまま表示される。`publishedAt` の供給元は `tmp/news.json` のプールで、`NewsArticlePoolEntry`（`schemas.ts:227-234`）は TypeScript interface に過ぎず zod によるランタイム検証がない — 収集系の不具合や外部 API の欠損値がそのまま到達し得る。Phase 15/16 の設計思想は「いかなる入力でも throw せずグレースフルにデグラデーション」（`schemas.ts:240-242`）だが、このパスだけ無防備で設計方針と不整合。
**Fix:**
```typescript
function formatPublishedAtJst(publishedAtIso: string): string {
  const d = new Date(publishedAtIso);
  if (Number.isNaN(d.getTime())) return ""; // または publishedAtIso をそのまま表示
  return d.toLocaleString("ja-JP", { /* 既存オプション */ });
}
```
呼び出し側（`formatArticleCardHtml:79`）で空文字時に「 ・ 」区切りを省略する調整も行う。

### WR-02: `resolveNewsCuration` の重複 ID 排除が「初出のみ採用」契約から逸脱する — drop された初出の重複が後から採用される

**File:** `src/meeting/schemas.ts:253-267`
**Issue:** `seenIds.add(item.id)` がすべての drop チェック（重複・不明 ID・空 commentary）を**通過した後**にのみ実行される。このため、初出の `n01` が空 commentary で drop された場合、`seenIds` に登録されず、2 回目の `n01`（有効な commentary 付き）が重複チェックをすり抜けて採用される。トレース:
1. `articles[0] = { id: "n01", commentary: "" }` → 空 commentary で drop（`seenIds` 未登録）
2. `articles[1] = { id: "n01", commentary: "有効" }` → `seenIds.has("n01")` は false → 採用

これはテスト記述「重複ID: 同一idは初出のみ採用、2回目以降drop+warn」（`schemas.test.ts:164`）およびコメント「重複排除」（`schemas.ts:240`）の契約と矛盾する。副作用として、採用位置が LLM の出力順の後方にずれるため、MAX_ARTICLES truncate（D-03「Agent自身の重要度順を尊重」）の切り捨て境界に影響し得る。既存テストは「両方有効な重複」のみ検証しており、このパスは未検出。
**Fix:** 意図を確定して統一する。厳格な「初出のみ」を守るならループ先頭で登録する:
```typescript
for (const item of raw.articles) {
  if (seenIds.has(item.id)) {
    console.warn(`[news-curation] 重複記事IDをdrop: ${item.id}`);
    continue;
  }
  seenIds.add(item.id); // drop チェックの前に登録（初出のみ採用を厳守）
  // ... 以降のチェック
}
```
逆に「drop された初出は重複扱いしない（有効な後続でリカバリする）」を意図するなら、その旨をコメント・テスト記述に明記し、このパスのテストを追加する。

## Info

### IN-01: `safeHref` が大文字スキームの正当な URL をリンク化しない

**File:** `src/scripts/generate-news-digest.ts:60-63`
**Issue:** `url.startsWith("http://")` は大小文字を区別するため、`HTTPS://example.com` のような正当な URL がプレーンテキストにフォールバックする。フェイルセーフ方向の誤りなのでセキュリティ問題ではないが、外部ニュースソース由来の URL 表記ゆれで見出しリンクが失われ得る。
**Fix:** `const lower = url.toLowerCase(); return lower.startsWith("http://") || lower.startsWith("https://") ? url : null;`

### IN-02: `date` 引数が curation 非 null 時に無視され、分岐によってタイトルの由来が変わる

**File:** `src/scripts/generate-news-digest.ts:122-147`
**Issue:** null フォールバック時は引数 `date` を、非 null 時は `curation.date` をタイトルに使う。両者が食い違う呼び出しでは分岐によってページタイトルが変わり、契約が曖昧。
**Fix:** どちらか一方に統一する（例: 常に `curation?.date ?? date`）。

### IN-03: `renderShell` で `timestamp` のみ未エスケープ補間

**File:** `src/scripts/generate-news-digest.ts:115`
**Issue:** `${timestamp}` は `toLocaleString` の出力で実質安全だが、同ファイルの「全補間箇所を escapeHtml する」方針と不整合。将来 timestamp の生成方法が変わった際の残存リスク。
**Fix:** `${escapeHtml(timestamp)}` に統一する。

### IN-04: leadIn が空文字でも「今日の市場を動かすもの」見出し + 空段落が描画される

**File:** `src/scripts/generate-news-digest.ts:94-100, 146`
**Issue:** `articles` が非空で `leadIn === ""`（zod デフォルト補完 `schemas.ts:214` で発生し得る）の場合、見出しだけの空カードがページ冒頭に出る。
**Fix:** `curation.leadIn.trim() === ""` のときは leadIn セクションを省略する。

### IN-05: `.ticker-pill` の文字色が共有スタイルシート内でパープル固定値にハードコードされている

**File:** `src/scripts/report-utils.ts:176-186`
**Issue:** 16-03 で追加された `.ticker-pill` の `color: #c4b5fd` は、パープルアクセント（`#8b5cf6`）の lighter バリアントの固定値。`generateBaseStyles` は 4 レポート共通の基盤スタイルであり、他のアクセント色（青 `#3b82f6` / 橙 `#f59e0b` / 緑 `#10b981`）で呼び出された場合もピルはパープルのままになる。現状ピルを使うのは news-digest のみなので実害はないが、他レポートでピルを再利用した瞬間に配色不整合が顕在化する。
**Fix:** `color: ${accentLighter};` を使う（同関数内で既に導出済みの変数）。

### IN-06: プール内の重複 ID が `Map` 構築時に警告なく last-wins で上書きされる

**File:** `src/meeting/schemas.ts:249`
**Issue:** `new Map(pool.map((a) => [a.id, a]))` は、`tmp/news.json` に同一 ID のエントリが重複していた場合、後勝ちで静かに上書きする。LLM 出力側の重複は warn 付きで drop する（D-08）のに対し、プール側の重複は検知されない非対称がある。
**Fix:** Map 構築時に `poolById.has(a.id)` をチェックして `console.warn` を出す（採用は first-wins / last-wins のどちらかを明示）。

### IN-07: テストヘルパー `jstTime` が実装と同一ロジックの鏡写し（トートロジー検証）

**File:** `src/scripts/generate-news-digest.test.ts:98-107, 119`
**Issue:** 期待値を実装と同じ `toLocaleString` オプションで導出しているため、タイムゾーンやフォーマット指定の誤りを検出できない（実装とテストが同時に間違えば通る）。
**Fix:** 少なくとも 1 ケースはリテラル期待値で固定する（例: `expect(html).toContain("7/2 15:30")` — fixture コメント `JST 7/2 15:30` は既に書かれている）。

### IN-08: schemas.test.ts の複数ケースが console.warn を stub せず stderr にノイズを出す

**File:** `src/meeting/schemas.test.ts:123-149, 225-256`
**Issue:** 「プール実在 ID」「ticker マージ」「tickerNames 透過」「tickerNames省略時」等のケースは MIN_ARTICLES 未満警告（`選定1件 < 10件`）を毎回 stderr に出力する（vitest 実行で確認済み）。テスト失敗ではないが出力ノイズで実際の警告を埋もれさせる。
**Fix:** `beforeEach` で `vi.spyOn(console, "warn").mockImplementation(() => {})` を一括適用する（既存の `afterEach` の `restoreAllMocks` はそのまま有効）。

### IN-09: `markdownToHtml` のテーブル解析が空白依存で脆い

**File:** `src/scripts/report-utils.ts:31-40`
**Issue:** 行マッチ `^\| (.+) \|$` はパイプ前後に厳密な半角スペースを要求するため、`|A|B|` のような詰めた記法はテーブル化されず生テキストが `<p>` に露出する。セル分割も `content.split(" | ")` の文字列分割で、セル内にリテラル ` | ` を含むと列がずれる。プロジェクト方針（LLM 生成コンテンツはテーブルでなく箇条書きを使う）により実害は限定的だが、入力の表記ゆれ耐性がない。
**Fix:** 行マッチを `^\|\s*(.+?)\s*\|$`、分割を `content.split("|").map((c) => c.trim())` に緩和する（または本関数のテーブル対応を「サポート外」とコメントで明示する）。

---

_Reviewed: 2026-07-02T07:25:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
