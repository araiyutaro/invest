# Phase 15: Curation Contract & Schema - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 8 (5 new, 3 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/meeting/types.ts` (MODIFIED — add `NewsCuration`/`CuratedArticle`) | model (type定義) | transform | 同ファイル内 `PortfolioAnalysis`/`HoldingEvaluation` (lines 110-124) | exact |
| `src/meeting/schemas.ts` (MODIFIED — add `curatedArticleRawSchema`/`rawNewsCurationSchema`/`validateRawNewsCuration`/`resolveNewsCuration`) | model (zod契約 + 解決関数) | transform | 同ファイル内 `portfolioAnalysisSchema`/`validatePortfolioAnalysis` (lines 141-186) | exact |
| `src/meeting/schemas.test.ts` (NEW) | test | request-response(検証) | `src/scripts/validate-meeting.test.ts` | exact |
| `src/data/news/article-id.ts` (NEW — `assignArticleIds()`) | utility (純関数) | transform | `src/data/news/filter.ts` (`deduplicateByUrl` 等の純関数群, lines 127-140) | exact |
| `src/data/news/article-id.test.ts` (NEW) | test | transform | `src/data/news/filter.test.ts` | exact |
| `src/data/news/types.ts` (MODIFIED — `NewsArticleWithId`型追加、または `article-id.ts` 内に定義) | model | transform | 同ファイル内 `RawNewsArticle` (lines 1-9) | exact |
| `src/scripts/collect-data.ts` (MODIFIED — `assignArticleIds()` を `news.json` 書き出し直前に組み込み) | script (パイプライン統合) | file-I/O | 同ファイル内 news.json 書き出しブロック (lines 30-66) | exact (self-modification) |
| `src/scripts/collect-data.test.ts` (MODIFIED — ID付与のテストケース追加) | test | file-I/O | 同ファイル内 Test 3 / "news filter integration" ブロック (lines 42-47, 107-118) | exact |

## Pattern Assignments

### `src/meeting/types.ts` (model, transform)

**Analog:** 同ファイル内 `PortfolioAnalysis`/`HoldingEvaluation`（`/Users/arai/invest/src/meeting/types.ts` lines 110-124）

**既存パターン抜粋**（readonly + ReadonlyArray、interfaceベース。契約に対応する型はそのままここに追記する）:
```typescript
export interface HoldingEvaluation {
  readonly symbol: string;
  readonly nameJa: string;
  readonly decision: "保持" | "買増" | "一部売却" | "全売却";
  readonly rationale: string;
  readonly riskNote?: string;
}

export interface PortfolioAnalysis {
  readonly date: string;
  readonly generatedAt: string;
  readonly overallComment: string;
  readonly holdings: ReadonlyArray<HoldingEvaluation>;
  readonly rebalanceActions: ReadonlyArray<string>;
}
```

**追加すべき型（RESEARCH.md Code Examplesより、この規約に完全準拠）:**
```typescript
export interface CuratedArticle {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly publishedAt: string; // ISO 8601, tmp/news.jsonのプールから解決済み（Date型ではない — Pitfall 3参照）
  readonly market: "us" | "japan" | "global";
  readonly importance: "high" | "medium" | "low";
  readonly commentary: string;
  readonly tickers: ReadonlyArray<string>;
}

export interface NewsCuration {
  readonly date: string;
  readonly generatedAt: string;
  readonly leadIn: string;
  readonly articles: ReadonlyArray<CuratedArticle>;
}
```
既存の enum リテラルユニオン（`"強気" | "中立" | "弱気"` 等、`meeting/types.ts` lines 3, 43, 53, 59, 68, 76）と同じ文字列リテラルユニオン形式を踏襲するが、本フェーズの enum は英語小文字（`us/japan/global`, `high/medium/low`）である点がD-06/D-07で明示的に規定されている。

---

### `src/meeting/schemas.ts` (model, transform)

**Analog:** 同ファイル内 `portfolioAnalysisSchema`/`validatePortfolioAnalysis`（`/Users/arai/invest/src/meeting/schemas.ts` lines 141-186）

