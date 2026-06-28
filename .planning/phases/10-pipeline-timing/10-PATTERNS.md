# Phase 10: Pipeline Timing - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 3 (2 modified + 1 test modified)
**Analogs found:** 3 / 3

---

## File Classification

| 新規/変更ファイル | ロール | データフロー | 最近傍アナログ | 一致品質 |
|-------------------|--------|-------------|---------------|---------|
| `src/scripts/collect-data.ts` | script/utility | batch | 自ファイル (既存パターンを拡張) | exact |
| `.claude/commands/invest.md` | pipeline-command | event-driven | 自ファイル (既存ステップ境界パターンを拡張) | exact |
| `src/scripts/collect-data.test.ts` | test | unit | 自ファイル (既存テストスタイルを踏襲) | exact |

---

## Pattern Assignments

### `src/scripts/collect-data.ts` (script/utility, batch)

**アナログ:** 自ファイル — 既存の `writeFile` / `console.log` / エラーハンドリングパターンを `performance.now()` 計測と `pipeline-metrics.json` 書き込みで拡張する。

**Imports パターン** (lines 1-12):
```typescript
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
// ...

const TMP_DIR = join(import.meta.dirname, "../../tmp");
```
- `node:fs/promises` (readFile, writeFile) と `node:path` の join が標準インポート
- `performance` は Node.js グローバル変数のため import 不要

**tmp/ への JSON 書き込みパターン** (lines 20-24):
```typescript
await writeFile(
  join(TMP_DIR, "market.json"),
  JSON.stringify(marketData, null, 2),
  "utf-8",
);
```
- `pipeline-metrics.json` も同じパターンで書き込む: `join(TMP_DIR, "pipeline-metrics.json")`
- read-merge-write の場合は `readFile` で既存内容を読んでから `JSON.stringify` して上書き

**エラーハンドリングパターン** (lines 29-62):
```typescript
try {
  // ...処理...
  await writeFile(join(TMP_DIR, "news.json"), JSON.stringify(finalArticles, null, 2), "utf-8");
} catch (e) {
  console.error("ニュース収集失敗（続行）:", e);
  await writeFile(join(TMP_DIR, "news.json"), "[]", "utf-8");
}
```
- `pipeline-metrics.json` の読み込み失敗は同様に try/catch でフォールバック: `metrics = {}`

**console.log 進捗表示パターン** (lines 15-87):
```typescript
console.log("データ収集開始...");
// ...
console.log(`市場データ収集完了 (指数: ${marketData.indices.length}件, セクター: ${marketData.sectors.length}件)`);
// ...
console.log("データ収集完了");
```
- `durationMs` の表示も同じスタイル: `` `データ収集完了 (${Math.floor(durationMs/60000)}m ${Math.floor((durationMs%60000)/1000)}s)` ``

**追加すべき performance.now() パターン** (RESEARCH.md Pattern 1 から):
```typescript
export async function main() {
  const t0 = performance.now();  // ← main() 先頭に追加

  // ...既存の処理 (変更なし)...

  // ← main() 末尾に追加 (console.log("データ収集完了") の直前)
  const durationMs = Math.round(performance.now() - t0);
  const metricsPath = join(TMP_DIR, "pipeline-metrics.json");
  let metrics: Record<string, unknown> = {};
  try {
    const { readFile } = await import("node:fs/promises");
    metrics = JSON.parse(await readFile(metricsPath, "utf-8"));
  } catch {
    // ファイル未存在は正常（パイプライン初回）
  }
  metrics.collectData = { durationMs };
  await writeFile(metricsPath, JSON.stringify(metrics, null, 2), "utf-8");
}
```
- **注意:** `readFile` は既に `node:fs/promises` からトップレベル import されているため動的 import 不要。トップレベルの import 行に追加する

---

### `.claude/commands/invest.md` (pipeline-command, event-driven)

**アナログ:** 自ファイル — 既存の `node -e` Bash パターン、完了サマリーブロックを拡張する。

**既存の `node -e` JSON 読み込みパターン** (invest.md line 32-43):
```bash
cd /Users/arai/invest && node -e "
const fs = require('fs');
const market = JSON.parse(fs.readFileSync('tmp/market.json', 'utf-8'));
const news = JSON.parse(fs.readFileSync('tmp/news.json', 'utf-8'));
// ...
console.log('データ収集完了:');
console.log('  市場指数:', market.indices.length, '件');
"
```
- タイムスタンプ記録も同じ `node -e` + `fs.readFileSync/writeFileSync` パターンで実装

