# Phase 3: Report Builder + WebSearch Research - Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 4 (新規/修正ファイル)
**Analogs found:** 4 / 4

---

## File Classification

| 新規/修正ファイル | Role | Data Flow | 最近傍アナログ | Match Quality |
|-----------------|------|-----------|--------------|---------------|
| `.claude/commands/invest.md` (Step 3 追加) | skill (orchestrator) | Agent spawn → file-I/O → Bash | 同ファイル Step 2 パターン | exact (同一ファイル内の拡張) |
| `src/scripts/generate-report.ts` | script (transformer) | file-I/O → HTML output | `src/report/generator.ts` | exact (同一データフロー) |
| `src/meeting/schemas.ts` (拡張) | schema (validation) | Zod schema + parse | 同ファイル既存スキーマ | exact (同一ファイルへの追記) |
| `src/meeting/types.ts` (拡張) | types (contract) | TypeScript interface | 同ファイル既存型 | exact (同一ファイルへの追記) |

---

## Pattern Assignments

### `.claude/commands/invest.md` Step 3 (skill, Agent spawn → file-I/O)

**アナログ:** 同ファイル Step 2 全体（特に Step 2a の並列 Agent スポーンと Step 2b の Bash 介入）

#### Step 3a: WebSearch リサーチ Agent 並列スポーンパターン

Step 2a で確立した「5つの Agent を同一メッセージで並列発行」と同様のパターンで、
`highlightedStocks` の各銘柄に対して銘柄ごとの WebSearch Agent をスポーンする（D-06）。

**読み込みパターン** (invest.md lines 359-362 に倣う):
```
まず以下のファイルを Read ツールで読み込んでください:
- `/Users/arai/invest/tmp/meeting-result.json` — highlightedStocks 配列を取得
```

**並列 Agent スポーンパターン** (invest.md lines 81-82 から踏襲):
```
以下の Agent ツールを同時に（1つのメッセージで並列）呼び出してください:

各銘柄について:
- name: `websearch-{ticker}`（例: websearch-AAPL）
- model: `sonnet`（D-06: WebSearch Agentは sonnet で十分）
- tools: WebSearch, WebFetch
- prompt:
  以下の銘柄について、最新の定性情報をリサーチしてください。
  （注意: 株価・財務数値等の定量データはリサーチ対象外。D-05に従い定性情報のみ）

  ## 調査対象銘柄
  ティッカー: {ticker}
  モデレーター評価: {verdict} (スコア: {averageScore}/10)
  推薦理由: {summary}

  ## 調査方法
  1. WebSearch で以下のクエリを実行してください（2-3クエリ）:
     - "{ticker} 最新ニュース 2026"
     - "{company_name} 業界動向 成長"
     - "{ticker} リスク 懸念"
  2. 重要な記事 2-3 件を WebFetch で詳細取得

  ## 出力形式（JSONのみ出力、コードブロック不要）
  {
    "ticker": "{ticker}",
    "researchSummary": "200文字以内の総合評価",
    "positiveFindings": ["ポジティブな発見1", "ポジティブな発見2"],
    "negativeFindings": ["ネガティブな発見1"],
    "keyArticles": [
      {"title": "記事タイトル", "summary": "記事要約（100文字以内）"}
    ],
    "researchedAt": "ISO8601タイムスタンプ"
  }
```

**失敗時のフォールバックパターン** (invest.md lines 291-292 から踏襲):
```
出力が有効なJSONでない場合は、以下を保存してください:
{"ticker": "...", "researchSummary": "リサーチ失敗", "positiveFindings": [], "negativeFindings": [], "keyArticles": [], "researchedAt": "..."}
```

**Bash 保存パターン** (invest.md lines 284-292 から踏襲):
```
各 Agent の結果を以下に保存してください:
- websearch-{ticker} の出力 → `/Users/arai/invest/tmp/websearch/{ticker}.json`

完了後: 「WebSearch完了: N/{total}銘柄リサーチ成功」と表示
```

#### Step 3b: 再評価ラウンド Agent 並列スポーンパターン

Round 2 ディスカッション（Step 2c）と同一パターン。5アナリストを `sonnet` で並列実行（D-07）。