**Imports pattern**（lines 1-2）:
```typescript
import { z } from "zod";
import type { MeetingResult, WebSearchResult, ReevaluationOutput, PortfolioAnalysis } from "./types.js";
```
→ `NewsCuration`, `CuratedArticle` を追加インポートする。

**passthrough + optional/default 耐性パターン**（lines 141-186、`portfolioAnalysisSchema` 全体）:
```typescript
const decisionEnum = z.enum(["保持", "買増", "一部売却", "全売却"]);

const rawHoldingSchema = z.object({
  symbol: z.string(),
  nameJa: z.string().optional(),
  decision: decisionEnum.optional(),
  action: decisionEnum.optional(),
  rationale: z.string().optional(),
  reason: z.string().optional(),
  riskNote: z.string().optional(),
  keyMetric: z.string().optional(),
  riskLevel: z.string().optional(),
}).passthrough();

export const holdingEvaluationSchema = rawHoldingSchema.transform((raw) => {
  const riskParts = [raw.keyMetric, raw.riskLevel].filter((v): v is string => Boolean(v));
  const riskNote = raw.riskNote ?? (riskParts.length > 0 ? riskParts.join(" / ") : undefined);
  return {
    symbol: raw.symbol,
    nameJa: raw.nameJa ?? "",
    decision: raw.decision ?? raw.action ?? "保持",
    rationale: raw.rationale ?? raw.reason ?? "",
    ...(riskNote !== undefined ? { riskNote } : {}),
  };
});

const rawPortfolioSchema = z.object({
  date: z.string(),
  generatedAt: z.string().optional(),
  overallComment: z.string().optional(),
  portfolioSummary: z.string().optional(),
  holdings: z.array(holdingEvaluationSchema),
  rebalanceActions: z.array(z.string()).optional(),
}).passthrough();

export const portfolioAnalysisSchema = rawPortfolioSchema.transform((raw) => ({
  date: raw.date,
  generatedAt: raw.generatedAt ?? "",
  overallComment: raw.overallComment ?? raw.portfolioSummary ?? "",
  holdings: raw.holdings,
  rebalanceActions: raw.rebalanceActions ?? [],
}));

export function validatePortfolioAnalysis(data: unknown): PortfolioAnalysis {
  return portfolioAnalysisSchema.parse(data) as PortfolioAnalysis;
}
```

**URL非保持の前例（幻覚防止の直接の先行実装）**（lines 105-117, `webSearchResultSchema`）:
```typescript
export const webSearchResultSchema = z.object({
  ticker: z.string(),
  researchSummary: z.string(),
  positiveFindings: z.array(z.string()),
  negativeFindings: z.array(z.string()),
  keyArticles: z.array(
    z.object({
      title: z.string(),   // ← urlフィールドが意図的に存在しない
      summary: z.string(),
    }),
  ),
  researchedAt: z.string(),
});
```
新設計はここからさらに一段進め、`title`すら出力させず`id`のみを出力させる（RESEARCH.md Pattern 2）。

**関数エクスポート命名パターン**（lines 101-103, 133-139, 184-186）: `validateXxx(data: unknown): XxxType` という命名 + `schema.parse(data) as Type` という形。新規追加の `validateRawNewsCuration` もこれに合わせる。

