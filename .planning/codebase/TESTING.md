# テストパターン

**分析日:** 2026-04-08

## テストフレームワーク

**ランナー:**
- Vitest 4.0.18
- 設定: 未作成 - Vitestデフォルトを使用
- カスタム設定ファイルなし

**アサーションライブラリ:**
- 検出なし - Vitest組み込みアサーションを使用予定

**実行コマンド:**
```bash
npm test                # 全テスト実行（vitest run）
npm run test:watch     # ウォッチモード
```

## テストファイル構成

**現状:**
- `src/` 内にテストファイルなし
- ユニットテスト、統合テスト、E2Eテストいずれも未実装
- devDependencyはVitestのみ（他のテストユーティリティなし）

**推奨配置パターン:**
- テストを実装と同じ場所に配置: `src/agents/fundamentals.test.ts` を `src/agents/fundamentals.ts` の隣に
- または統合テスト用に `src/__tests__/` ディレクトリを使用
- E2Eテストファイルは `e2e/` または類似ディレクトリに

**推奨命名:**
- ユニットテスト: `*.test.ts` または `*.spec.ts`
- 統合テスト: `*.integration.test.ts`
- E2Eテスト: `*.e2e.test.ts` または `e2e/` ディレクトリ内

## 優先テスト領域

コードベース分析に基づき、以下の領域を優先的にテストすべき:

**クリティカルパス（高優先度）:**
- `src/gemini.ts` - 外部APIラッパー
  - トークンバリデーションテスト: GEMINI_API_KEY未設定時のエラー
  - generateText() と generateChat() のレスポンスモック

- `src/data/market.ts` - 市場データ取得
  - fetchQuoteSafe() のネットワーク障害時のエラーハンドリングテスト
  - フィルタパターンがnullエントリを正しく除去するテスト
  - readonly配列の契約テスト

- `src/meeting/runner.ts` - コアビジネスロジック
  - buildMarketContext() の文字列フォーマットテスト
  - getAgentAnalysis() と getDiscussionComments() の呼び出し順序テスト
  - Promise.all並列化の動作テスト
  - generateText() のモックによる出力制御

**セカンダリ（中優先度）:**
- `src/data/news/analyzer.ts` - ニュース分析調整
  - buildAnalysisConfigs() が正しいプロンプトを生成するテスト
  - generateAllAnalyses() がPromise結果をMarketNewsに変換するテスト
  - Promise.all mapでのエラー回復テスト

- `src/report/generator.ts` - HTML生成
  - escapeHtml() のXSS防止テスト
  - markdownToHtml() の正規表現変換テスト
  - saveReports() の正しいパスでのファイル作成テスト
  - updateIndex() のエントリ重複防止テスト

- `src/portfolio/data.ts` - ポートフォリオデータ取得
  - fetchStockSafe() のエラーハンドリングテスト
  - formatPortfolioSummary() のテーブル生成テスト

**ターシャリ（低優先度）:**
- エージェントプロファイル定義（`src/agents/*.ts`）
  - エクスポートの存在確認のみ

- 型定義
  - TypeScriptコンパイラでバリデーション

## テスト構造パターン

このコードベースの推奨テスト構造:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('MarketDataFetcher', () => {
  beforeEach(() => {
    // モックセットアップ、状態クリア
  })

  afterEach(() => {
    // クリーンアップ
  })

  it('市場指数を正常に取得できること', async () => {
    // Arrange: テストデータセットアップ
    const mockIndices = [{ name: 'S&P 500', symbol: '^GSPC', ... }]
    
    // Act: 関数呼び出し
    const result = await fetchMarketIndices()
    
    // Assert: 結果検証
    expect(result).toEqual(mockIndices)
  })

  it('ネットワークエラーをグレースフルに処理すること', async () => {
    // ネットワーク障害をモック
    vi.mock('yahoo-finance2', () => ({
      quote: vi.fn().mockRejectedValue(new Error('Network'))
    }))
    
    const result = await fetchQuoteSafe('INVALID')
    expect(result).toBeNull()
  })
})
```

## モック戦略

**フレームワーク:** Vitestの `vi` モジュール（ネイティブ）

**モック対象:**
- 外部API呼び出し: `yahoo-finance2.quote()`, `GoogleGenerativeAI.generateContent()`
- ファイルI/O: `fs/promises` の読み書き操作
- 時間ベース操作: `Date.now()`, `setTimeout()`
- 環境変数（テスト内でセットアップ）

**モック非対象:**
- 型変換と計算
- 文字列フォーマット（escapeHtml, markdownToHtml）
- データ構造操作（filter, map, reduce）
- 純粋ヘルパー関数

**Gemini APIのモックパターン:**

```typescript
import { vi } from 'vitest'
import { generateText } from './gemini'

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({
      generateContent: vi.fn().mockResolvedValue({
        response: { text: vi.fn().mockReturnValue('モック分析テキスト') }
      })
    }))
  }))
}))
```

**ファイルI/Oのモックパターン:**

```typescript
import { writeFile, mkdir } from 'node:fs/promises'

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn()
}))
```

## フィクスチャとテストデータ

**推奨配置:**
- `src/__fixtures__/` または `src/__test__/fixtures/`
- ファクトリ関数は `src/__test__/factories/`

**ファクトリパターン例:**

```typescript
// src/__test__/factories/market-data.ts
export function createMockMarketIndex(): MarketIndex {
  return {
    name: 'S&P 500',
    symbol: '^GSPC',
    price: 5000,
    change: 50,
    changePercent: 1.0
  }
}

