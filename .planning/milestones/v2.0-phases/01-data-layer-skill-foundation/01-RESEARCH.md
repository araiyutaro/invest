# Phase 1: Data Layer + Skill Foundation - Research

**Researched:** 2026-06-24
**Domain:** TypeScript データパイプライン再構成 + Claude Code スキルコマンド登録
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** データ種別ごとに3ファイルに分割: `tmp/market.json`, `tmp/news.json`, `tmp/portfolio.json`
- **D-02:** データスコーピング（DATA-02）はスキル側で制御。各アナリストAgentをスポーンする際に必要なJSONファイルを指定して読ませる。TS側はアナリストの役割を知らない
- **D-03:** ニュースは生記事データ（タイトル、ソース、日付）をそのままnews.jsonに出力。分析・要約はClaude側のアナリストが実施する。Geminiによる事前分析（generateAllAnalyses）は呼ばない
- **D-04:** tmp/ファイルは毎回上書き。明示的なクリーンアップ処理や日付別保存は不要
- **D-05:** 既存のsrc/index.tsをリファクタしてデータ収集部分を再構成する（新規ラッパースクリプトではなく既存コードの再構成）
- **D-06:** Gemini依存コード（charts.ts画像生成、ニュース分析generateAllAnalyses）は新パイプラインから呼ばない。既存ファイルはそのまま残し、Phase 4で削除
- **D-07:** `/invest` は引数なしでフルパイプラインを実行。オプションや個別銘柄指定は将来の拡張に回す
- **D-08:** エラー時はグレースフルデグラデーション（部分成功で続行）。市場データ（指数・セクター）は必須、ニュース・ポートフォリオは失敗しても分析を継続する
- **D-09:** 主要ステップごとに1行の進捗メッセージを表示（例: 「市場データ収集中...」「データ収集完了」「アナリスト分析開始...」）
- **D-10:** データ収集完了後に簡潔なサマリーを表示（指数変動率、ニュース件数、ポートフォリオ銘柄数）

### Claude's Discretion

- データ収集TSスクリプトの実行方法（Bash tsx直接 vs npm script経由）
- 既存src/index.tsの扱い（v1.0エントリとして残す vs リファクタして再利用）
- スキルのオーケストレーション方式（単一SKILL.md内制御 vs サブスキル分割）
- アナリスト分析結果のJSON出力先ディレクトリ構造

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | 既存の市場データ・ニュース・ポートフォリオ取得がJSON形式で中間ファイルに出力される | `fetchAllMarketData()`, `fetchPortfolioData()`, `fetchAllFinnhubNews()` + RSS関数の直接再利用。`fs/promises`の`writeFile`でtmp/に出力 |
| DATA-02 | 各アナリストに必要なデータのみが絞り込まれて渡される（トークンコスト最適化） | スキル（SKILL.md）側でアナリスト別に読み込むJSONファイルを制御。TSは全データを出力するのみ |
| SKILL-01 | ユーザーが `/invest` コマンドでデータ収集から分析・レポート生成までの全パイプラインを実行できる | `.claude/commands/invest.md` または `src/scripts/collect-data.ts` + スキルMDの組み合わせ |
| SKILL-02 | パイプラインがデータ収集→並行分析→レポート生成の順序で制御される | スキルMD内でBashツールでTSスクリプト実行後にAgentスポーン。順序はawait/sequential記述で保証 |
| SKILL-03 | 各ステップの実行進捗がユーザーに表示される | コンソール出力（既存パターン踏襲）+ スキルMD内のステップ記述でユーザー可視化 |
</phase_requirements>

---

## Summary

Phase 1は既存TypeScriptコードの「データ収集機能」を分離・再構成し、3つのJSONファイル（`tmp/market.json`、`tmp/news.json`、`tmp/portfolio.json`）に出力するスクリプトを作成する。同時に、このスクリプトをClaude Codeスキルとして `/invest` コマンドから呼び出せる骨格パイプラインを構築する。

既存コードは高品質で再利用可能な状態にある。`fetchAllMarketData()`・`fetchPortfolioData()`・Finnhub/RSS/Google Newsの各fetch関数は、Gemini依存部分（`generateAllAnalyses()`・`generateSectorChart()`）を切り離せば、そのまま再利用できる。主な作業は「既存コードのリファクタ」と「スキルMDの新規作成」に集約される。

