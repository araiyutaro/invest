# Phase 1: Data Layer + Skill Foundation - Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 2 (新規作成)
**Analogs found:** 2 / 2

---

## File Classification

| 新規/修正ファイル | Role | Data Flow | 最近傍アナログ | Match Quality |
|-----------------|------|-----------|--------------|---------------|
| `src/scripts/collect-data.ts` | script (orchestrator) | CRUD + file-I/O | `src/index.ts` | role-match (オーケストレーション構造が同一、ただしGemini依存なし) |
| `.claude/commands/invest.md` | skill (command) | request-response | `~/.claude/skills/gsd-fast/SKILL.md` | partial-match (フロントマター形式が同一) |

---

## Pattern Assignments

### `src/scripts/collect-data.ts` (script, CRUD + file-I/O)

**アナログ:** `src/index.ts`

**Imports パターン** (`src/index.ts` lines 1-16):
```typescript
import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fetchAllMarketData } from "./data/market.js";
import { PORTFOLIO_HOLDINGS } from "./portfolio/holdings.js";
import { fetchPortfolioData } from "./portfolio/data.js";
```
新スクリプトで追加するインポート（`src/index.ts`にないもの）:
```typescript
import { writeFile } from "node:fs/promises";
import { fetchAllFinnhubNews } from "./data/news/finnhub.js";
import { fetchGoogleNewsJapan } from "./data/news/google-news.js";
import { fetchAllRssNews } from "./data/news/rss-sources.js";
```
**注意:** `src/index.ts` が使う `fetchMarketNews` (`src/data/news.ts`) は内部で Gemini を呼ぶため使わない。個別 fetch 関数を直接インポートする（D-03、PITFALL-1）。

**`import.meta.dirname` パスパターン** (`src/index.ts` line 18):
```typescript
const REPORTS_DIR = join(import.meta.dirname, "../docs");
// collect-data.ts では:
const TMP_DIR = join(import.meta.dirname, "../../tmp");
```
`src/scripts/` に置くため `../../tmp` で2階層上がる。Node.js 24.3.0 で `import.meta.dirname` は問題なく使用可能。

**進捗出力パターン** (`src/index.ts` lines 59, 70, 75, 88):
```typescript
console.log("Step 1/7: 市場データを取得中...");
// 完了時:
console.log("  -> 市場データ取得完了");
console.log(`  -> ポートフォリオ: ${portfolioStocks.length}銘柄取得完了`);
```
D-09 に従い新スクリプトでは「ステップ番号なし、1行メッセージ」形式を採用:
```typescript
console.log("市場データ収集中...");
console.log(`市場データ収集完了 (指数: ${marketData.indices.length}件, セクター: ${marketData.sectors.length}件)`);
```

**並列データ取得パターン** (`src/index.ts` lines 60-64):
```typescript
const [marketData, news, portfolioStocks] = await Promise.all([
  fetchAllMarketData(),
  fetchMarketNews(),
  fetchPortfolioData(PORTFOLIO_HOLDINGS),
]);
```
新スクリプトでは market を必須・others を任意に分けるため、`Promise.all` は market のみ単独で先行し、news/portfolio は個別 try-catch で実行する（D-08）。

**グレースフルデグラデーションパターン** (`src/data/market.ts` lines 55-65、`src/data/portfolio/data.ts` lines 22-47):

`market.ts` の `fetchQuoteSafe`:
```typescript
async function fetchQuoteSafe(symbol: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await yahooFinance.quote(symbol);
    return result as unknown as Record<string, unknown>;
  } catch (error) {
    console.error(`Failed to fetch quote for ${symbol}:`, error);
    return null;
  }
}
```

`portfolio/data.ts` の `fetchStockSafe` (lines 22-47):
```typescript
async function fetchStockSafe(holding: PortfolioHolding): Promise<StockData | null> {
  try {
    const quote = await yahooFinance.quote(holding.symbol);
    return { /* ... immutable fields ... */ };
  } catch (error) {
    console.error(`Failed to fetch data for ${holding.symbol}:`, error);
    return null;
  }
}
```

`src/index.ts` lines 102-118 のポートフォリオ失敗継続パターン:
```typescript
try {
  const portfolioReport = await runPortfolioMeeting({ ... });
  // ...
} catch (error) {
  console.error("Portfolio report generation failed:", error);
  console.log("  -> ポートフォリオレポートの生成に失敗しましたが、デイリーレポートは保存済みです");
}
```
新スクリプトでは news/portfolio ブロックに同パターン。失敗時は空配列の JSON ファイルを書き込んでスキルへ制御を返す（D-08）。