**追加すべきコード（RESEARCH.md Code Examplesで既に具体設計済み。そのままコピー可能）:**
```typescript
const curatedArticleRawSchema = z.object({
  id: z.string().min(1),
  market: z.enum(["us", "japan", "global"]),
  importance: z.enum(["high", "medium", "low"]),
  commentary: z.string().optional().default(""),
  tickers: z.array(z.string()).optional().default([]),
}).passthrough();

const rawNewsCurationSchema = z.object({
  leadIn: z.string().optional().default(""),
  articles: z.array(curatedArticleRawSchema).optional().default([]),
}).passthrough();

export type RawNewsCuration = z.infer<typeof rawNewsCurationSchema>;

export function validateRawNewsCuration(data: unknown): RawNewsCuration {
  return rawNewsCurationSchema.parse(data);
}

interface NewsArticlePoolEntry {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly publishedAt: string; // JSON往復後は必ずstring (Pitfall 3)
  readonly ticker?: string;
}

export function resolveNewsCuration(
  raw: RawNewsCuration,
  pool: ReadonlyArray<NewsArticlePoolEntry>,
  date: string,
  generatedAt: string,
): NewsCuration {
  const poolById = new Map(pool.map((a) => [a.id, a]));
  const seenIds = new Set<string>();
  const resolved: CuratedArticle[] = [];

  for (const item of raw.articles) {
    if (seenIds.has(item.id)) {
      console.warn(`[news-curation] 重複記事IDをdrop: ${item.id}`);
      continue;
    }
    const source = poolById.get(item.id);
    if (!source) {
      console.warn(`[news-curation] 不明な記事IDをdrop: ${item.id}`);
      continue;
    }
    if (item.commentary.trim() === "") {
      console.warn(`[news-curation] 解説コメント欠落によりdrop: ${item.id}`);
      continue;
    }
    seenIds.add(item.id);
    resolved.push({
      id: item.id,
      title: source.title,
      url: source.url,
      source: source.source,
      publishedAt: source.publishedAt,
      market: item.market,
      importance: item.importance,
      commentary: item.commentary,
      tickers: source.ticker ? [...new Set([source.ticker, ...item.tickers])] : item.tickers,
    });
  }

  let articles = resolved;
  if (articles.length > 15) {
    console.warn(`[news-curation] 選定${articles.length}件 > 15件、上位15件にtruncate`);
    articles = articles.slice(0, 15);
  } else if (articles.length < 10) {
    console.warn(`[news-curation] 選定${articles.length}件 < 10件（情報量の少ない日として受理)`);
  }

  return { date, generatedAt, leadIn: raw.leadIn, articles };
}
```

**Error handling pattern:** このコードベースの zod 契約層は「throw をそのまま呼び出し元に伝播させる」方針（try/catchでラップしない）。`validateRawNewsCuration` は `parse()` の ZodError を素通しする（`validateMeetingResult`/`validatePortfolioAnalysis` と同じ、lines 101-103, 184-186）。一方 `resolveNewsCuration` はプール参照起因の不整合を `console.warn` + drop で吸収し、決してthrowしない（グレースフルデグラデーション方針、CONTEXT.md D-08/D-10）。

---

### `src/meeting/schemas.test.ts` (test, request-response/検証)

**Analog:** `/Users/arai/invest/src/scripts/validate-meeting.test.ts`

**インラインfixtureパターン**（lines 1-58, 183-227の `portfolioAnalysisSchema` テストブロックが最も近い直接analog）:
```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { analystRound1OutputSchema, analystRound2OutputSchema, portfolioAnalysisSchema } from "../meeting/schemas.js";

describe("portfolioAnalysisSchema", () => {
  const validAnalysis = {
    date: "2026-06-25",
    generatedAt: "2026-06-25T09:30:00Z",
    overallComment: "ポートフォリオ全体への総括コメント",
    holdings: [
      {
        symbol: "MRNA",
        nameJa: "モデルナ",
        decision: "保持",
        rationale: "現状維持が最善",
        riskNote: "mRNAパイプラインリスク",
      },
    ],
    rebalanceActions: ["HIIを買増し", "POWLを一部売却"],
  };

  it("valid PortfolioAnalysis passes validation", () => {
    expect(() => portfolioAnalysisSchema.parse(validAnalysis)).not.toThrow();
  });

  it("decision must be one of 保持/買増/一部売却/全売却", () => {
    const invalid = {
      ...validAnalysis,
      holdings: [{ ...validAnalysis.holdings[0], decision: "ホールド" }],
    };
    expect(() => portfolioAnalysisSchema.parse(invalid)).toThrow();
  });

  it("empty holdings array is allowed", () => {
    const empty = { ...validAnalysis, holdings: [] };
    expect(() => portfolioAnalysisSchema.parse(empty)).not.toThrow();
  });
});
```

