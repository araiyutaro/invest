# コーディング規約

**分析日:** 2026-04-08

## 命名パターン

**ファイル:**
- ファイル名はkebab-case: `fundamentals.ts`, `risk-manager.ts`, `market-overview.ts`
- バレルエクスポートには `index.ts` を使用
- ユーティリティファイルは機能名: `analyzer.ts`, `generator.ts`, `runner.ts`

**関数:**
- 関数名はcamelCase: `fetchMarketIndices()`, `generateChartImage()`, `formatMarketDataSummary()`
- ヘルパー関数は目的をプレフィックス: `fetchQuoteSafe()`, `buildMarketContext()`, `formatArticlesForPrompt()`
- 非同期関数はPromise型を明示的に返却

**変数:**
- 定数・変数はcamelCase: `yahooFinance`, `REPORTS_DIR`, `analysisAgents`
- 定数はALL_CAPS_WITH_UNDERSCORES: `MAJOR_INDICES`, `SECTOR_ETFS`, `PORTFOLIO_HOLDINGS`, `SYSTEM_PROMPT`
- const配列は一貫して `ReadonlyArray` 型アノテーションを使用

**型:**
- インターフェース・型はPascalCase: `AgentProfile`, `MarketNews`, `MeetingRecord`, `StockQuote`
- インターフェースプロパティは `readonly` キーワード使用: `readonly id: string`, `readonly marketCap: number | null`
- オプショナル値のユニオン型は `| undefined` ではなく `| null` を使用

## コードスタイル

**フォーマット:**
- リポジトリに明示的なリンター/フォーマッター設定なし
- 全体を通じて一貫した2スペースインデント
- 行は通常80-100文字、ハードリミットなし
- 論理セクション間に空行1行

**インポート:**
- Node.jsネイティブインポートが先: `import { mkdir } from "node:fs/promises"`
- サードパーティインポートが次: `import YahooFinance from "yahoo-finance2"`
- ローカルインポートが最後、ESモジュールでは `.js` 拡張子使用: `import { fundamentalsAgent } from "./fundamentals.js"`
- 型インポートは分離: `import type { MarketNews } from "../data/news.js"`

## エラーハンドリング

**パターン:**
- 初期化時のエラーthrow: `if (!apiKey) { throw new Error("...") }`
- 外部API呼び出しにtry-catchとconsole.errorログ
- グレースフルデグラデーション用のnull返却パターン: `Promise<string | null>` で失敗時にnullを返却
- null結果を除去し型安全性を維持する `Promise.all().filter()` パターン

`src/data/market.ts` の例:
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

// 呼び出し元が型ガードでnullをフィルタ
return results.filter((r): r is MarketIndex => r !== null);
```

**非同期エラーハンドリング:**
- main内の致命的エラー: `main().catch((error) => { console.error("Fatal error:", error); process.exit(1); })`
- サブプロセス内の非致命的エラー: ログ出力後に実行続行（例: `src/index.ts` 114-117行のポートフォリオレポート生成）

## ログ

**フレームワーク:** consoleメソッド（console.log, console.error）

**パターン:**
- メインフロー内の進捗表示: `console.log("Step 1/7: 市場データを取得中...")`
- 矢印による進捗表示: `console.log("  -> 市場データ取得完了")`
- コンテキスト付きエラーログ: `console.error(\`Failed to fetch quote for ${symbol}:\`, error)`
- 非重要操作のサイレント失敗（例: チャート生成がthrowせずnullを返却）

集中ロガーなし - 全体を通じて直接的なconsole使用。

## コメント

**コメントするタイミング:**
- システムプロンプトはセクションヘッダー付きの長い文字列として文書化
- 複雑なプロンプト構築はインラインで文書化
- API連携メモ（例: `src/data/market.ts` の yahoo-finance2 "suppressNotices"）
- セクションコメントは文字列内でMarkdownヘッダー使用: `## 本日の市場データ`

**JSDoc/TSDoc:**
- このコードベースでは未使用
- 関数の目的は名前と使用方法から推測

## 関数設計

**サイズ:** 通常20-60行、最長関数は `markdownToHtml()` の53行

**パラメータ:**
- 複雑なデータにはreadonlyプロパティを持つ単一オブジェクトパラメータを優先
- コレクションパラメータには `ReadonlyArray<T>` を使用
- ミュータブルな入力を避ける - 必要に応じて配列をspread/コピー

`src/index.ts` の例:
```typescript
function formatMarketDataSummary(
  indices: ReadonlyArray<MarketIndex>,
  sectors: ReadonlyArray<SectorPerformance>,
): string {
  // ... [...sectors].sort() で新しい配列を作成、入力を変更しない
}
```

**戻り値:**
- グレースフルに失敗する可能性のある操作には `Promise<T | null>`
- クリティカルパスにはエラーthrow付きの `Promise<T>`
- Const/readonly戻り値型: `return { indices, sectors } as const;`

## イミュータビリティ

**重要パターン - 常に使用:**
- 配列/オブジェクトのspreadとコピー: `[...sectors].sort()`, `{ ...user, name }`
- 全インターフェースにreadonlyプロパティ
- `ReadonlyArray<T>` 型アノテーションで意図しない変更を防止

関数パラメータや外部状態を決して変更しない。

## モジュール設計

**エクスポート:**
- バレルファイルが型付きAPIを再エクスポート: `src/agents/index.ts` が値と型の両方をエクスポート
- 型は `export type { ... }` で個別エクスポート
- 名前付き値エクスポート: `export const PORTFOLIO_HOLDINGS = [...]`

`src/agents/index.ts` の例:
```typescript
export { fundamentalsAgent } from "./fundamentals.js";
export type {
  AgentProfile,
  AgentAnalysis,
  MeetingRecord,
} from "./types.js";
```

**ファイル構成:**
- 共有インターフェース用の専用型ファイル: `types.ts`
- データファイルが取得と変換を処理
- ジェネレーターファイルが出力（HTML、レポート）を処理
- ランナーファイルがワークフローをオーケストレーション

## 固有パターン

**定数用のReadonlyレコード:**
```typescript
const MAJOR_INDICES = [
  { name: "S&P 500", symbol: "^GSPC" },
  { ... }
] as const;
```

**型ガード付きフィルタ:**
```typescript
return results.filter((r): r is MarketIndex => r !== null);
```

**安全な外部API呼び出し:**
```typescript
async function fetchQuoteSafe(symbol: string): Promise<...> {
  try {
    const result = await yahooFinance.quote(symbol);
    return /* 変換 */;
  } catch (error) {
    console.error(`Failed to fetch...`, error);
    return null;
  }
}
```

**並列操作用のPromise.all:**
```typescript
const [result1, result2, result3] = await Promise.all([
  operation1(),
  operation2(),
  operation3(),
]);
```

---

*規約分析: 2026-04-08*