**Primary recommendation:** `src/scripts/collect-data.ts` を新規作成して既存fetch関数を集約し、`tmp/` ディレクトリへのJSON出力を担当させる。スキルは `.claude/commands/invest.md` として登録し、BashツールでTSスクリプト実行後にアナリストAgentスポーンの骨格を記述する。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 市場データ取得（指数・セクターETF） | TypeScript/Node.js スクリプト | — | Yahoo Finance API呼び出しはTS層が担当（D-05, D-06） |
| ニュース収集（Finnhub/Google/RSS） | TypeScript/Node.js スクリプト | — | 既存fetch関数を再利用。Gemini分析は除外（D-03） |
| ポートフォリオデータ取得 | TypeScript/Node.js スクリプト | — | `fetchPortfolioData()` をそのまま再利用 |
| tmp/ JSONファイル出力 | TypeScript/Node.js スクリプト | — | TSとClaude間のハンドオフ境界 |
| パイプライン制御・進捗表示 | Claude Code スキル（SKILL.md） | — | スキルがBashでTSスクリプト呼び出し、完了後にAgentスポーン |
| データスコーピング（アナリスト別フィルタ） | Claude Code スキル（SKILL.md） | — | アナリスト別に必要なJSONファイルのみをAgentに渡す（D-02） |
| サブエージェントスポーン（骨格のみ） | Claude Code スキル（SKILL.md） | — | Phase 2で本実装。Phase 1ではスタブとして空のAgentスポーンを示す |

---

## Standard Stack

### Core（既存、バージョン確認済み）[VERIFIED: local node_modules]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | 型安全なスクリプト実装 | 既存プロジェクトのコア言語 |
| tsx | 4.21.0 | `.ts`ファイルをビルドなしで実行 | `npx tsx src/scripts/collect-data.ts` で直接実行可能 |
| yahoo-finance2 | 3.13.2 | 市場データ・株価取得 | `new YahooFinance()` でインスタンス化必須 |
| fast-xml-parser | 5.5.6 | RSSフィードXML解析 | 既存Google News/RSSソースで使用中 |
| dotenv | 17.3.1 | `.env`からAPIキー読み込み | `FINNHUB_API_KEY` 等の環境変数管理 |
| zod | 4.3.6 | JSONスキーマバリデーション | 既存dependencyだが未使用。tmp/ JSON出力のバリデーションに活用可能 |
| Node.js | 24.3.0 | ランタイム | `fs/promises`の`writeFile`でtmp/書き込み |

### Supporting（Claude Code スキル）[ASSUMED]

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `.claude/commands/invest.md` | — | `/invest` コマンド登録 | Claude Codeがプロジェクトルートの`.claude/commands/`を検索 |

**Installation:** 新規パッケージ不要。既存依存関係のみで完結。

---

## Package Legitimacy Audit

> 新規パッケージインストールなし — Phase 1は既存dependencyのみ使用。

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| yahoo-finance2 | npm | 5+ yrs | 高 | github.com/gadicc/node-yahoo-finance2 | N/A (既存) | 既インストール済み |
| fast-xml-parser | npm | 7+ yrs | 高 | github.com/NaturalIntelligence/fast-xml-parser | N/A (既存) | 既インストール済み |
| zod | npm | 5+ yrs | 非常に高 | github.com/colinhacks/zod | N/A (既存) | 既インストール済み |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
ユーザー
  |
  | /invest コマンド
  v
.claude/commands/invest.md (スキル)
  |
  | Step 1: Bash tool
  | npx tsx src/scripts/collect-data.ts
  v
src/scripts/collect-data.ts (新規)
  |
  |-- fetchAllMarketData() ──> tmp/market.json
  |-- fetchRawNews()      ──> tmp/news.json      (Gemini分析なし)
  |-- fetchPortfolioData()──> tmp/portfolio.json
  |
  | (並列実行: Promise.all)
  | (グレースフルデグラデーション: market必須, news/portfolio任意)
  |
  | コンソール進捗表示 + データサマリー表示
  v
スキルに制御返却（exit 0）
  |
  | Step 2: Agent スポーン（骨格 / Phase 2で本実装）
  | - ファンダメンタルズアナリスト → tmp/market.json + tmp/portfolio.json 参照
  | - テンバガーハンター          → tmp/market.json + tmp/portfolio.json 参照
  | - マクロエコノミスト          → tmp/market.json + tmp/news.json 参照
  | - テクニカルストラテジスト    → tmp/market.json + tmp/portfolio.json 参照
  | - リスクマネージャー          → tmp/market.json + tmp/news.json + tmp/portfolio.json 参照
  v
