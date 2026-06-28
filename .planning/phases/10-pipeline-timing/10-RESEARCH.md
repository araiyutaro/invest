# Phase 10: Pipeline Timing - Research

**Researched:** 2026-06-28
**Domain:** Node.js パフォーマンス計測 / Bash タイムスタンプ / tmp/ JSON 境界パターン
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 ステップ粒度:** 中カテゴリ（Round別）＋モデレーター介入を別行で表示。計測ステップは約10-12段階:
- データ収集（collect-data.ts）
- Round 1 分析（5アナリスト並列）
- ティッカー抽出
- Round 2 議論（5アナリスト並列）
- モデレーター論点整理
- Round 3 スコアリング（5アナリスト並列）
- モデレーター最終統合
- バリデーション
- WebSearch＋再評価
- ポートフォリオ分析
- レポート生成
- デプロイ

**D-02 表示フォーマット:** Step 階層付きリスト形式。Step 1〜4 の大カテゴリの下に、各サブステップをインデントして表示する。現行の invest.md 完了サマリーと統一感のあるスタイル

**D-03 表示例:**
```
═══ Pipeline Timing ═══
Step 1: データ収集         0m 32s
Step 2: アナリストミーティング
  Round 1 分析            1m 05s
  ティッカー抽出          0m 03s
  Round 2 議論            1m 12s
  モデレーター論点整理    0m 20s
  Round 3 スコアリング    0m 38s
  モデレーター最終統合    0m 35s
  バリデーション          0m 02s
Step 3: WebSearch+レポート
  WebSearch+再評価       1m 10s
  ポートフォリオ分析      0m 22s
  レポート生成            0m 08s
Step 4: デプロイ           0m 05s
──────────────────────────────
Total:                    5m 52s
```

### Claude's Discretion

- タイミング表示ブロックの配置（完了サマリーに統合 vs 別ブロック）
- invest.md 内のタイムスタンプ取得方式（Bash `date` コマンド、`node -e` 等）
- tmp/pipeline-metrics.json のスキーマ設計
- collect-data.ts 内の performance.now() 計測ポイントの配置
- 時間フォーマットの詳細（`0m 32s` vs `32s` vs `0:32` 等）

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| METR-01 | パイプライン全体の実行時間が最終出力に表示される | tmp/pipeline-metrics.json の totalDurationMs → invest.md 最終表示ブロック |
| METR-02 | ステップ別内訳（データ収集、各分析ラウンド、レポート生成、デプロイ）が表示される | 各ステップ境界での timestamp 書き込み → D-03 のフォーマットで表示 |
</phase_requirements>

---

## Summary

Phase 10 は /invest パイプラインの実行時間を計測し、最終出力にステップ別内訳を表示する。実装対象は 2 ファイル: `src/scripts/collect-data.ts`（TypeScript 内で `performance.now()` を使って内部計測）と `.claude/commands/invest.md`（各ステップ境界で `node -e "console.log(Date.now())"` を実行してタイムスタンプを記録）。

計測値は `tmp/pipeline-metrics.json` 経由で伝達される。collect-data.ts が自身の実行時間を同ファイルに書き込み、invest.md の各ステップ境界でも同ファイルに追記していく。パイプライン末尾の "Pipeline Timing" ブロックで全データを読み出して表示する。

新規 npm パッケージは不要。`performance.now()`（Node.js 組み込み）と `Date.now()`（JavaScript 組み込み）のみを使用する。テストは collect-data.ts が pipeline-metrics.json を書き出すことの確認と、時刻フォーマット関数の単体テストが可能範囲。

