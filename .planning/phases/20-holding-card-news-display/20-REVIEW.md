---
phase: 20-holding-card-news-display
reviewed: 2026-07-03T08:38:22Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/portfolio/holding-news.ts
  - src/portfolio/holding-news.test.ts
  - src/scripts/generate-news-digest.ts
  - src/scripts/generate-portfolio-report.ts
  - src/scripts/generate-report.ts
  - src/scripts/generate-report.test.ts
  - src/scripts/report-data-loaders.ts
  - src/scripts/report-data-loaders.test.ts
  - src/scripts/report-utils.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-07-03T08:38:22Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 20（保有カード関連ニュース表示）の差分 9 ファイルを standard 深度でレビューした。範囲は `normalizeHoldingSymbol` / `resolvePortfolioHoldingNews` の追加（holding-news.ts）、fail-soft ローダー 2 件（report-data-loaders.ts）、`safeHref` / `formatPublishedAtJst` の report-utils.ts への共通化、ポートフォリオレポートの関連ニュース描画、および generate-report.ts のパイプライン結線。

セキュリティ面は良好: title / source / URL / 日時はすべて `escapeHtml()` を通過し、`safeHref()` が `javascript:` / `data:` スキームを遮断、リンクには `rel="noopener noreferrer"` が付与されている。シンボル正規化の `toUpperCase()` により `__proto__` 等のプロトタイプ汚染キーも実質無害化されている。テストは 74 件すべてパス、シンボル表記揺れ（Test 37）や ID 混入防止（Pitfall 5）など重要な契約がテストで固定されている。

一方で 2 件の WARNING を検出した。(1) `resolvePortfolioHoldingNews` は「throw しない」と文書化されているが、ローダーが JSON.parse 結果を型アサーションのみで返すため、形状不正な tmp ファイル（有効な JSON だが期待形状でない）で TypeError が発生し、**3 レポート全ての生成が停止する**（3 つのクラッシュパスを実行検証で確認済み）。(2) 関連ニュース `<li>` のインライン style が UI-SPEC ルール3 が明示的に警告する `border-left: 3px solid #10b981`（グローバル li ルール）を打ち消しておらず、仕様が禁止した「ニュース項目ごとのアクセント border-left 繰り返し表示」がそのまま発生する。

範囲外メモ: `npx tsc --noEmit` は `src/scripts/collect-data.test.ts` で TS7006 エラー 4 件を報告するが、当該ファイルは本フェーズの diff 範囲（20008d3..HEAD）に含まれず既存の問題である。

## Narrative Findings (AI reviewer)

### Warnings

#### WR-01: ローダーの形状無検証により resolvePortfolioHoldingNews が throw し、3 レポート全滅のクラッシュパスが成立する（fail-soft 契約違反）

**File:** `src/scripts/report-data-loaders.ts:90-112`, `src/portfolio/holding-news.ts:56-84`, `src/scripts/generate-report.ts:108`
**Severity:** WARNING
**Issue:** `loadNewsPool` / `loadHoldingNews` は `JSON.parse(raw) as ...` の型アサーションのみで値を返す。JSON として有効だが形状が不正なファイルに対し、`resolvePortfolioHoldingNews` は docstring（holding-news.ts:54「throw しない」）に反して TypeError を投げる。実行検証で以下 3 パスを確認した:

1. `holding-news.json` = `{"MRNA": null}` → `for (const entry of entries)` で `TypeError: entries is not iterable`
2. `holding-news.json` = `null`（有効な JSON）→ `Object.entries(null)` で `TypeError: Cannot convert undefined or null to object`
3. `news.json` = `{}`（非配列）→ `pool.map is not a function`

`generate-report.ts:108` の呼び出しは try/catch も writeFile より前のため、関連ニュース機能の入力破損だけで daily-report.html / meeting-minutes.html / portfolio-report.html の全てが未生成になる。これは D-08/D-09（欠損・失敗は 0 件表示に自然縮退）の設計意図、および同ファイル内 `loadMarketData` が `Array.isArray` で形状検証している既存パターンと矛盾する。
**Fix:** ローダー側で形状ガードを追加する（`loadMarketData` と同型）:

```typescript
export async function loadNewsPool(): Promise<ReadonlyArray<NewsArticlePoolEntry>> {
  try {
    const raw = await readFile(join(TMP_DIR, "news.json"), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ReadonlyArray<NewsArticlePoolEntry>) : [];
  } catch (error) { /* 既存どおり */ return []; }
}

export async function loadHoldingNews(): Promise<HoldingNewsFile> {
  try {
    const raw = await readFile(join(TMP_DIR, "holding-news.json"), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => Array.isArray(v)),
    ) as HoldingNewsFile;
  } catch (error) { /* 既存どおり */ return {}; }
}
```