**既存の完了サマリー表示パターン** (invest.md lines 1336-1344):
```markdown
## パイプライン完了

「投資分析パイプライン完了」とユーザーに表示してください。

以下のサマリーをユーザーに表示してください:
- Step 1: データ収集 -- 完了
- Step 2: アナリストミーティング (3ラウンド) -- 完了
- Step 3: WebSearch + 再評価 + ポートフォリオ分析 + レポート生成 -- 完了
- Step 4: GitHub Pages デプロイ -- 完了
```
- Pipeline Timing ブロックはこの「パイプライン完了」セクション内、完了サマリーの直後に配置する

**追加すべき: pipelineStart 記録** (Step 1 の Bash コマンドの直前):

```bash
node -e "
const fs = require('fs');
let m = {};
try { m = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', 'utf-8')); } catch(e) {}
m.pipelineStart = Date.now();
fs.writeFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', JSON.stringify(m, null, 2));
"
```

**追加すべき: ステップ境界タイムスタンプ記録テンプレート** (RESEARCH.md Pattern 2 から):
```bash
# 各ステップ直前
node -e "
const fs = require('fs');
let m = {};
try { m = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', 'utf-8')); } catch(e) {}
m.__STEP_KEY__Start = Date.now();
fs.writeFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', JSON.stringify(m, null, 2));
"

# 各ステップ直後
node -e "
const fs = require('fs');
let m = {};
try { m = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', 'utf-8')); } catch(e) {}
m.__STEP_KEY__End = Date.now();
fs.writeFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', JSON.stringify(m, null, 2));
"
```
- `__STEP_KEY__` は各ステップに応じて置換: `round1`, `tickerExtract`, `round2`, `moderatorIssues`, `round3`, `moderatorFinal`, `validation`, `webSearch`, `portfolio`, `report`, `deploy`

**追加すべき: Pipeline Timing 表示ブロック** (RESEARCH.md Pattern 5 から):
```bash
node -e "
const fs = require('fs');
let m = {};
try {
  m = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', 'utf-8'));
} catch(e) {
  console.log('(タイミングデータなし)');
  process.exit(0);
}
function fmt(ms) {
  if (!ms || isNaN(ms)) return 'スキップ';
  const s = Math.floor(ms / 1000);
  return Math.floor(s/60) + 'm ' + String(s%60).padStart(2,'0') + 's';
}
const totalMs = m.pipelineEnd && m.pipelineStart ? m.pipelineEnd - m.pipelineStart : null;
console.log('');
console.log('═══ Pipeline Timing ═══');
console.log('Step 1: データ収集         ' + fmt(m.collectData && m.collectData.durationMs));
console.log('Step 2: アナリストミーティング');
console.log('  Round 1 分析            ' + fmt(m.round1End - m.round1Start));
console.log('  ティッカー抽出          ' + fmt(m.tickerExtractEnd - m.tickerExtractStart));
console.log('  Round 2 議論            ' + fmt(m.round2End - m.round2Start));
console.log('  モデレーター論点整理    ' + fmt(m.moderatorIssuesEnd - m.moderatorIssuesStart));
console.log('  Round 3 スコアリング    ' + fmt(m.round3End - m.round3Start));
console.log('  モデレーター最終統合    ' + fmt(m.moderatorFinalEnd - m.moderatorFinalStart));
console.log('  バリデーション          ' + fmt(m.validationEnd - m.validationStart));
console.log('Step 3: WebSearch+レポート');
console.log('  WebSearch+再評価        ' + fmt(m.webSearchEnd - m.webSearchStart));
console.log('  ポートフォリオ分析      ' + fmt(m.portfolioEnd - m.portfolioStart));
console.log('  レポート生成            ' + fmt(m.reportEnd - m.reportStart));
console.log('Step 4: デプロイ           ' + fmt(m.deployEnd - m.deployStart));
console.log('──────────────────────────────');
console.log('Total:                    ' + (totalMs ? fmt(totalMs) : '(計測中)'));
"
```
- キーが欠損している場合に `NaN` が出ないよう `fmt()` 内で `isNaN` ガードを追加 (Pitfall 3 対策)
- ファイル未存在の場合は try/catch で「タイミングデータなし」表示して続行 (Pitfall 2 対策)

---

### `src/scripts/collect-data.test.ts` (test, unit)

**アナログ:** 自ファイル (lines 75-160) — 既存の Test 1〜7 と同じ `writeFileMock.mock.calls.find()` パターンを踏襲する。

