# Phase 2: Analyst Subagents - Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 9 (既存ファイル参照)
**Analogs found:** 3 / 3

---

## File Classification

| 新規/修正ファイル | Role | Data Flow | 最近傍アナログ | Match Quality |
|-----------------|------|-----------|--------------|---------------|
| `.claude/commands/invest.md` (Step 2 修正) | skill (orchestrator) | Agent spawn → JSON file | `.claude/commands/invest.md` Step 1 | strong-match (同一ファイル内の既存Bashパターンの拡張) |
| `tmp/meeting-result.json` (出力スキーマ) | data (output contract) | written-by-skill, read-by-Phase3 | `src/agents/types.ts` の `MeetingRecord` | role-match (MeetingRecordがPhase 2出力の直接ベース) |
| `src/meeting/runner.ts` (参照・廃止予定) | orchestrator (v1.0) | sequential Gemini calls → MeetingRecord | — | analog-source (Phase 2のAgent-toolベースに置き換えられる) |

---

## Pattern Assignments

### `.claude/commands/invest.md` Step 2 (skill, Agent spawn orchestration)

**アナログ:** 同ファイル Step 1 + `src/meeting/runner.ts`

#### Agent tool 並列スポーンパターン

Phase 2のStep 2は、5つのAgentツール呼び出しを同一メッセージ内に並置して並列実行する。
`src/meeting/runner.ts` lines 360-363 の `Promise.all` パターンの Agent-tool 版:

```typescript
// v1.0 の Promise.all パターン（runner.ts lines 360-363）
const presentations = await Promise.all(
  analysisAgents.map((agent) => getAgentAnalysis(agent, marketContext)),
);
```

スキルコマンドでの対応パターン（マークダウン擬似コード — 実際はLLMが複数Agent toolを同時発行する）:

```
// 以下5つのAgentツールを同一メッセージで並列発行する（D-07）
Agent: fundamentals-analyst (model: opus)
  prompt: <systemPrompt from src/agents/fundamentals.ts> + Round 1分析指示 + market.json + portfolio.json

Agent: ten-bagger-hunter (model: opus)
  prompt: <systemPrompt from src/agents/tenbagger.ts> + Round 1分析指示 + market.json + portfolio.json

Agent: macro-economist (model: opus)
  prompt: <systemPrompt from src/agents/macro.ts> + Round 1分析指示 + market.json + news.json

Agent: technical-strategist (model: opus)
  prompt: <systemPrompt from src/agents/technical.ts> + Round 1分析指示 + market.json + portfolio.json

Agent: risk-manager (model: opus)
  prompt: <systemPrompt from src/agents/risk-manager.ts> + Round 1分析指示 + market.json + news.json + portfolio.json
```

#### データスコーピング（invest.md コメントから確定済み）

`invest.md` lines 54-86 に既定のデータスコーピングをそのまま踏襲する:

| アナリスト | 使用JSONファイル |
|-----------|---------------|
| fundamentals | tmp/market.json + tmp/portfolio.json |
| tenbagger | tmp/market.json + tmp/portfolio.json |
| macro | tmp/market.json + tmp/news.json |
| technical | tmp/market.json + tmp/portfolio.json |
| risk-manager | tmp/market.json + tmp/news.json + tmp/portfolio.json |

#### 3ラウンド制ミーティング構造パターン

`runner.ts` が確立した3フェーズ＋統合のシーケンスをスキルコマンドの逐次ステップに写像する:

```
# runner.ts の構造 → スキルコマンドStep 2の構造
Round 1: presentations = Promise.all(analysisAgents.map(getAgentAnalysis))
         ↓
         Step 2a: 5アナリスト並列スポーン（Round 1: 分析プレゼンテーション）

Round 2: discussion = Promise.all(analysisAgents.map(getDiscussionComments))
         ↓
         Step 2b: 5アナリスト並列スポーン（Round 2: 相互ディスカッション）
         ※ 各アナリストに他4人の出力を入力として渡す

Scoring: scorings = Promise.all(analysisAgents.map(getAgentScoring))
         ↓
         Step 2c: 5アナリスト並列スポーン（Round 3: 銘柄スコアリング）

Final:   generateFinalSummary → moderatorAgent
         ↓
         Step 2d: モデレーターAgentスポーン（シングル、統合レポート生成）
```

#### ラウンド間の中間モデレーター介入パターン（D-08）

`runner.ts` lines 381-388 の銘柄抽出ロジックに対応する。スキルコマンドでは、
Round 1完了後にモデレーターAgentを呼び出して言及頻度の高い銘柄ティッカーを抽出し、
その結果をRound 2・Round 3の入力として渡す:

```typescript
// runner.ts の銘柄抽出（lines 381-388）
const allAnalysisTexts = [
  ...presentations.map((p) => p.analysis),
  ...discussion.map((d) => d.comment),
];
const researchResults = await extractAndResearchStocks(allAnalysisTexts);
const tickers = researchResults.map((r) => r.ticker);
```