**ファイル書き込みパターン** (Node.js fs/promises — `src/index.ts` line 2, 77):
```typescript
import { mkdir } from "node:fs/promises";
// ...
await mkdir(dateDir, { recursive: true });
```
新スクリプトで追加する `writeFile`:
```typescript
import { writeFile, mkdir } from "node:fs/promises";
// ...
await mkdir(TMP_DIR, { recursive: true });
await writeFile(join(TMP_DIR, "market.json"), JSON.stringify(data, null, 2), "utf-8");
```

**イミュータブルデータ構造パターン** (`src/data/market.ts` lines 5-30、`src/portfolio/data.ts` lines 6-20):
```typescript
export interface MarketIndex {
  readonly name: string;
  readonly symbol: string;
  readonly price: number;
  readonly change: number;
  readonly changePercent: number;
}
// fetchAllMarketData の戻り値:
return { indices, sectors } as const;
```

**エントリポイントパターン** (`src/index.ts` lines 125-128):
```typescript
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```
新スクリプトでも同一パターンを踏襲する。

---

### `.claude/commands/invest.md` (skill, request-response)

**アナログ:** `~/.claude/skills/gsd-fast/SKILL.md`

**フロントマターパターン** (`~/.claude/skills/gsd-fast/SKILL.md` lines 1-12):
```markdown
---
name: gsd-fast
description: "Execute a trivial task inline — no subagents, no planning overhead"
argument-hint: "[task description]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---
```
`/invest` コマンドでは `argument-hint` は不要（D-07: 引数なし）。`allowed-tools` には `Bash` と `Agent` を含める（データ収集スクリプト実行 + アナリストスポーン）。

**注意:** `.claude/commands/` ディレクトリはプロジェクトルートに新規作成が必要（現在は存在しない）。グローバルスキル（`~/.claude/skills/`）とは場所が異なる（RESEARCH.md PITFALL-4）。

---

## Shared Patterns

### `new YahooFinance()` インスタンス化
**ソース:** `src/data/market.ts` lines 1-3、`src/portfolio/data.ts` lines 1-4
**適用先:** `src/scripts/collect-data.ts`（直接は `market.ts`/`data.ts` 経由で使うため新スクリプトでの直接使用は不要）
```typescript
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
```

### `ReadonlyArray` + `filter(r => r !== null)` パターン
**ソース:** `src/data/market.ts` lines 79-81、`src/portfolio/data.ts` lines 51-53
**適用先:** 全データ取得関数の戻り値型
```typescript
const results = await Promise.all(holdings.map(fetchStockSafe));
return results.filter((r): r is StockData => r !== null);
```

### `Promise.all` + 個別 `.catch()` パターン
**ソース:** `src/data/news/finnhub.ts` lines 58-67
```typescript
const [general, merger] = await Promise.all([
  fetchNewsByCategory(apiKey, "general").catch((error) => {
    console.error("Failed to fetch Finnhub general news:", error);
    return [] as ReadonlyArray<RawNewsArticle>;
  }),
  fetchNewsByCategory(apiKey, "merger").catch((error) => {
    console.error("Failed to fetch Finnhub merger news:", error);
    return [] as ReadonlyArray<RawNewsArticle>;
  }),
]);
```
**適用先:** news 収集の並列取得部分。外側の try-catch と組み合わせて使う。

### `dotenv/config` インポートパターン
**ソース:** `src/index.ts` line 1
**適用先:** `src/scripts/collect-data.ts`（`FINNHUB_API_KEY` 環境変数読み込みのため）
```typescript
import "dotenv/config";
```

---

## アナログが存在しないファイル

なし — 両ファイルとも十分な既存アナログが存在する。

---

## JSON 出力スキーマ（型の参照先）

| ファイル | 型定義の参照元 |
|---------|------------|
| `tmp/market.json` | `src/data/market.ts`: `MarketIndex`, `SectorPerformance` インターフェース |
| `tmp/news.json` | `src/data/news/types.ts`: `RawNewsArticle` インターフェース（`publishedAt: Date` は JSON.stringify で ISO 文字列化される — PITFALL-2） |
| `tmp/portfolio.json` | `src/portfolio/data.ts`: `StockData` インターフェース |

---

## Metadata

**アナログ検索スコープ:** `/Users/arai/invest/src/`, `/Users/arai/.claude/skills/`
**スキャンファイル数:** 9
**パターン抽出日:** 2026-06-24