ユーザーに進捗表示（「分析開始...」等）
```

### Recommended Project Structure

```
/Users/arai/invest/
├── src/
│   ├── index.ts              # 既存v1.0エントリ（変更なし）
│   ├── scripts/
│   │   └── collect-data.ts   # 新規: データ収集スクリプト
│   ├── data/
│   │   ├── market.ts         # 既存（変更なし）
│   │   ├── news.ts           # 既存（変更なし、呼ばれなくなる）
│   │   ├── news/
│   │   │   ├── types.ts      # 既存（変更なし）
│   │   │   ├── finnhub.ts    # 既存（変更なし）
│   │   │   ├── google-news.ts # 既存（変更なし）
│   │   │   ├── rss-sources.ts # 既存（変更なし）
│   │   │   └── analyzer.ts   # 既存（Phase 1では呼ばれない）
│   │   └── charts.ts         # 既存（Phase 1では呼ばれない）
│   ├── portfolio/
│   │   ├── holdings.ts       # 既存（変更なし）
│   │   └── data.ts           # 既存（変更なし）
│   └── agents/               # 既存（Phase 2で利用）
├── tmp/                      # 新規ディレクトリ
│   ├── market.json           # 指数・セクターデータ
│   ├── news.json             # 生ニュース記事
│   └── portfolio.json        # ポートフォリオ銘柄データ
└── .claude/
    └── commands/
        └── invest.md         # /invest スキル登録（新規）
```

### Pattern 1: データ収集スクリプト（collect-data.ts）

**What:** 既存fetch関数を集約し、3つのJSONファイルへ出力する新規スクリプト
**When to use:** スキルがBashツールで直接実行する

```typescript
// Source: 既存 src/index.ts のデータ収集部分を抽出・再構成
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fetchAllMarketData } from "../data/market.js";
import { fetchAllFinnhubNews } from "../data/news/finnhub.js";
import { fetchGoogleNewsJapan } from "../data/news/google-news.js";
import { fetchAllRssNews } from "../data/news/rss-sources.js";
import { PORTFOLIO_HOLDINGS } from "../portfolio/holdings.js";
import { fetchPortfolioData } from "../portfolio/data.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");