**Primary recommendation:** collect-data.ts は `performance.now()` で内部計測 → `tmp/pipeline-metrics.json` に書き込む。invest.md は各ステップ境界で `Date.now()` をファイルに追記する。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| データ収集ステップ計測 | TypeScript Script (collect-data.ts) | — | `performance.now()` はプロセス内でのみ有効。collect-data.ts が自身のタイミングを所有する |
| パイプラインステップ計測 | Claude Command (invest.md) | Bash subprocess | 各ステップ前後に `node -e` でタイムスタンプを記録 |
| タイミングデータ永続化 | ファイル (tmp/pipeline-metrics.json) | — | Bash ツール呼び出し間の状態を保持できないため、ファイルを境界とする |
| タイミング表示 | Claude Command (invest.md) | — | パイプライン最末尾のブロックで全タイミングを読み出して表示 |
| 時刻フォーマット | Inline JavaScript (node -e) | — | 純関数。ライブラリ不要 |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `performance` (global) | Node.js 組み込み (v24.3.0 確認済) | プロセス内高精度タイマー | NTP ジャンプによる負値が出ない。STATE.md 決定済み |
| `Date.now()` (global) | JS 組み込み | Bash one-liner タイムスタンプ | `performance.now()` はプロセス間で使えないため Bash 境界では Date.now() を使用 |
| `fs` (node:fs) | Node.js 組み込み | tmp/pipeline-metrics.json の読み書き | プロジェクト全体で使用済みパターン |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Date.now()` in bash | `date +%s` (seconds) | `date +%s` は整数秒精度のみ。サブステップが 1 秒未満になる可能性があるため、ms 精度の `Date.now()` が推奨 |
| `Date.now()` in bash | `date +%s%N` (nanoseconds) | macOS の BSD `date` は `%N` 非対応。プロジェクトは darwin (macOS) なので使用不可 |
| `performance.now()` across processes | `process.hrtime()` | 用途は同じだが `performance.now()` の方が読みやすく、Node.js 公式推奨 |

**Installation:** 新規パッケージなし

**Version verification:** `node -e "console.log(typeof performance)"` → `object` (v24.3.0 で確認済み) [VERIFIED: bash実行]

---

## Package Legitimacy Audit

新規外部パッケージのインストールなし。このフェーズは Node.js 組み込み API のみを使用する。

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
invest.md (Claude Command)
│
├─ [Step 1 開始前]  node -e "console.log(Date.now())" ──► tmp/pipeline-metrics.json
│                                                               │
│  npx tsx collect-data.ts ─────────────────────────────────► │
│     ├─ performance.now() 開始                                │
│     ├─ market / news / portfolio fetch                       │
│     ├─ performance.now() 終了                                │
│     └─ 書き込み: collectData.durationMs ──────────────────►  │
│                                                               │
├─ [Step 1 終了後]  node -e "console.log(Date.now())" ──────► │
│                                                               │
├─ [Step 2.a 開始前] node -e タイムスタンプ ────────────────► │
│  Agent x5 (Round 1 並列)                                     │
├─ [Step 2.a 終了後] node -e タイムスタンプ ────────────────► │
│                                                               │
│  ... (各サブステップを同様に計測) ...                        │
│                                                               │
├─ [Step 4 終了後]  node -e タイムスタンプ ─────────────────► │
│                                                               │
└─ [Pipeline Timing 表示]                                       │
      node -e (tmp/pipeline-metrics.json を読み込み)◄──────────┘
      → D-03 フォーマットで表示
```

### Recommended Project Structure

変更対象ファイルのみ（新規ファイル・ディレクトリなし）:
```
src/scripts/
├── collect-data.ts    # performance.now() 追加 + pipeline-metrics.json 書き出し
└── collect-data.test.ts  # 新テスト追加 (METR-01)
.claude/commands/
└── invest.md          # 各ステップ境界に timestamp 記録コマンドを追加
tmp/
└── pipeline-metrics.json  # 実行時に生成される (gitignore 対象)
```

### Pattern 1: TypeScript 内 performance.now() 計測

**What:** プロセス内で高精度タイマーを使って経過時間を計測
**When to use:** TypeScript スクリプト内で開始〜終了の経過時間を計測するとき

```typescript
// Source: Node.js v24.3.0 ランタイム確認済み
async function main() {
  const t0 = performance.now();

  // ... 処理 ...

  const durationMs = Math.round(performance.now() - t0);

  // tmp/pipeline-metrics.json に書き出す
  const metricsPath = join(TMP_DIR, "pipeline-metrics.json");
  let metrics: Record<string, unknown> = {};
  try {
    metrics = JSON.parse(await readFile(metricsPath, "utf-8"));
  } catch {
    // ファイル未存在は正常（パイプライン初回実行）
  }
  metrics.collectData = { durationMs };
  await writeFile(metricsPath, JSON.stringify(metrics, null, 2), "utf-8");
}
```

### Pattern 2: invest.md の Bash タイムスタンプ記録

**What:** Claude Command 内で各ステップの境界タイムスタンプを tmp ファイルに書き込む
**When to use:** ステップ開始前・終了後に timestamp を記録するとき