**Agent スポーンテンプレート** (invest.md lines 365-401 から踏襲):
```
- name: `{agentId}-reeval`
- model: `sonnet`（D-07: 再評価は sonnet で十分）
- prompt:
  [各エージェントの systemPrompt]

  WebSearchリサーチ結果を踏まえて、以下の銘柄に対する投資評価を再提出してください。

  ## WebSearch リサーチ結果
  [tmp/websearch/ の各 ticker.json の内容]

  ## あなたのRound 3 評価（参考）
  [tmp/round-3/{agentId}.json の scores フィールド]

  見解が変わった場合はその理由を明記してください。
  変化がない場合は「変化なし」と記載してください。

  以下のJSONフォーマットのみを出力してください（コードブロック不要）:
  {
    "agentId": "{agentId}",
    "agentRole": "{agentRole}",
    "reevaluations": [
      {
        "ticker": "AAPL",
        "originalScore": 7,
        "revisedScore": 8,
        "comment": "WebSearch結果を踏まえたコメント（100文字以内）",
        "changed": true
      }
    ]
  }
```

**保存先:** `/Users/arai/invest/tmp/reeval/{agentId}.json`

#### Step 3c: レポート生成 Bash コマンドパターン

invest.md Step 1 の Bash 実行パターン（lines 21-22）から踏襲:
```bash
cd /Users/arai/invest && npx tsx src/scripts/generate-report.ts
```

**完了確認パターン** (invest.md lines 868-895 から踏襲):
```bash
node -e "
const fs = require('fs');
const result = JSON.parse(fs.readFileSync('/Users/arai/invest/tmp/meeting-result.json', 'utf-8'));
console.log('レポート生成完了:');
console.log('  日付:', result.date);
console.log('  注目銘柄数:', result.highlightedStocks?.length ?? 0);
"
```

---

### `src/scripts/generate-report.ts` (script, file-I/O → HTML)

**アナログ:** `src/report/generator.ts` (完全一致) + `src/scripts/validate-meeting.ts` (エントリポイント)

#### Imports パターン (`src/scripts/validate-meeting.ts` lines 1-5、`src/report/generator.ts` lines 1-3):
```typescript
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { validateMeetingResult } from "../meeting/schemas.js";
import type { MeetingResult } from "../meeting/types.js";
```

#### ディレクトリパスパターン (`src/report/generator.ts` line 5、`src/scripts/validate-meeting.ts` line 5):
```typescript
const TMP_DIR = join(import.meta.dirname, "../../tmp");
const REPORTS_DIR = join(import.meta.dirname, "../../reports");
```
注意: v1.0 は `../../docs` だが v2.0 は `reports/` に変更（D-09、CONTEXT.md Integration Points）。