**新規 `src/meeting/schemas.test.ts` は、既存の `validate-meeting.test.ts` にはない独立ファイルとして新設する**（RESEARCH.mdが明記: `schemas.ts`自体のテストファイルは現状不在）。ただし記述スタイル（`describe`ブロック単位で対象スキーマ/関数を分離、`it("Xxxは...")` の日本語文タイトル、`expect(() => fn(data)).not.toThrow() / .toThrow()`）は上記そのまま踏襲する。

**カバーすべきテストケース（RESEARCH.md Validation Architecture表 + CONTEXT.md D-03〜D-10に対応）:**
- `validateRawNewsCuration`: 正常系通過、`market`に不正値（`"US"`, `"米国"`, `"europe"`）でthrow、`importance`に不正値でthrow、articles省略時に空配列デフォルト
- `resolveNewsCuration`: プール実在ID解決（title/url/source正しく引ける）、不明ID drop、重複ID初出のみ採用、commentary空文字drop、15件超truncate（Agent順序維持・再ソートなし）、10件未満はwarnのみで受理、0件は正常受理

---

### `src/data/news/article-id.ts` (utility, transform)

**Analog:** `/Users/arai/invest/src/data/news/filter.ts` の純関数群（特に `deduplicateByUrl`, lines 127-140）

**Imports pattern**（filter.ts line 1）:
```typescript
import type { RawNewsArticle, NewsFilterResult } from "./types.js";
```

**純関数パターン**（`deduplicateByUrl`, lines 127-140 — 入力配列を変更せず新配列を返す、JSDocコメントで根拠要件IDを付与）:
```typescript
/**
 * URL 正規化後に同一 URL の記事を集約し、summary が長い方を残す (DEDUP-01 / D-02)。
 */
function deduplicateByUrl(
  articles: ReadonlyArray<RawNewsArticle>,
): RawNewsArticle[] {
  const urlMap = new Map<string, RawNewsArticle>();
  for (const article of articles) {
    const key = normalizeUrl(article.url);
    const existing = urlMap.get(key);
    if (!existing || article.summary.length > existing.summary.length) {
      urlMap.set(key, article);
    }
  }
  return [...urlMap.values()];
}
```

**追加すべきコード（RESEARCH.md Code Examplesより）:**
```typescript
import type { RawNewsArticle } from "./types.js";

export interface NewsArticleWithId extends RawNewsArticle {
  readonly id: string;
}

/**
 * フィルタ済み記事配列に短い連番IDを付与する (D-01)。
 * 桁数は MAX=80 に対して2桁ゼロ埋め (n01〜n80) で十分。
 */
export function assignArticleIds(
  articles: ReadonlyArray<RawNewsArticle>,
): ReadonlyArray<NewsArticleWithId> {
  return articles.map((article, i) => ({
    ...article,
    id: `n${String(i + 1).padStart(2, "0")}`,
  }));
}
```
`article-id.ts` を `filter.ts` に追記しない理由（RESEARCH.md Assumption A1）: `filter.ts` は現状304行あり、追記すると350行超になる。ファイル分割規約（多くの小さいファイル、200-400行目安）に従い独立ファイルとする。

---

### `src/data/news/article-id.test.ts` (test, transform)

**Analog:** `/Users/arai/invest/src/data/news/filter.test.ts`

**インライン記事ファクトリパターン**（lines 1-19）:
```typescript
import { describe, it, expect } from "vitest";
import { filterNewsArticles, ... } from "./filter.js";
import type { RawNewsArticle } from "./types.js";

const makeArticle = (overrides: Partial<RawNewsArticle>): RawNewsArticle => ({
  title: "デフォルトタイトル",
  summary: "デフォルト本文",
  source: "TestSource",
  url: "https://example.com/article",
  publishedAt: new Date(),
  category: "japan_market",
  ...overrides,
});

describe("URL dedup (DEDUP-01)", () => {
  it("同一URLの記事が1件に集約される (DEDUP-01)", () => {
    const articles = [
      makeArticle({ url: "https://nikkei.com/article/1", summary: "短い" }),
      makeArticle({ url: "https://nikkei.com/article/1", summary: "こちらの方が長い本文" }),
    ];
    const result = filterNewsArticles(articles);
    expect(result.articles).toHaveLength(1);
  });
});
```
新規 `article-id.test.ts` はこの `makeArticle` ファクトリパターンをそのまま流用し、`assignArticleIds()` に対して「入力順にn01, n02...が付与される」「元配列は変更されない（イミュータブル）」「80件でもn80まで正しくゼロ埋めされる」等をテストする。