加えて（defense-in-depth として）`resolvePortfolioHoldingNews` 側でも `Array.isArray(entries)` でない値を warn + skip すれば docstring の no-throw 契約が入力に依存せず成立する。

#### WR-02: 関連ニュース `<li>` がグローバル `border-left: 3px solid #10b981` を打ち消しておらず、UI-SPEC ルール3 が明示的に禁止した表示崩れが発生する

**File:** `src/scripts/generate-portfolio-report.ts:31`
**Severity:** WARNING
**Issue:** `generateBaseStyles()` のグローバルルールは `li { padding: 0.5rem 0.8rem; margin-bottom: 0.3rem; background: #1e1e2e; border-radius: 6px; border-left: 3px solid ${accentColor}; }`（report-utils.ts:142-148）。`formatHoldingNewsItemHtml` のインライン style は `padding` / `margin-bottom` / `background` / `border-radius` を上書きするが **`border-left` を上書きしていない**ため、関連ニュースの各項目に緑（#10b981）の 3px 左ボーダーが残存する。UI-SPEC（20-UI-SPEC.md:143 ルール3）は「打ち消さないと、`#10b981`アクセントの`border-left`がニュース項目ごとに繰り返し表示され、Accent 10%予算を大幅超過する」とこの正確な失敗モードを警告している（打ち消し目的で列挙されたプロパティ群に `border-left` 自体が抜けており、仕様サンプル HTML の欠陥を実装がそのまま継承した形。テストは文字列包含アサーションのためこの CSS カスケード漏れを検出できない）。
**Fix:**

```typescript
return `<li style="padding:0.4rem 0;border-top:1px solid #2a2a3e;background:transparent;border-radius:0;margin-bottom:0;border-left:none;">
```

あわせて 20-UI-SPEC.md のサンプル（121行目）とルール3のプロパティ列挙にも `border-left:none` を追記し、仕様と実装の齟齬を解消すること。

### Info

#### IN-01: resolvePortfolioHoldingNews の正規化キー衝突時に先勝ちエントリが無警告で消失する

**File:** `src/portfolio/holding-news.ts:80`
**Issue:** `result[normalizeHoldingSymbol(symbol)] = resolved` は、`"MRNA"` と `" mrna "` のように正規化後に同一となるキーが入力に共存した場合、後のエントリで前のエントリを黙って上書きする。現行の生成側（`buildHoldingNewsMap`）は正準シンボルのみを書くため実害はないが、drop 系は `console.warn` を出す本関数の方針と非対称。
**Fix:** 代入前に `if (result[key]) console.warn(...)` を追加するか、既存配列とマージする。

#### IN-02: 空文字の name / nameJa / matchAliases が全記事にマッチする

**File:** `src/portfolio/holding-news.ts:105-111`
**Issue:** `titleIncludesAny` は `String.prototype.includes("")` が常に true のため、`holding.name` / `nameJa` / エイリアスのいずれかが空文字だと全記事が name/alias 一致になる。現在の `PORTFOLIO_HOLDINGS` は人間キュレーションで全て非空だが、`matchesHoldingByName` / `buildHoldingNewsMap` は export された汎用 API であり将来のデータ追加で踏み得る。
**Fix:** `candidates.filter((c) => c.trim() !== "")` を照合前に挟む。

#### IN-03: formatPublishedAtJst がパース不能な日時で "Invalid Date" をそのまま描画する

**File:** `src/scripts/report-utils.ts:13-24`
**Issue:** `new Date(publishedAtIso)` が Invalid Date の場合、`toLocaleString` は文字列 `"Invalid Date"` を返し、レポートのメタ行にそのまま表示される（generate-portfolio-report.ts:33 / generate-news-digest.ts:49 の両呼び出し元に影響）。
**Fix:** `Number.isNaN(d.getTime())` の場合は空文字または `"--"` を返す。

#### IN-04: generate-report.test.ts でテスト番号 33/34/35 が重複している

**File:** `src/scripts/generate-report.test.ts:205-232, 381-421`
**Issue:** "Test 33"〜"Test 35" が Daily Report のチャートテスト（[chart] 付き）と Portfolio Report の関連ニューステストの双方で使われており、失敗時のトレーサビリティ（PLAN の必須テスト番号との突き合わせ）を損なう。
**Fix:** Portfolio Report 側を Test 39〜41 に振り直す（または `[news]` タグで区別する）。

---

_Reviewed: 2026-07-03T08:38:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