Phase 2スキルコマンドでは `extractAndResearchStocks`（Gemini依存）を使わず、
モデレーターAgentに5人の分析テキストを渡して、銘柄名+ティッカーのJSON配列を返させる（D-06）。

#### Bashステップとの混在パターン

`invest.md` Step 1 が Bash でデータ収集するように、Step 2もBashで確認コマンドを挟む:

```bash
# Step 1 のパターン（invest.md lines 32-43）
cd /Users/arai/invest && node -e "
const fs = require('fs');
const market = JSON.parse(fs.readFileSync('tmp/market.json', 'utf-8'));
// ...
"
```

Step 2完了後の確認コマンドで同様に `tmp/meeting-result.json` の存在と構造を検証する。

---

### `tmp/meeting-result.json` 出力スキーマ (data, output contract)

**アナログ:** `src/agents/types.ts` の `MeetingRecord` + `StockScoreSummary`

#### 既存型定義の直接参照

`src/agents/types.ts` の `MeetingRecord`（lines 57-65）が meeting-result.json の骨格:

```typescript
// types.ts lines 57-65
export interface MeetingRecord {
  readonly date: string;
  readonly marketDataSummary: string;
  readonly rounds: ReadonlyArray<MeetingRound>;
  readonly researchResults: ReadonlyArray<StockResearchResult>;
  readonly postResearchReviews: ReadonlyArray<MeetingComment>;
  readonly scoreSummaries: ReadonlyArray<StockScoreSummary>;
  readonly finalSummary: string;
}
```

Phase 2の `tmp/meeting-result.json` はこの構造をベースに、各アナリストの生JSON出力を
`rounds[].presentations[].analysis` の代わりに構造化JSONとして格納する（D-01, D-02）。

#### スコアリングスキーマパターン

`StockScoreSummary`（types.ts lines 46-55）がスコア統合の型参照:

```typescript
// types.ts lines 46-55
export interface StockScoreSummary {
  readonly ticker: string;
  readonly averageScore: number;
  readonly verdict: "強気" | "中立" | "弱気";
  readonly agentScores: ReadonlyArray<{
    readonly agentRole: string;
    readonly score: number;
    readonly reason: string;
  }>;
}
```

スコア判定ロジック（runner.ts lines 248-250）をモデレーターAgentのプロンプトに埋め込む:
- 平均7以上 → 強気
- 平均4〜6.9 → 中立
- 平均4未満 → 弱気

#### イミュータブル型パターン

`types.ts` 全体が `readonly` フィールドで統一されている。Phase 2が新たに定義する
アナリスト固有フィールドも同様の `readonly` パターンを踏襲する（coding-style.md準拠）。

---

### 各アナリストのAgent promptパターン (systemPrompt再利用)

**アナログ:** `src/agents/*.ts` の各 `AgentProfile`

#### systemPrompt 再利用パターン

全6エージェントが同一の `AgentProfile` インターフェース（types.ts lines 1-6）を実装し、
`systemPrompt` フィールドに自己完結したロール定義を持つ。Phase 2ではこれをAgent toolの
`prompt` の先頭ブロックとしてそのまま埋め込む:

```typescript
// types.ts lines 1-6
export interface AgentProfile {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly systemPrompt: string;
}
```

各エージェントのsystemPromptには共通の末尾指示「日本語で回答する」が含まれており、
Phase 2でも出力言語日本語を維持する（D-03）。

#### Round別プロンプト構造パターン

`runner.ts` の3つの関数がRound別プロンプトテンプレートを持つ。Phase 2のスキルコマンドで
AgentのpromptはこれらをLLMの指示テキストとして再現する:

**Round 1: getAgentAnalysis (runner.ts lines 56-77)**
```
以下の市場データとニュースを分析し、あなたの専門的視点から投資判断に役立つ分析を提供してください。

[market/news/portfolio JSON]

1. 全体的な市場認識
2. あなたの専門領域からの注目ポイント
3. 具体的な銘柄やセクターの推奨
4. 注意すべきリスクや懸念点
```

**Round 2: getDiscussionComments (runner.ts lines 96-122)**
```
以下は他のチームメンバーの分析です。あなたの専門的視点から、
同意する点、異議がある点、補足したい点をコメントしてください。

[他4人のRound 1出力]

簡潔に（500文字以内）、最も重要なポイントに絞ってコメントしてください。
```

**Round 3: getAgentScoring (runner.ts lines 161-223)**
```
以下の銘柄それぞれに対して10段階で投資評価を行ってください。

評価対象銘柄: [tickers]
[市場データ + ディスカッション]

出力形式: TICKER|スコア(1-10)|理由(30文字以内)
```