```bash
# ステップ開始前 (例: Step 2 Round 1 開始)
node -e "
const fs = require('fs');
let m = {};
try { m = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', 'utf-8')); } catch(e) {}
m.round1Start = Date.now();
fs.writeFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', JSON.stringify(m, null, 2));
"

# ステップ終了後
node -e "
const fs = require('fs');
let m = {};
try { m = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', 'utf-8')); } catch(e) {}
m.round1End = Date.now();
fs.writeFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', JSON.stringify(m, null, 2));
"
```

### Pattern 3: 時刻フォーマット (ms → "Xm YYs")

**What:** ミリ秒を "0m 32s" 形式にフォーマット
**When to use:** Pipeline Timing 表示ブロック生成時

```javascript
// node -e の inline script として使用
function fmt(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = String(totalSec % 60).padStart(2, '0');
  return `${min}m ${sec}s`;
}
```

### Pattern 4: tmp/pipeline-metrics.json スキーマ（推奨）

**What:** 全タイミングデータを 1 ファイルに集約するスキーマ

```json
{
  "pipelineStart": 1782623322078,
  "collectData": {
    "durationMs": 32000
  },
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

**注意:** `collectData.durationMs` は collect-data.ts が `performance.now()` で計測した値（ms 精度）。それ以外の `*Start` / `*End` は invest.md が `Date.now()` で記録した値（ms 精度）。

### Pattern 5: Pipeline Timing 表示ブロック (invest.md 末尾)

```bash
node -e "
const fs = require('fs');
const m = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', 'utf-8'));

function fmt(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s/60) + 'm ' + String(s%60).padStart(2,'0') + 's';
}

const totalMs = (m.pipelineEnd || Date.now()) - m.pipelineStart;
const step2Ms = (m.validationEnd - m.round1Start);
const step3Ms = (m.reportEnd - m.webSearchStart);