---

### `src/scripts/collect-data.ts` (script, file-I/O)

**Analog:** 同ファイル内 news.json 書き出しブロック（`/Users/arai/invest/src/scripts/collect-data.ts` lines 30-66）

**組み込み対象の既存コード（現状）:**
```typescript
try {
  console.log("ニュース収集中...");
  const usTickers = PORTFOLIO_HOLDINGS
    .map((h) => h.symbol)
    .filter((s) => !s.includes("."));

  const [finnhubNews, googleNews, rssNews] = await Promise.all([
    fetchAllFinnhubNews(usTickers),
    fetchGoogleNewsJapan().catch(() => [] as Awaited<ReturnType<typeof fetchGoogleNewsJapan>>),
    fetchAllRssNews().catch(() => [] as Awaited<ReturnType<typeof fetchAllRssNews>>),
  ]);
  const allArticles = [
    ...finnhubNews.general,
    ...finnhubNews.merger,
    ...finnhubNews.company,
    ...googleNews,
    ...rssNews,
  ];
  const { articles: filtered, stats } = filterNewsArticles(allArticles, usTickers);
  console.log(`ニュース: ${stats.raw}件 → dedup: ${stats.afterTitleDedup}件 → フィルタ後: ${stats.final}件`);
  let finalArticles = [...filtered];
  if (filtered.length > 80) {
    console.log(`MAX=80超過: ${filtered.length}件 → 80件にトリミング`);
    finalArticles = [...filtered].slice(0, 80);
  }
  if (finalArticles.length < 20) {
    console.log(`⚠ フィルタ後の記事が${finalArticles.length}件です（MIN=20未満）`);
  }
  await writeFile(
    join(TMP_DIR, "news.json"),
    JSON.stringify(finalArticles, null, 2),
    "utf-8",
  );
} catch (e) {
  console.error("ニュース収集失敗（続行）:", e);
  await writeFile(join(TMP_DIR, "news.json"), "[]", "utf-8");
}
```

**組み込み方針:** `filterNewsArticles()` の出力（80件トリミング後）に対して `assignArticleIds()` を `writeFile` 直前に1行挿入する（D-02: ID付与はPhase 15で完結）。
```typescript
import { assignArticleIds } from "../data/news/article-id.js"; // 追加インポート
// ...
const idArticles = assignArticleIds(finalArticles); // ← 挿入
await writeFile(
  join(TMP_DIR, "news.json"),
  JSON.stringify(idArticles, null, 2),
  "utf-8",
);
```
既存の `catch` ブロックの `writeFile(..., "[]", "utf-8")` フォールバックはID付与前の空配列なのでそのまま変更不要（ID付与対象がないため）。

---

### `src/scripts/collect-data.test.ts` (test, file-I/O)

**Analog:** 同ファイル内 `vi.mock("../data/news/filter.js", ...)` ブロック（lines 42-47）と Test 3（lines 107-118）

**モック済み依存の登録パターン**（lines 42-47）:
```typescript
vi.mock("../data/news/filter.js", () => ({
  filterNewsArticles: vi.fn().mockReturnValue({
    articles: [],
    stats: { raw: 0, afterUrlDedup: 0, afterTitleDedup: 0, afterCrossLangDedup: 0, afterRelevance: 0, final: 0 },
  }),
}));
```
新規 `assignArticleIds` はモックせず実物を使う方が統合テストとして自然（純関数で副作用なし）。もしID付与ロジック自体を切り離してテストしたい場合は同様に `vi.mock("../data/news/article-id.js", ...)` を追加する。