**既存のテストパターン** (lines 75-83):
```typescript
it("Test 1: main() を実行すると tmp/market.json が作成される", async () => {
  const { main } = await import("./collect-data.js");
  await main();

  const writeCalls = writeFileMock.mock.calls;
  const marketJsonCall = writeCalls.find((call) =>
    String(call[0]).includes("market.json"),
  );
  expect(marketJsonCall).toBeDefined();
});
```

**既存の JSON 内容検証パターン** (lines 86-100):
```typescript
it("Test 2: tmp/market.json の内容は indices と sectors キーを持つ", async () => {
  const { main } = await import("./collect-data.js");
  await main();

  const writeCalls = writeFileMock.mock.calls;
  const marketJsonCall = writeCalls.find((call) =>
    String(call[0]).includes("market.json"),
  );
  expect(marketJsonCall).toBeDefined();
  const parsed = JSON.parse(marketJsonCall![1] as string);
  expect(parsed).toHaveProperty("indices");
  expect(parsed).toHaveProperty("sectors");
});
```

**追加すべき METR-01 テスト** (RESEARCH.md Vitest テスト例から):
```typescript
it("main() 実行後に tmp/pipeline-metrics.json が書き込まれ collectData.durationMs が正の整数である (METR-01)", async () => {
  const { main } = await import("./collect-data.js");
  await main();

  const writeCalls = writeFileMock.mock.calls;
  const metricsCall = writeCalls.find((call) =>
    String(call[0]).includes("pipeline-metrics.json"),
  );
  expect(metricsCall).toBeDefined();
  const parsed = JSON.parse(metricsCall![1] as string);
  expect(parsed).toHaveProperty("collectData.durationMs");
  expect(typeof parsed.collectData.durationMs).toBe("number");
  expect(parsed.collectData.durationMs).toBeGreaterThanOrEqual(0);
});
```
- `describe("collect-data script", ...)` ブロック内（lines 47-169）の末尾に追加する
- `beforeEach` の `writeFileMock.mockClear()` が既にあるため、追加テストはクリア済みの状態から実行される

**追加すべき fmt 関数単体テスト** (METR-02 補完):
```typescript
it("fmt(ms) 関数が正しい分秒フォーマットを返す (METR-02補完)", () => {
  // fmt はインライン関数のため node -e から切り出してテスト
  function fmt(ms: number | undefined): string {
    if (!ms || isNaN(ms)) return 'スキップ';
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
  }
  expect(fmt(32000)).toBe('0m 32s');
  expect(fmt(65000)).toBe('1m 05s');
  expect(fmt(352000)).toBe('5m 52s');
  expect(fmt(undefined)).toBe('スキップ');
  expect(fmt(NaN)).toBe('スキップ');
});
```
- METR-01 テストの直後に追加する

---

## Shared Patterns

### tmp/ JSON 境界パターン
**出典:** `src/scripts/collect-data.ts` (lines 20-24, 54-58, 70-74) + `invest.md` (line 32-43)
**適用先:** collect-data.ts の `pipeline-metrics.json` 書き込み, invest.md の全タイムスタンプ記録コマンド

```typescript
// TypeScript 側: 書き込み
await writeFile(
  join(TMP_DIR, "pipeline-metrics.json"),
  JSON.stringify(metrics, null, 2),
  "utf-8",
);
```
```javascript
// Bash 側 (node -e): 読み込み + マージ + 書き込み
const fs = require('fs');
let m = {};
try { m = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', 'utf-8')); } catch(e) {}
m.someKey = Date.now();
fs.writeFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', JSON.stringify(m, null, 2));
```

### エラーハンドリング (続行) パターン
**出典:** `src/scripts/collect-data.ts` (lines 29-62)
**適用先:** collect-data.ts の `pipeline-metrics.json` 読み込み部分, invest.md の表示ブロック

```typescript
try {
  metrics = JSON.parse(await readFile(metricsPath, "utf-8"));
} catch {
  // ファイル未存在は正常 — 空オブジェクトで継続
}
```

### console.log 進捗表示パターン
**出典:** `src/scripts/collect-data.ts` (lines 15, 26-27, 87)
**適用先:** collect-data.ts の完了ログ (durationMs 追加)

```typescript
console.log(`データ収集完了 (${Math.floor(durationMs/60000)}m ${Math.floor((durationMs%60000)/1000)}s)`);
```

### Vitest writeFileMock 検証パターン
**出典:** `src/scripts/collect-data.test.ts` (lines 75-100)
**適用先:** METR-01 テスト