console.log('');
console.log('═══ Pipeline Timing ═══');
console.log('Step 1: データ収集         ' + fmt(m.collectData.durationMs));
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
console.log('Total:                    ' + fmt(totalMs));
"
```

### Anti-Patterns to Avoid

- **performance.now() を Bash の node -e 間で使う:** 各 `node -e` は別プロセスのため、`performance.now()` の基点がリセットされる。Bash 境界では必ず `Date.now()` を使う
- **macOS で `date +%s%N` を使う:** BSD date は `%N` 非対応。`node -e "console.log(Date.now())"` を使う
- **Bash 変数を Claude ツール呼び出し間で引き継ぐ:** 各 Bash ツール呼び出しは別サブシェル。状態はファイルに保存する
- **pipeline-metrics.json が存在しない場合を未処理にする:** パイプライン途中失敗時にファイルが存在しないことがある。常に try/catch でフォールバックを設ける

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 高精度タイマー | カスタムクロック実装 | `performance.now()` | Node.js 組み込み。NTP 安全。精度十分 |
| ミリ秒→分秒変換 | npm ライブラリ | 3 行の inline JS | `Math.floor(ms/60000)` で完結。外部依存不要 |
| プロセス間状態共有 | グローバル変数 / 環境変数 | `tmp/pipeline-metrics.json` | プロジェクト確立パターン。TS↔Claude の標準境界 |

**Key insight:** このフェーズは新しい概念を導入しない。プロジェクト既存パターン（tmp/ JSON 境界、console.log、node -e）の延長として実装できる。

---

## Common Pitfalls

### Pitfall 1: collect-data.ts の Step 1 タイミングと invest.md のタイミングの二重計測

**What goes wrong:** collect-data.ts が performance.now() で計測した時間（内部実行時間）と、invest.md が `npx tsx collect-data.ts` コマンドの前後で計測した時間（tsx 起動オーバーヘッド含む）が異なる
**Why it happens:** tsx の起動コスト（Node.js モジュール解決、TypeScript トランスパイル）が数秒かかることがある
**How to avoid:** Step 1 の表示値として、`collect-data.ts` 内の `performance.now()` 計測値（より正確）を使う。invest.md 側の Step 1 境界タイムスタンプはパイプライン全体の Total 計算のみに使う
**Warning signs:** Step 1 の表示時間が実際の市場データ取得時間より数秒長い

### Pitfall 2: pipeline-metrics.json が未存在の状態での表示ブロック実行

**What goes wrong:** データ収集に失敗した場合や途中でパイプラインが中断した場合、`tmp/pipeline-metrics.json` が存在しない。表示ブロックの `JSON.parse(readFileSync(...))` が例外を投げる
**Why it happens:** collect-data.ts の `main()` が例外終了すると途中でファイル書き込みが行われない
**How to avoid:** 表示ブロックの node -e スクリプトを try/catch で囲む。ファイルが存在しない場合は「タイミングデータなし」と表示して続行する
**Warning signs:** collect-data.ts が `process.exit(1)` で終了したときに表示ブロックが `SyntaxError: Unexpected end of JSON input` を出す

### Pitfall 3: サブステップキーの欠損による NaN 表示

**What goes wrong:** Round 3 をスキップした場合（ティッカー 0 件）など、一部のサブステップキーが pipeline-metrics.json に書き込まれない。`m.round3End - m.round3Start` が `NaN` になる
**Why it happens:** invest.md の条件分岐でスキップされたステップには start/end が書き込まれない
**How to avoid:** 表示ブロックで各値を `m.round3End && m.round3Start ? fmt(...) : 'スキップ'` のようにガードする

### Pitfall 4: invest.md の JSON 書き込みでの parse/stringify ループ

**What goes wrong:** pipeline-metrics.json に追記するたびに「read → parse → merge → stringify → write」を繰り返すと、ファイルが壊れている場合に全タイミングデータが失われる
**Why it happens:** try/catch 内で `m = {}` にフォールバックすると、それまでの計測データが消える
**How to avoid:** JSON パースに失敗した場合は、既存ファイルを上書きせず `{}` から再スタートするか、書き込み失敗をログに残してスキップする

---

## Code Examples

### collect-data.ts への performance.now() 追加（変更差分）

```typescript
// Source: 既存 collect-data.ts の main() に追加
export async function main() {
  const t0 = performance.now();  // ← 追加

  console.log("データ収集開始...");
  await mkdir(TMP_DIR, { recursive: true });

  // ... 既存の market / news / portfolio fetch ...

  // ← main() 末尾に追加
  const durationMs = Math.round(performance.now() - t0);
  const metricsPath = join(TMP_DIR, "pipeline-metrics.json");
  let metrics: Record<string, unknown> = {};
  try {
    const { readFile } = await import("node:fs/promises");
    metrics = JSON.parse(await readFile(metricsPath, "utf-8"));
  } catch {
    // ファイル未存在は正常
  }
  metrics.collectData = { durationMs };
  await writeFile(metricsPath, JSON.stringify(metrics, null, 2), "utf-8");
  console.log(`データ収集完了 (${Math.floor(durationMs/60000)}m ${Math.floor((durationMs%60000)/1000)}s)`);
}
```

### invest.md ステップ境界タイムスタンプ記録（テンプレート）

```bash
# 各ステップ直前に追加するコマンドのテンプレート
node -e "
const fs = require('fs');
let m = {};
try { m = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', 'utf-8')); } catch(e) {}
if (!m.pipelineStart) m.pipelineStart = Date.now();  // 初回のみ
m.__STEP_KEY__Start = Date.now();
fs.writeFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', JSON.stringify(m, null, 2));
"

# 各ステップ直後に追加するコマンドのテンプレート
node -e "
const fs = require('fs');
let m = {};
try { m = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', 'utf-8')); } catch(e) {}
m.__STEP_KEY__End = Date.now();
fs.writeFileSync('/Users/arai/invest/tmp/pipeline-metrics.json', JSON.stringify(m, null, 2));
"
```

### Vitest テスト例（METR-01 対応）

```typescript
// collect-data.test.ts に追加
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

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Date.now()` for timing | `performance.now()` for in-process timing | STATE.md 決定 (v2.2) | NTP ジャンプによる負値が排除される |
| 複数プロセス間状態共有なし | `tmp/pipeline-metrics.json` ファイル境界 | Phase 10 新規 | invest.md の Claude とスクリプト間でタイミングデータを共有可能に |

**Deprecated/outdated:**
- `Date.now()` を Node.js スクリプト内のプロセス内計測に使う: `performance.now()` に置換済み（STATE.md）

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | tsx 起動オーバーヘッドは数秒程度 | Pitfall 1 | 実測してみると許容範囲外の差がある可能性あり（低リスク、表示値への影響のみ） |
| A2 | invest.md の各ステップ境界での `node -e` 実行は数百ms 未満のオーバーヘッドで済む | Architecture | 計測精度への影響がある可能性（低リスク） |

**評価:** A1/A2 とも表示精度に関するもので、機能的な正確性には影響しない。

---

## Open Questions

1. **Step 1 の表示値をどちらの計測値で出すか**
   - What we know: collect-data.ts の `performance.now()` 値（tsx 起動コスト除く）と、invest.md の `Date.now()` による前後差（tsx 起動コスト含む）が存在する
   - What's unclear: ユーザーが見たい値はどちらか
   - Recommendation: `collectData.durationMs`（collect-data.ts 内計測値）を Step 1 の表示値とする。`pipelineStart` から `deployEnd` までを Total とする。これにより Total と Step 合計の微小な差（tsx オーバーヘッド）はユーザーには見えない

2. **pipeline-metrics.json の初期化タイミング**
   - What we know: `pipelineStart` は最初の Bash コマンド（Step 1 開始前）に記録すべき
   - What's unclear: Step 1 開始前の Bash コマンド追加場所
   - Recommendation: 現行 invest.md の「市場データ収集を開始します...」表示コマンドに統合する

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js `performance` global | collect-data.ts | ✓ | v24.3.0 | — |
| `Date.now()` (JS built-in) | invest.md Bash | ✓ | v24.3.0 | `date +%s` (秒精度のみ) |
| `node:fs/promises` | pipeline-metrics.json 書き込み | ✓ | v24.3.0 | — |
| `tmp/` ディレクトリ | pipeline-metrics.json 配置 | ✓ (collect-data.ts が作成) | — | — |

**Missing dependencies with no fallback:** なし

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | package.json (`"test": "vitest run"`) |
| Quick run command | `npx vitest run src/scripts/collect-data.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| METR-01 | main() 完了後に pipeline-metrics.json が書き込まれ collectData.durationMs を含む | unit | `npx vitest run src/scripts/collect-data.test.ts` | ✅ (新テスト追加) |
| METR-02 | Pipeline Timing ブロックが正しい形式で表示される | manual-only | — | N/A |
| METR-02 (補) | `fmt(ms)` 関数が正しい文字列を返す | unit | `npx vitest run src/scripts/collect-data.test.ts` | ✅ (新テスト追加) |

**METR-02 が manual-only の理由:** 表示ブロックは invest.md (Claude Command) 内の `node -e` スクリプトであり、Vitest から実行可能なエクスポート関数ではない。フォーマット関数のユニットテストで代替カバレッジを確保する。

### Sampling Rate

- **Per task commit:** `npx vitest run src/scripts/collect-data.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/scripts/collect-data.test.ts` に METR-01 テスト追加（ファイル自体は存在するため追記のみ）

*(既存テストインフラは全要件をカバー。新規ファイル不要)*

---

## Security Domain

このフェーズは内部計測データをローカルファイルに書き込むのみ。ユーザー入力なし、ネットワーク通信なし、機密データの処理なし。ASVS カテゴリの適用対象なし。

---

## Sources

### Primary (HIGH confidence)

- Node.js v24.3.0 ランタイム確認 — `performance` グローバル変数の存在と `performance.now()` 動作を実機確認 [VERIFIED: bash実行]
- `/Users/arai/invest/.planning/phases/10-pipeline-timing/10-CONTEXT.md` — 全 Locked Decision の出典
- `/Users/arai/invest/.planning/STATE.md` — `performance.now()` 採用決定、`tmp/pipeline-metrics.json` 方式の出典

### Secondary (MEDIUM confidence)

- `/Users/arai/invest/src/scripts/collect-data.ts` — 既存コード構造と `performance.now()` 追加ポイントの確認
- `/Users/arai/invest/.claude/commands/invest.md` — 計測対象ステップの境界位置の確認
- `/Users/arai/invest/src/scripts/collect-data.test.ts` — 既存テストパターンの確認（vi.mock、beforeEach、writeFileMock）

### Tertiary (LOW confidence)

なし

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Node.js 組み込み API を実機確認。外部依存なし
- Architecture: HIGH — プロジェクト既存パターン（tmp/ JSON 境界）の延長
- Pitfalls: MEDIUM — 一部は想定ベース（A1/A2）、主要ピットフォールは既存コードから確認

**Research date:** 2026-06-28
**Valid until:** 2026-09-28（Node.js 組み込み API のため安定、30 日超でも有効）