#### エントリポイントパターン (`src/index.ts` lines 125-128 から踏襲):
```typescript
async function main(): Promise<void> {
  const raw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const meetingResult = validateMeetingResult(JSON.parse(raw) as unknown);
  // ...レポート生成...
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

#### Bloomberg 風 CSS パターン (`src/report/generator.ts` lines 55-158 をそのまま再利用):
```typescript
const HTML_STYLES = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', ...;
      background: #0f0f1a;
      color: #e0e0e0;
      ...
    }
    .agent-card { background: #1e1e2e; border-radius: 8px; ... border-left: 4px solid #6366f1; }
    .discussion-card { background: #1a1a28; ... border-left: 4px solid #f59e0b; }
  </style>
`;
```

#### `markdownToHtml()` パターン (`src/report/generator.ts` lines 14-53 をそのまま再利用):
```typescript
function markdownToHtml(md: string): string {
  let html = escapeHtml(md);
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  // ... ヘッダー、強調、リスト、テーブル変換
  html = html.replace(/\n{2,}/g, "\n</p>\n<p>\n");
  return html;
}
```

#### `formatScoringHtml()` v2.0 対応パターン (`src/report/generator.ts` lines 161-209 をベースに MeetingResult 型へ適応):

v1.0 は `MeetingRecord.scoreSummaries` を使う。v2.0 は `MeetingResult.highlightedStocks` を使う。
フィールド名マッピング:
- `scoreSummaries[].ticker` → `highlightedStocks[].ticker`
- `scoreSummaries[].averageScore` → `highlightedStocks[].averageScore`
- `scoreSummaries[].verdict` → `highlightedStocks[].verdict`
- `scoreSummaries[].agentScores` → `highlightedStocks[].agentScores`

```typescript
function formatScoringHtml(result: MeetingResult): string {
  if (result.highlightedStocks.length === 0) return "";

  const verdictColor = (verdict: string): string => {
    switch (verdict) {
      case "強気": return "#10b981";
      case "弱気": return "#ef4444";
      default: return "#f59e0b";
    }
  };

  const scoreColor = (score: number): string => {
    if (score >= 8) return "#10b981";
    if (score >= 6) return "#60a5fa";
    if (score >= 4) return "#f59e0b";
    return "#ef4444";
  };

  const rows = result.highlightedStocks.map((s) => { /* ... */ }).join("\n");
  // テーブル構造は v1.0 と同一
}
```

#### `formatResearchHtml()` v2.0 対応パターン (`src/report/generator.ts` lines 251-270 から踏襲):

v2.0 では WebSearch 結果 (`tmp/websearch/*.json`) を集約したデータを受け取る:
```typescript
interface WebSearchResult {
  readonly ticker: string;
  readonly researchSummary: string;
  readonly positiveFindings: ReadonlyArray<string>;
  readonly negativeFindings: ReadonlyArray<string>;
  readonly keyArticles: ReadonlyArray<{ readonly title: string; readonly summary: string }>;
  readonly researchedAt: string;
}

function formatWebSearchHtml(results: ReadonlyArray<WebSearchResult>): string {
  if (results.length === 0) return "";

  let html = "";
  for (const r of results) {
    html += `<div class="agent-card" style="border-left-color: #10b981;">
      <h4>${escapeHtml(r.ticker)}</h4>
      <p>${escapeHtml(r.researchSummary)}</p>
      <!-- positiveFindings / negativeFindings / keyArticles -->
    </div>`;
  }
  return `<hr><h2>WebSearch Research Results</h2>${html}`;
}
```

#### 再評価セクション HTML パターン (`src/report/generator.ts` lines 299-305 の `postResearchReviews` から踏襲):

```typescript
function formatReevalHtml(reevals: ReadonlyArray<ReevaluationOutput>): string {
  if (reevals.length === 0) return "";

  let html = "";
  for (const r of reevals) {
    html += `<div class="agent-card" style="border-left-color: #f59e0b;">
      <h4>${escapeHtml(r.agentRole)}</h4>
      <!-- 変更のあった銘柄の revised スコアと comment を表示 -->
    </div>`;
  }
  return `<hr><h2>再評価ラウンド結果（WebSearch後）</h2>${html}`;
}
```

#### `saveReports()` パターン (`src/report/generator.ts` lines 337-361 から踏襲):
```typescript
export async function saveReports(
  result: MeetingResult,
  webSearchResults: ReadonlyArray<WebSearchResult>,
  reevalResults: ReadonlyArray<ReevaluationOutput>,
): Promise<{ readonly reportPath: string; readonly minutesPath: string }> {
  const dateDir = join(REPORTS_DIR, result.date);
  await mkdir(dateDir, { recursive: true });

  const reportPath = join(dateDir, "daily-report.html");
  const minutesPath = join(dateDir, "meeting-minutes.html");

  await Promise.all([
    writeFile(reportPath, formatDailyReportHtml(result, webSearchResults, reevalResults), "utf-8"),
    writeFile(minutesPath, formatMeetingMinutesHtml(result, webSearchResults, reevalResults), "utf-8"),
  ]);

  await updateIndex(result.date);
  return { reportPath, minutesPath };
}
```

#### `updateIndex()` パターン (`src/report/generator.ts` lines 363-390 をそのまま踏襲):
```typescript
async function updateIndex(date: string): Promise<void> {
  const indexPath = join(REPORTS_DIR, "index.html");
  try {
    const html = await readFile(indexPath, "utf-8");
    if (html.includes(`>${date}<`)) return;
    const entryHtml = `<li class="report-item">
        <div class="report-date">${date}</div>
        <div class="report-links">
          <a href="${date}/daily-report.html">Daily Report</a>
          <a href="${date}/meeting-minutes.html">Meeting Minutes</a>
        </div>
      </li>`;
    const updated = html.replace(
      "<!-- REPORT_ENTRIES -->",
      `<!-- REPORT_ENTRIES -->\n      ${entryHtml}`,
    );
    await writeFile(indexPath, updated, "utf-8");
  } catch {
    console.error("Failed to update index.html");
  }
}
```

**初回実行時の注意:** `reports/` ディレクトリと `reports/index.html` が存在しない場合は `mkdir -p` + テンプレート HTML 生成が必要。v1.0 の `docs/` ディレクトリ構造を参照。

#### WebSearch/再評価結果の読み込みパターン:
```typescript
// tmp/websearch/ 配下の全 JSON を読み込む
async function loadWebSearchResults(): Promise<ReadonlyArray<WebSearchResult>> {
  const websearchDir = join(TMP_DIR, "websearch");
  try {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(websearchDir);
    const results = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          const raw = await readFile(join(websearchDir, f), "utf-8");
          return JSON.parse(raw) as WebSearchResult;
        }),
    );
    return results.filter((r): r is WebSearchResult => r !== null);
  } catch {
    return [];
  }
}
```

---

### `src/meeting/schemas.ts` (拡張: WebSearch + 再評価スキーマ追加)

**アナログ:** 同ファイル既存スキーマ (`src/meeting/schemas.ts` lines 1-101 の全体)

#### 既存スキーマのパターン踏襲 (lines 4-37):
```typescript
import { z } from "zod";

// 新規追加: WebSearch 結果スキーマ
export const webSearchResultSchema = z.object({
  ticker: z.string(),
  researchSummary: z.string(),
  positiveFindings: z.array(z.string()),
  negativeFindings: z.array(z.string()),
  keyArticles: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
    }),
  ),
  researchedAt: z.string(),
});

// 新規追加: 再評価出力スキーマ
export const reevaluationOutputSchema = z.object({
  agentId: z.string(),
  agentRole: z.string(),
  reevaluations: z.array(
    z.object({
      ticker: z.string(),
      originalScore: z.number().int().min(1).max(10),
      revisedScore: z.number().int().min(1).max(10),
      comment: z.string(),
      changed: z.boolean(),
    }),
  ),
});
```

注意: Zod スキーマは必ず `z.object()` + フィールド名はキャメルケース（既存パターン踏襲）。
`z.enum()` は v1.0 の `verdict` フィールドで使用済み（lines 57-58 参照）。
バリデーション関数は既存の `validateMeetingResult` と同じ形式:
```typescript
export function validateWebSearchResult(data: unknown): WebSearchResult {
  return webSearchResultSchema.parse(data) as WebSearchResult;
}
```

---

### `src/meeting/types.ts` (拡張: WebSearchResult + ReevaluationOutput 型追加)

**アナログ:** 同ファイル既存型定義 (`src/meeting/types.ts` lines 1-82 の全体)

#### `readonly` パターン踏襲 (types.ts lines 1-35 全体):
```typescript
// 新規追加: WebSearch 結果型
export interface WebSearchResult {
  readonly ticker: string;
  readonly researchSummary: string;
  readonly positiveFindings: ReadonlyArray<string>;
  readonly negativeFindings: ReadonlyArray<string>;
  readonly keyArticles: ReadonlyArray<{
    readonly title: string;
    readonly summary: string;
  }>;
  readonly researchedAt: string;
}

// 新規追加: 再評価出力型
export interface ReevaluationOutput {
  readonly agentId: string;
  readonly agentRole: string;
  readonly reevaluations: ReadonlyArray<{
    readonly ticker: string;
    readonly originalScore: number;
    readonly revisedScore: number;
    readonly comment: string;
    readonly changed: boolean;
  }>;
}
```

注意: 全フィールドを `readonly` にする（coding-style.md 準拠、types.ts の一貫パターン）。
ネストされたオブジェクトも `ReadonlyArray<{ readonly ... }>` とする。

---

## Shared Patterns

### Bloomberg 風 CSS スタイル
**ソース:** `src/report/generator.ts` lines 55-158
**適用先:** `src/scripts/generate-report.ts`
```typescript
// HTML_STYLES 定数をそのままコピー。
// ダークテーマ (#0f0f1a 背景、#3b82f6 アクセント)
// .agent-card, .discussion-card, .timestamp クラス定義含む
// h1: border-bottom 2px solid #3b82f6
// h2: border-left 4px solid #3b82f6 + color #60a5fa
```

### `markdownToHtml()` + `escapeHtml()`
**ソース:** `src/report/generator.ts` lines 7-53
**適用先:** `src/scripts/generate-report.ts`（XSS 防止のため必ず `escapeHtml` を通す）
```typescript
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
```

### `readonly` + `ReadonlyArray` イミュータブルパターン
**ソース:** `src/meeting/types.ts` 全体
**適用先:** `src/meeting/types.ts` の新規型定義、`src/scripts/generate-report.ts` の内部型

### Zod バリデーションパターン
**ソース:** `src/meeting/schemas.ts` lines 4-101
**適用先:** 新規スキーマ (`webSearchResultSchema`, `reevaluationOutputSchema`)
- `z.array()` で配列、`z.object()` でオブジェクト、`z.enum()` で列挙型
- `z.number().int().min(1).max(10)` でスコア範囲バリデーション
- バリデーション関数は `parse(data) as Type` のシングルライナー

### エントリポイントパターン
**ソース:** `src/index.ts` lines 125-128
**適用先:** `src/scripts/generate-report.ts`
```typescript
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

### `Promise.all` 並列書き込みパターン
**ソース:** `src/report/generator.ts` lines 353-356
**適用先:** `src/scripts/generate-report.ts` の `saveReports()`
```typescript
await Promise.all([
  writeFile(reportPath, reportContent, "utf-8"),
  writeFile(minutesPath, minutesContent, "utf-8"),
]);
```

### 進捗出力パターン
**ソース:** invest.md 各ステップの表示指示
**適用先:** `src/scripts/generate-report.ts`
```typescript
console.log("レポート生成中...");
console.log(`レポート生成完了: ${reportPath}`);
```

### `import.meta.dirname` パスパターン
**ソース:** `src/report/generator.ts` line 5、`src/scripts/validate-meeting.ts` line 5
**適用先:** `src/scripts/generate-report.ts`
```typescript
const TMP_DIR = join(import.meta.dirname, "../../tmp");
const REPORTS_DIR = join(import.meta.dirname, "../../reports");
```
`src/scripts/` 配置のため `../../` で2階層上がる（Phase 1 PATTERNS.md と同様）。

---

## 中間ファイル構成（tmp/ 配下）

| ファイル/ディレクトリ | 生成者 | 消費者 | フォーマット |
|---------------------|-------|--------|------------|
| `tmp/meeting-result.json` | Step 2 (Phase 2) | Step 3a, generate-report.ts | `MeetingResult` 型 |
| `tmp/websearch/{ticker}.json` | Step 3a WebSearch Agent | Step 3b, generate-report.ts | `WebSearchResult` 型 |
| `tmp/reeval/{agentId}.json` | Step 3b 再評価 Agent | generate-report.ts | `ReevaluationOutput` 型 |
| `reports/YYYY-MM-DD/daily-report.html` | generate-report.ts | ユーザー | HTML |
| `reports/YYYY-MM-DD/meeting-minutes.html` | generate-report.ts | ユーザー | HTML |

---

## アナログが存在しないパターン

| ファイル/機能 | Role | Data Flow | 理由 |
|-------------|------|-----------|------|
| WebSearch Agent の検索クエリ設計 | agent-prompt | event-driven | コードベースに WebSearch 利用例なし。CONTEXT.md D-03 の「WebSearch + WebFetch」をベースに設計 |
| `reports/` ディレクトリの index.html テンプレート | static-asset | — | v1.0 は `docs/index.html` が手動作成済み。v2.0 は `reports/` に変更するため新規作成が必要 |
| WebSearch 結果の `tmp/websearch/` ディレクトリ初期化 | file-I/O | — | Phase 2 の `tmp/round-1/` 初期化 (invest.md line 59-61) と同様の `mkdir -p` Bash コマンドを Step 3 冒頭に追加 |

---

## Metadata

**アナログ検索スコープ:** `/Users/arai/invest/src/`, `/Users/arai/invest/.claude/commands/`
**スキャンファイル数:** 7
**パターン抽出日:** 2026-06-24