async function main() {
  console.log("データ収集開始...");

  // tmp/ ディレクトリを作成（冪等）
  await mkdir(TMP_DIR, { recursive: true });

  // 必須: 市場データ（失敗時はスロー）
  console.log("市場データ収集中...");
  const marketData = await fetchAllMarketData();
  await writeFile(
    join(TMP_DIR, "market.json"),
    JSON.stringify(marketData, null, 2),
    "utf-8",
  );
  console.log(`市場データ収集完了 (指数: ${marketData.indices.length}件, セクター: ${marketData.sectors.length}件)`);

  // 任意: ニュース（失敗しても続行）
  try {
    console.log("ニュース収集中...");
    const [finnhubNews, googleNews, rssNews] = await Promise.all([
      fetchAllFinnhubNews(),
      fetchGoogleNewsJapan(),
      fetchAllRssNews(),
    ]);
    const allArticles = [
      ...finnhubNews.general,
      ...finnhubNews.merger,
      ...googleNews,
      ...rssNews,
    ];
    await writeFile(
      join(TMP_DIR, "news.json"),
      JSON.stringify(allArticles, null, 2),
      "utf-8",
    );
    console.log(`ニュース収集完了 (${allArticles.length}件)`);
  } catch (error) {
    console.error("ニュース収集失敗（続行）:", error);
    await writeFile(join(TMP_DIR, "news.json"), "[]", "utf-8");
  }

  // 任意: ポートフォリオ（失敗しても続行）
  try {
    console.log("ポートフォリオデータ収集中...");
    const portfolioStocks = await fetchPortfolioData(PORTFOLIO_HOLDINGS);
    await writeFile(
      join(TMP_DIR, "portfolio.json"),
      JSON.stringify(portfolioStocks, null, 2),
      "utf-8",
    );
    console.log(`ポートフォリオデータ収集完了 (${portfolioStocks.length}銘柄)`);
  } catch (error) {
    console.error("ポートフォリオ収集失敗（続行）:", error);
    await writeFile(join(TMP_DIR, "portfolio.json"), "[]", "utf-8");
  }

  console.log("データ収集完了");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

### Pattern 2: `/invest` スキル（.claude/commands/invest.md）[ASSUMED]

**What:** Claude Codeプロジェクトレベルのスラッシュコマンド
**When to use:** ユーザーが `/invest` を実行したとき

```markdown
---
description: 投資分析パイプラインを実行。データ収集→5アナリスト並列分析→モデレーター統合→レポート生成
---

# /invest 投資分析パイプライン

## Step 1: データ収集

市場データ・ニュース・ポートフォリオデータを収集し、tmp/ に保存します。

[Bashツールで実行]: npx tsx src/scripts/collect-data.ts

## Step 2: アナリスト並列分析（Phase 2で実装）

データ収集が完了したことを確認後、5名のアナリストを並列スポーン...
```

**注意:** Claude Codeのプロジェクトレベルコマンドは `.claude/commands/` ディレクトリのMarkdownファイルとして登録する。[ASSUMED: 正確なフロントマタースキーマは公式ドキュメントを確認]

### Pattern 3: tmp/ JSONスキーマ

**market.json の構造:**
```typescript
// Source: src/data/market.ts の既存型定義に準拠
{
  indices: Array<{
    name: string;         // "S&P 500", "NASDAQ" 等
    symbol: string;       // "^GSPC" 等
    price: number;
    change: number;
    changePercent: number;
  }>,
  sectors: Array<{
    sector: string;       // "Technology" 等
    symbol: string;       // "XLK" 等
    changePercent: number;
  }>
}
```

**news.json の構造（生記事データ）:**
```typescript
// Source: src/data/news/types.ts の RawNewsArticle に準拠
Array<{
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;  // ISO 8601 (Date → JSON.stringify で自動変換)
  category: string;     // "general", "merger", "japan_market" 等
}>
```

**portfolio.json の構造:**
```typescript
// Source: src/portfolio/data.ts の StockData に準拠
Array<{
  symbol: string;       // "MRNA", "8522.T" 等
  name: string;
  nameJa: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number | null;
  peRatio: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  averageVolume: number | null;
}>
```

### Anti-Patterns to Avoid

- **Gemini依存コードの呼び出し:** `generateAllAnalyses()` と `generateSectorChart()` は呼ばない（D-06）
- **既存src/index.tsの変更:** 新スクリプトを別ファイルとして作成（D-05）
- **news.tsのfetchMarketNews()再利用:** この関数はGemini分析を内包するため使わず、個別のfetch関数を直接呼ぶ（D-03）
- **アナリスト別データフィルタをTS側に実装:** データスコーピングはスキル側が担う（D-02）

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONファイル書き込み | カスタムファイルマネージャー | `fs/promises.writeFile` | Node.js標準ライブラリで十分 |
| ニュース重複排除 | カスタムロジック | 既存`rss-sources.ts`の実装を参照 | 既に実装済み |
| 株価APIクライアント | 直接fetchラッパー | `yahoo-finance2` (v3) | `new YahooFinance()` でインスタンス化 |
| XMLパーサー | 自作XML解析 | `fast-xml-parser` | 既存依存関係 |

---

## Runtime State Inventory

> SKIPPED — グリーンフィールドの新スクリプト追加であり、リネーム/リファクタフェーズではない。

---

## Common Pitfalls

### Pitfall 1: news.tsのfetchMarketNews()を再利用してしまう

**What goes wrong:** `src/data/news.ts` の `fetchMarketNews()` は内部で `generateAllAnalyses()` を呼び、Gemini APIを使用する。これを呼ぶとGemini APIキーが必要になりPhase 4の削除作業と干渉する
**Why it happens:** `fetchMarketNews()` が便利に見えるから
**How to avoid:** 個別の fetch 関数（`fetchAllFinnhubNews()`、`fetchGoogleNewsJapan()`、`fetchAllRssNews()`）を直接 `collect-data.ts` からインポートする

### Pitfall 2: `publishedAt` のDate型がJSON.stringifyでシリアライズできない問題

**What goes wrong:** `RawNewsArticle.publishedAt` は `Date` 型だが、`JSON.stringify` するとISOString文字列になる。パース後は `Date` オブジェクトではなく文字列として扱う必要がある
**Why it happens:** TypeScript型定義とJSONシリアライゼーションのギャップ
**How to avoid:** news.jsonを読み込む際は `publishedAt` を `string` 型として扱う。またはJSON出力前に `toISOString()` で明示的に文字列化

### Pitfall 3: `import.meta.dirname` がNode.js + ESMで使えるか

**What goes wrong:** tsconfig.jsonのターゲットがES2022でESMモジュール。`import.meta.dirname` はNode.js 20.11+ から利用可能
**Why it happens:** 古いコードでは `__dirname` を使う慣習があるため混在しがち
**How to avoid:** 既存 `src/index.ts` が `import.meta.dirname` を使っているため（`const REPORTS_DIR = join(import.meta.dirname, "../docs")`）、同じパターンを踏襲する。Node.js 24.3.0なので問題なし

### Pitfall 4: Claude Codeスキルのコマンド登録場所

**What goes wrong:** スキルを `.claude/skills/` に置いても、プロジェクトスコープの `/invest` コマンドとして認識されない
**Why it happens:** `.claude/skills/` はグローバルスキルライブラリ（`@$HOME/.claude/skills/`）の場所。プロジェクトレベルのスラッシュコマンドは `.claude/commands/` に配置する
**How to avoid:** プロジェクトルートに `.claude/commands/invest.md` を作成する [ASSUMED: 動作確認が必要]

### Pitfall 5: tmp/ ディレクトリが存在しない

**What goes wrong:** `writeFile` は親ディレクトリが存在しないとエラーになる
**Why it happens:** `tmp/` は新規ディレクトリでgitignoreに含める予定
**How to avoid:** `collect-data.ts` の冒頭で `await mkdir(TMP_DIR, { recursive: true })` を実行する

### Pitfall 6: yahoo-finance2 v3のインスタンス化

**What goes wrong:** `import yahooFinance from "yahoo-finance2"` でデフォルトインポートすると動作しない
**Why it happens:** v3でAPIが変更された
**How to avoid:** `import YahooFinance from "yahoo-finance2"; const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });` のパターンを踏襲（既存コードと同じ）

---

## Code Examples

### ファイル書き込みパターン（node:fs/promises）

```typescript
// Source: Node.js 24 標準ライブラリ [VERIFIED: local runtime]
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
await mkdir(TMP_DIR, { recursive: true });
await writeFile(join(TMP_DIR, "market.json"), JSON.stringify(data, null, 2), "utf-8");
```

### Promise.all による並列データ取得パターン

```typescript
// Source: 既存 src/index.ts:60-64 のパターン踏襲
const [marketData, portfolioStocks] = await Promise.all([
  fetchAllMarketData(),
  fetchPortfolioData(PORTFOLIO_HOLDINGS),
]);
```

### グレースフルデグラデーションパターン

```typescript
// Source: 既存 src/data/market.ts:55-65 の fetchQuoteSafe パターン踏襲
try {
  const portfolioStocks = await fetchPortfolioData(PORTFOLIO_HOLDINGS);
  await writeFile(join(TMP_DIR, "portfolio.json"), JSON.stringify(portfolioStocks, null, 2), "utf-8");
} catch (error) {
  console.error("ポートフォリオ収集失敗（続行）:", error);
  await writeFile(join(TMP_DIR, "portfolio.json"), "[]", "utf-8");
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Gemini APIでニュース分析 | 生記事JSONをClaude Agentに渡す | Phase 1（今回） | GEMINI_API_KEY依存が段階的に解消 |
| src/index.tsが全処理 | collect-data.ts（データ収集専用）+ スキル（オーケストレーション） | Phase 1（今回） | 関心の分離、テスト容易性向上 |
| npm startで起動 | /invest スキルコマンドで起動 | Phase 1（今回） | Claude Codeセッション中に随時実行可能 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.claude/commands/invest.md` がプロジェクトレベルの `/invest` コマンドとして機能する | Architecture Patterns / Pattern 2 | 別の登録方法が必要な場合、スキル実装の設計変更が必要 |
| A2 | Claude Codeスキル内でBashツールを使い `npx tsx src/scripts/collect-data.ts` を実行できる | Architecture Patterns | 権限設定等で制限される場合は代替実行方法が必要 |
| A3 | Phase 1スキルはサブエージェントスポーンの「骨格のみ」（スタブ）で構わない | Phase Requirements / SKILL-01 | ユーザーが実際の分析動作を期待していた場合、スコープ再確認が必要 |

---

## Open Questions

1. **スキルコマンドの正確なフロントマター仕様**
   - What we know: `.claude/commands/` ディレクトリのMarkdownファイルがスラッシュコマンドとして登録される
   - What's unclear: `description`フィールド以外のフロントマタースキーマ（`argument-hint`, `allowed-tools`等）がプロジェクトレベルのコマンドでも使えるか
   - Recommendation: 既存GSDスキル（`.claude/skills/gsd-add-tests/SKILL.md`）と同じフォーマットを試用し、動作確認する

2. **Phase 1のスキルにおけるサブエージェントスポーンの粒度**
   - What we know: Phase 1のゴールは「骨格パイプライン」で、Phase 2でアナリストを本実装する
   - What's unclear: Phase 1のスキルにダミーのAgentスポーンを含めるか、それとも「データ収集完了」で止めるか
   - Recommendation: スキルMDにAgentスポーンのコメントアウトまたはプレースホルダーを記述し、実際のスポーンはPhase 2で有効化する

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | collect-data.ts実行 | ✓ | v24.3.0 | — |
| tsx | TypeScriptファイル直接実行 | ✓ | v4.21.0 | `node_modules/.bin/tsx`経由 |
| yahoo-finance2 | 市場データ取得 | ✓ | v3.13.2 | — |
| fast-xml-parser | RSS解析 | ✓ | v5.5.6 | — |
| FINNHUB_API_KEY | Finnhubニュース | 確認不可（実行時依存） | — | 未設定時は空配列返却（既存実装） |
| dotenv | .env読み込み | ✓ | v17.3.1 | — |

**Missing dependencies with no fallback:** なし

**Missing dependencies with fallback:**
- FINNHUB_API_KEY: 未設定でもニュース収集スキップで続行（`fetchAllFinnhubNews()`が空配列返却）

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | なし（デフォルト設定） |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | `collect-data.ts` が3つのJSONファイルを `tmp/` に出力する | unit | `npm run test -- src/scripts/collect-data.test.ts` | ❌ Wave 0 |
| DATA-01 | 市場データJSONが正しい構造（indices/sectors）を持つ | unit | 同上 | ❌ Wave 0 |
| DATA-01 | ニュースJSONが`RawNewsArticle[]`スキーマに準拠する | unit | 同上 | ❌ Wave 0 |
| DATA-02 | スキルがアナリスト別に必要なJSONファイルのみを参照する | manual | — | N/A（スキルMDは動的テスト困難） |
| SKILL-01 | `/invest` コマンドがClaude Codeで認識される | manual | — | N/A |
| SKILL-02 | データ収集完了後にAgent骨格がスポーンされる | manual | — | N/A |
| SKILL-03 | 各ステップの進捗メッセージが表示される | unit（コンソール出力確認） | `npm run test -- src/scripts/collect-data.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/scripts/collect-data.test.ts` — DATA-01（JSON出力検証）、SKILL-03（進捗表示検証）
- [ ] `tmp/` ディレクトリのgitignore設定

*(既存テストインフラ（Vitest）は存在するが、プロジェクト固有のテストファイルは一つも存在しない)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes（限定的） | APIレスポンスのnullish coalescingで防御（既存パターン） |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| APIキーの.envへの露出 | Information Disclosure | `.gitignore`に`.env`を含める（既存設定） |
| tmp/JSONへの機密データ混入 | Information Disclosure | ポートフォリオデータ（保有銘柄・価格）はローカル限定、gitignoreする |

---

## Sources

### Primary (HIGH confidence)

- 既存ソースコード（`src/index.ts`, `src/data/market.ts`, `src/data/news/`, `src/portfolio/data.ts`） — 直接コード読解による確認
- Node.js 24.3.0 標準ライブラリ（`fs/promises`, `path`） — ランタイム確認済み
- `.planning/phases/01-data-layer-skill-foundation/01-CONTEXT.md` — ユーザー決定事項の一次情報源

### Secondary (MEDIUM confidence)

- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STACK.md` — プロジェクト分析ドキュメント（2026-04-08時点）
- package.json + node_modules バージョン確認 — ローカル環境で検証済み

### Tertiary (LOW confidence)

- Claude Codeスキルコマンド登録仕様（`.claude/commands/`） — GSDスキル例から推定。公式ドキュメントは未確認

---

## Metadata

**Confidence breakdown:**

- Standard Stack: HIGH — 既存node_modulesで直接確認
- Architecture: HIGH — 既存コードの直接読解に基づく
- Pitfalls: HIGH — コードパターンとユーザー決定事項から導出
- Claude Codeスキル登録: MEDIUM — GSDスキル例から推定（A1参照）

**Research date:** 2026-06-24
**Valid until:** 2026-07-24（依存関係が安定しているため30日有効）
