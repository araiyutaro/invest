---
phase: 09-pipeline-integration
reviewed: 2026-06-28T04:39:09Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/scripts/collect-data.ts
  - src/scripts/collect-data.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 09: Code Review Report

**Reviewed:** 2026-06-28T04:39:09Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

`collect-data.ts` はデータ収集スクリプトとして全体的によく構成されており、市場データ・ニュース・ポートフォリオの各ソース間でエラー戦略が明確に分離されている（市場データは致命的エラー、ニュース/ポートフォリオは継続可能エラー）。

ただし3点のWarningと3点のInfoを確認した。最も重要なのは**WR-01（サイレント障害）**と**WR-02（ESM main ガード欠落）**の2件。

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `fetchGoogleNewsJapan` / `fetchAllRssNews` 障害が無音で握り潰される

**File:** `src/scripts/collect-data.ts:33-34`
**Issue:**
`Promise.all` 内で Google ニュースと RSS ニュースの個別 `.catch(() => [])` は例外を握り潰し、ログ出力を一切行わない。これらのソースが完全に落ちていても `[]` に化けて処理が継続されるため、運用中に障害を検知する手段がない。Finnhub が成功する限り外側の `try-catch` にも到達しないため障害が完全に不可視になる。

```typescript
// 現状 — エラーが消える
fetchGoogleNewsJapan().catch(() => [] as Awaited<ReturnType<typeof fetchGoogleNewsJapan>>),
fetchAllRssNews().catch(() => [] as Awaited<ReturnType<typeof fetchAllRssNews>>),
```

**Fix:**
```typescript
fetchGoogleNewsJapan().catch((e) => {
  console.error("Google News 収集失敗（続行）:", e);
  return [] as Awaited<ReturnType<typeof fetchGoogleNewsJapan>>;
}),
fetchAllRssNews().catch((e) => {
  console.error("RSS ニュース収集失敗（続行）:", e);
  return [] as Awaited<ReturnType<typeof fetchAllRssNews>>;
}),
```

---

### WR-02: ESM main ガードなし — `main()` がインポート時に副作用として実行される

**File:** `src/scripts/collect-data.ts:90-93`
**Issue:**
モジュール末尾の `main().catch(...)` は、ファイルが直接実行された場合だけでなく `import` された場合にも実行される。テストファイルでは `await import("./collect-data.js")` を各テストで呼ぶが、最初のインポート時にモジュールレベルの `main()` が起動する（await されていないため非同期で進行）。直後にテストが `await main()` を呼ぶと、2 つの `main()` が並行して走ることになり、`writeFileMock.mock.calls` の呼び出し回数が意図より多くなる。現在はモック実装が同期的なため致命的ではないが、将来のアサーション強化で脆弱点になる。

```typescript
// 現状 — import しただけで main() が走る
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

**Fix:** ESM でスクリプト直接実行を検出するガードを追加する。
```typescript
import { fileURLToPath } from "node:url";

// モジュールが直接実行された場合のみ main() を呼ぶ
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
```

---

### WR-03: Test 5 はモジュールレベルの catch を実際にはテストしていない

**File:** `src/scripts/collect-data.test.ts:128-143`
**Issue:**
「`fetchAllMarketData` が reject したとき `process.exit(1)` が呼ばれる」というテストは、テスト内部でモジュールの `.catch(...)` と同じロジックを手動で再現している。実際のモジュールレベルハンドラーが動作しているわけではなく、テストは本来検証すべき動作を自己完結的に作り出している。

```typescript
// Test 5 内部でロジックを手動再現 — モジュールの実装をテストしていない
await main().catch((error) => {
  console.error("Fatal error:", error);  // ← これはテストが自分で書いたコード
  process.exit(1);
});
```

**Fix:** モジュールレベルの `main().catch(...)` を直接テストするには、WR-02 の修正でエクスポートされた `_runMain` 等の内部ランナーを公開するか、ESM main ガードを採用してスクリプトを別ファイルに分離する設計が必要。暫定対応として、テストコメントに「このテストはモジュールレベルの catch の代替を手動で検証するもの」と明記し、誤解を防ぐ。

---

## Info

### IN-01: 本番コード全体に `console.log` が散在している

**File:** `src/scripts/collect-data.ts:15,18,25,43,46,52,79,80,83,86,87`
**Issue:**
プロジェクトのコーディングスタイル（`rules/coding-style.md`）は「No console.log statements」を必須とする。本スクリプトは CLI ツールのため進捗表示は合理的だが、スタイルポリシーとは形式的に矛盾する。

**Fix:** `pino` や `winston` など軽量ロガーへの移行、またはプロジェクトとして CLI スクリプトへの例外明記のいずれかを検討する。

---

### IN-02: `finalArticles` への不要な中間コピー

**File:** `src/scripts/collect-data.ts:44-49`
**Issue:**
`filtered.length > 80` の場合、44行目で作成した `[...filtered]` は47行目で即座に上書きされ、GC 対象となる。余計なメモリアロケーションを生んでいる。

```typescript
// 現状 — 上書き前提の無駄なコピー
let finalArticles = [...filtered];      // line 44: ← この配列は条件成立時に捨てられる
if (filtered.length > 80) {
  finalArticles = [...filtered]         // line 47: 別コピーで上書き
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 80);
}
```

**Fix:**
```typescript
const finalArticles =
  filtered.length > 80
    ? [...filtered]
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, 80)
    : filtered;
```

---

### IN-03: FILT-04 MAX テストで全記事の `publishedAt` が同一日時 — ソート正確性が未検証

**File:** `src/scripts/collect-data.test.ts:268-285`
**Issue:**
90件のテスト記事はすべて `makeArticle()` デフォルト値 `publishedAt: new Date("2026-06-28T00:00:00Z")` を使う。同一タイムスタンプのため、`sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())` が期待通り「新しい記事を優先する」かどうかを検証できていない。テストはサイズ (80件) のみ確認しており合格するが、ソートロジックのバグは見逃す。

**Fix:** テスト記事にバリエーションのある日時を付与し、上位 80 件が新しい記事であることをアサートする。

```typescript
articles: Array.from({ length: 90 }, (_, i) =>
  makeArticle({
    url: `https://example.com/${i}`,
    publishedAt: new Date(Date.now() - i * 60_000), // 1分刻みで古くなる
  }),
),
// ...
// ソート後の最後の記事が最も古いことを確認
const parsed = JSON.parse(newsJsonCall![1] as string);
expect(parsed).toHaveLength(80);
expect(new Date(parsed[0].publishedAt).getTime())
  .toBeGreaterThan(new Date(parsed[79].publishedAt).getTime());
```

---

_Reviewed: 2026-06-28T04:39:09Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