**モデレーター統合: generateFinalSummary (runner.ts lines 260-350)**
```
以下はチームミーティングの全内容です。投資家向けの最終レポートを作成してください。

[全ラウンドの内容 + scoreSummaries]

1. エグゼクティブサマリー
2. 注目銘柄リスト（強気/中立/弱気）
3. セクター推奨ランキング
4. 今週の注目イベント
5. リスク要因
6. アクションアイテム
7. 米国株インデックス戦略
```

---

## テストパターン

**アナログ:** `src/scripts/collect-data.test.ts`

Phase 2のテスト対象はスキルコマンド（`invest.md`）自体ではなく、
スキルが書き出す `tmp/meeting-result.json` のスキーマ検証になる。
Phase 1のテストパターンを踏襲する:

```typescript
// collect-data.test.ts のviテストパターン（lines 1-7）
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Phase 2では Agent tool のモックが必要（スキル内で直接呼ばれないため
// tmp/meeting-result.json の内容を検証するintegration-styleテストが主体になる）
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));
```

---

## Shared Patterns

### `readonly` イミュータブル型パターン
**ソース:** `src/agents/types.ts` 全体
**適用先:** `tmp/meeting-result.json` のスキーマ型定義（新規作成する場合）
```typescript
export interface AnalystOutput {
  readonly agentId: string;
  readonly round: 1 | 2 | 3;
  readonly summary: string;
  readonly highlights: ReadonlyArray<string>;
  readonly risks: ReadonlyArray<string>;
  readonly picks?: ReadonlyArray<PickEntry>;  // 固有フィールド（D-01）
}
```

### `Promise.all` 並列実行 → Agent tool 並列発行への写像
**ソース:** `runner.ts` lines 360-363、368-371、397-403、409-419
**適用先:** スキルコマンド Step 2 の各ラウンド
```typescript
// v1.0 (runner.ts)
const presentations = await Promise.all(analysisAgents.map(getAgentAnalysis));
// ↓ Phase 2 スキルコマンド内LLMの行動
// 5つのAgent toolを同一ターンで並列発行
```

### グレースフルデグラデーションパターン
**ソース:** `src/data/market.ts` lines 55-65、`runner.ts` lines 393-402
**適用先:** 個別アナリストAgentの失敗時（スキルコマンド内でエラー処理を明示）
```typescript
// runner.ts の個別失敗継続パターン（lines 393-403）
if (researchResults.length > 0) {
  postResearchReviews = await Promise.all(
    analysisAgents.map((agent) => getPostResearchReview(...)),
  );
}
```
Phase 2: 5人中1人のAgentが失敗しても、残り4人の結果でミーティングを続行する。
失敗したアナリストの出力は `null` としてモデレーターに伝える。

### 進捗出力パターン
**ソース:** `runner.ts` lines 359、366、381、395、407、428
**適用先:** スキルコマンドの各ラウンド開始・完了時のユーザー向けメッセージ
```typescript
console.log("Round 1: 各エージェントが分析を発表中...");
console.log("Round 2: ディスカッション中...");
console.log("モデレーターが最終レポートを作成中...");
```

---

## Key Integration Points

| 統合ポイント | ソース | ターゲット | 注意点 |
|------------|--------|----------|--------|
| tmp/*.json 読み込み | Phase 1 出力 | 各アナリストAgent prompt | JSONをテキストとしてpromptに埋め込む。サイズが大きい場合は要約を優先 |
| systemPrompt 再利用 | `src/agents/*.ts` | Agent prompt の先頭ブロック | そのまま貼り付け可能。末尾の「日本語で回答する」を維持 |
| スコア判定ロジック | `runner.ts` lines 248-250 | モデレーターAgent prompt | 強気≥7、中立4-6.9、弱気<4 の閾値をpromptに明記 |
| MeetingRecord型 | `src/agents/types.ts` | tmp/meeting-result.json スキーマ | フィールド名はv1.0踏襲。rounds配列の内容がAgent出力JSONに変わる |
| invest.md Step 3 連携 | Phase 2 出力 | Phase 3 (レポート生成) | tmp/meeting-result.json が唯一の受け渡しIFC |

---

## アナログが存在しないパターン

### Agent tool のschemaパラメータによるJSON強制（D-02）
v1.0は `generateText` の返り値を自由テキストとして扱い、スコアリングのみ `TICKER|スコア|理由` 形式で構造化していた（runner.ts lines 197-215）。Phase 2でAgent toolの `schema` パラメータを使う場合は、現状のコードベースに直接アナログが存在しない。

**参照先:** 02-CONTEXT.md D-02「Agent toolの `schema` パラメータで構造化JSONを強制」
**推奨:** スキルコマンドのプロンプトでJSONスキーマを明示的に指示することで代替可能。`schema` パラメータの詳細はClaude Agent SDK ドキュメントを参照すること。

---

## Metadata

**アナログ検索スコープ:** `/Users/arai/invest/src/`, `/Users/arai/invest/.claude/commands/`
**スキャンファイル数:** 9
**パターン抽出日:** 2026-06-24