```typescript
const writeCalls = writeFileMock.mock.calls;
const targetCall = writeCalls.find((call) =>
  String(call[0]).includes("pipeline-metrics.json"),
);
expect(targetCall).toBeDefined();
const parsed = JSON.parse(targetCall![1] as string);
expect(parsed).toHaveProperty("collectData.durationMs");
```

---

## Anti-Patterns (コーディング時に避けること)

| 避けるパターン | 理由 | 代替 |
|--------------|------|------|
| `performance.now()` を `node -e` 間で使う | 各 `node -e` は別プロセスのため基点がリセットされる | Bash 境界では `Date.now()` を使う |
| `date +%s%N` を macOS で使う | BSD date は `%N` 非対応 | `node -e "console.log(Date.now())"` |
| Bash 変数でタイムスタンプを引き継ぐ | 各 Bash ツール呼び出しは別サブシェル | `pipeline-metrics.json` ファイルに保存 |
| `NaN` を fmt() に渡して表示する | `undefined - undefined = NaN` になる | `isNaN(ms)` ガードで `'スキップ'` を返す |
| Step 1 の表示値に `Date.now()` 前後差を使う | tsx 起動オーバーヘッド (数秒) が含まれる | `collectData.durationMs` (performance.now() 値) を使う |

---

## tmp/pipeline-metrics.json スキーマ (設計参照)

```json
{
  "pipelineStart": 1782623322078,
  "collectData": { "durationMs": 32000 },
  "round1Start": 1782623354078,
  "round1End":   1782623419078,
  "tickerExtractStart": 1782623419078,
  "tickerExtractEnd":   1782623422078,
  "round2Start": 1782623422078,
  "round2End":   1782623494078,
  "moderatorIssuesStart": 1782623494078,
  "moderatorIssuesEnd":   1782623514078,
  "round3Start": 1782623514078,
  "round3End":   1782623552078,
  "moderatorFinalStart": 1782623552078,
  "moderatorFinalEnd":   1782623587078,
  "validationStart": 1782623587078,
  "validationEnd":   1782623589078,
  "webSearchStart": 1782623589078,
  "webSearchEnd":   1782623659078,
  "portfolioStart": 1782623659078,
  "portfolioEnd":   1782623681078,
  "reportStart": 1782623681078,
  "reportEnd":   1782623689078,
  "deployStart": 1782623689078,
  "deployEnd":   1782623694078,
  "pipelineEnd": 1782623694078
}
```
**注意:** `collectData.durationMs` のみ `performance.now()` 計測値 (ms精度)。それ以外は `Date.now()` 記録値 (ms精度)。

---

## invest.md への挿入位置マップ

| タイムスタンプキー | invest.md の挿入位置 |
|------------------|--------------------|
| `pipelineStart` | Step 1 の `npx tsx collect-data.ts` 実行前 (`「市場データ収集を開始します...」` 表示の直前) |
| `round1Start` / `round1End` | Step 2a: Round 1 の並列 Agent 呼び出し前後 |
| `tickerExtractStart` / `tickerExtractEnd` | Step 2b: ティッカー抽出 Bash コマンド前後 |
| `round2Start` / `round2End` | Step 2c: Round 2 の並列 Agent 呼び出し前後 |
| `moderatorIssuesStart` / `moderatorIssuesEnd` | Step 2d: モデレーター論点整理 Agent 前後 |
| `round3Start` / `round3End` | Step 2e: Round 3 の並列 Agent 呼び出し前後 |
| `moderatorFinalStart` / `moderatorFinalEnd` | Step 2f: モデレーター最終統合 Agent 前後 |
| `validationStart` / `validationEnd` | Step 2g: `npx tsx validate-meeting.ts` 実行前後 |
| `webSearchStart` / `webSearchEnd` | Step 3a+3b: WebSearch Agent 並列実行前後（Step 3b 終了時を webSearchEnd とする） |
| `portfolioStart` / `portfolioEnd` | Step 3d: ポートフォリオ分析 Agent 前後 |
| `reportStart` / `reportEnd` | Step 3c: `npx tsx generate-report.ts` 実行前後 |
| `deployStart` / `deployEnd` | Step 4: `npx tsx update-index.ts` 実行前 〜 git push 完了後 |
| `pipelineEnd` | Pipeline Timing 表示ブロックの直前 |

---

## Metadata

**アナログ検索スコープ:** `src/scripts/`, `.claude/commands/`
**スキャンファイル数:** 3
**パターン抽出日:** 2026-06-28