**news.json内容検証パターン**（lines 107-118, Test 3）:
```typescript
it("Test 3: tmp/news.json の内容は配列である", async () => {
  const { main } = await import("./collect-data.js");
  await main();

  const writeCalls = writeFileMock.mock.calls;
  const newsJsonCall = writeCalls.find((call) =>
    String(call[0]).includes("news.json"),
  );
  expect(newsJsonCall).toBeDefined();
  const parsed = JSON.parse(newsJsonCall![1] as string);
  expect(Array.isArray(parsed)).toBe(true);
});
```
追加すべきテストケース: `filterNewsArticles`モックが2件返すよう設定 → `main()`実行 → `news.json`書き出し内容の各要素が `id: "n01"`, `id: "n02"` を持つことを検証する（`.toHaveProperty("id")` および連番の値そのものを assert）。

---

## Shared Patterns

### 純関数のイミュータビリティ規約
**Source:** `src/data/news/filter.ts` 全体（`deduplicateByUrl`, `deduplicateByTitle`, `sortByPriorityScore` 等すべて `[...articles]` または `.map()`/`.filter()` で新配列を返し、元配列を変更しない）
**Apply to:** `assignArticleIds()`
```typescript
export function sortByPriorityScore(
  articles: ReadonlyArray<RawNewsArticle>,
  portfolioTickers: ReadonlyArray<string>,
): RawNewsArticle[] {
  const now = Date.now();
  return [...articles].sort((a, b) => { /* ... */ });
}
```

### zod passthrough + transform 耐性契約パターン
**Source:** `src/meeting/schemas.ts` lines 141-186 (`portfolioAnalysisSchema`)
**Apply to:** `curatedArticleRawSchema`, `rawNewsCurationSchema`
- コアフィールド（`id`/`market`/`importance`）は厳格検証（`z.enum`, `.min(1)`）
- 非コアフィールドは `.optional().default(...)` で欠落耐性
- オブジェクト全体は `.passthrough()` で未知フィールド許容

### グレースフルデグラデーション（console.warn/error + フォールバック、決してthrowしない）
**Source:** `src/scripts/collect-data.ts` lines 63-66 (`catch (e) { console.error(...); await writeFile(..., "[]", ...); }`)
**Apply to:** `resolveNewsCuration()` のID drop/truncate 処理全般（`console.warn` を使用、`console.error`ではない — 契約検証失敗ではなくデータ品質上の間引きのため）

### readonly / ReadonlyArray 型規約
**Source:** `src/meeting/types.ts` 全体、`.planning/codebase/CONVENTIONS.md`
**Apply to:** `NewsCuration`, `CuratedArticle`, `NewsArticleWithId` の全フィールド

### インラインfixtureテスト規約（独立JSONファイルを作らない）
**Source:** `src/scripts/validate-meeting.test.ts`, `src/data/news/filter.test.ts`
**Apply to:** `schemas.test.ts`, `article-id.test.ts` — fixtureは `.test.ts` 内のオブジェクトリテラル/ファクトリ関数として定義し、`fixtures/*.json` のような新規ディレクトリは作らない（RESEARCH.md Pitfall 4で明示的に警告済み）

## No Analog Found

なし。RESEARCH.mdが既存パターン（`portfolioAnalysisSchema`系の passthrough+transform、`webSearchResultSchema.keyArticles`のURL非保持前例）への直接マッピングを完了しており、8ファイル全てに強いanalogが存在する。

## Metadata

**Analog search scope:** `src/meeting/`, `src/data/news/`, `src/scripts/`
**Files scanned:** `src/meeting/schemas.ts`, `src/meeting/types.ts`, `src/data/news/types.ts`, `src/data/news/filter.ts`, `src/data/news/filter.test.ts`, `src/scripts/collect-data.ts`, `src/scripts/collect-data.test.ts`, `src/scripts/validate-meeting.test.ts`
**Pattern extraction date:** 2026-07-02