export function createMockMarketIndices(count = 5): ReadonlyArray<MarketIndex> {
  return Array.from({ length: count }, (_, i) => ({
    ...createMockMarketIndex(),
    name: `Index ${i}`
  }))
}
```

## カバレッジ

**要件:** 現在は未設定

**推奨目標:** クリティカルパスで80%以上
- コアビジネスロジック: 90%以上
- APIラッパー: 85%以上
- データ変換: 80%以上
- HTML生成: 70%以上

**カバレッジ確認:**
```bash
# vitest.config.ts にカバレッジを設定
npm test -- --coverage
```

**推奨設定:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/__test__/',
        '**/*.test.ts'
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    }
  }
})
```

## テスト種別

**ユニットテスト:**
- スコープ: 単一関数またはモジュール
- アプローチ: 純粋関数を様々な入力でテスト、依存関係をモック
- 例:
  - 特殊文字を含む `escapeHtml()`
  - 異なるデータ形状での `buildMarketContext()`
  - 空/フル記事配列での `formatArticlesForPrompt()`

**統合テスト:**
- スコープ: 複数モジュールの連携
- アプローチ: 実モジュールの統合、外部APIはモック
- 例:
  - モックGemini APIと市場データでの `runMeeting()`
  - モックAPIソースでの `fetchMarketNews()`
  - モックファイルシステムでの `saveReports()`

**E2Eテスト:**
- 現状: 未実装
- 推奨: クリティカルユーザーフローにPlaywrightを使用
  - デイリーレポート生成のエンドツーエンド
  - ポートフォリオ分析ミーティングワークフロー
  - レポートファイル出力検証

## 非同期テスト

**パターン:**
```typescript
import { describe, it, expect } from 'vitest'

describe('非同期操作', () => {
  it('データを非同期に取得できること', async () => {
    const result = await fetchMarketIndices()
    expect(result).toBeDefined()
    expect(result.length).toBeGreaterThan(0)
  })

  it('非同期エラーを処理できること', async () => {
    await expect(
      fetchMarketIndices() // またはvi.mockでエラーを注入
    ).rejects.toThrow()
  })

  it('Promise.allを正しく処理できること', async () => {
    const [data1, data2] = await Promise.all([
      fetchMarketIndices(),
      fetchSectorPerformance()
    ])
    expect(data1).toBeDefined()
    expect(data2).toBeDefined()
  })
})
```

## エラーハンドリングテスト

**パターン:**
```typescript
describe('エラーハンドリング', () => {
  it('API失敗時にnullを返すこと', async () => {
    vi.mock('yahoo-finance2', () => ({
      quote: vi.fn().mockRejectedValue(new Error('API Error'))
    }))
    
    const result = await fetchQuoteSafe('INVALID')
    expect(result).toBeNull()
  })

  it('コンソールにエラーをログ出力すること', async () => {
    const errorSpy = vi.spyOn(console, 'error')
    
    // エラー条件をトリガー
    
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch'),
      expect.any(Error)
    )
  })

  it('致命的エラー時にプロセスを終了すること', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {})
    
    // main() エラーをトリガー
    
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
```

## テスト実行戦略

**フェーズ1 - 基盤（第1週）:**
- `src/gemini.ts` のテスト作成（APIラッパーバリデーション）
- `src/data/market.ts` のテスト作成（エラーハンドリング、型ガード）
- GeminiとYahoo Finance用モックインフラの構築

**フェーズ2 - ビジネスロジック（第2週）:**
- `src/meeting/runner.ts` のテスト作成（オーケストレーション）
- `src/data/news/analyzer.ts` のテスト作成（プロンプト構築）
- `src/report/generator.ts` のテスト作成（HTML生成）

**フェーズ3 - 統合（第3週）:**
- `runMeeting()` の統合テスト作成
- `saveReports()` の統合テスト作成
- 必要に応じてPlaywright E2Eテスト追加

**フェーズ4 - 仕上げ（第4週）:**
- クリティカルパスで80%以上のカバレッジ達成
- このファイルにテストパターンを文書化
- 必要に応じてパフォーマンスベンチマーク追加

---

*テスト分析: 2026-04-08*
