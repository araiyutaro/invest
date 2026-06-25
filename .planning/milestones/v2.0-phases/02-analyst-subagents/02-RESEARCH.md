# Phase 2: Analyst Subagents - Research

**Researched:** 2026-06-24
**Domain:** Claude Code Agent tool マルチラウンドミーティング + 構造化JSON出力
**Confidence:** HIGH

---

## 1. Existing Architecture Analysis

### v1.0 ミーティングフロー（src/meeting/runner.ts から）

v1.0は以下のシーケンシャル+並列フローで動作する:

```
Round 1 (分析): Promise.all(5 agents × getAgentAnalysis)
Round 2 (ディスカッション): Promise.all(5 agents × getDiscussionComments)
Research Round: extractAndResearchStocks (Google検索)
Post-Research Review: Promise.all(5 agents × getPostResearchReview) [researchResults > 0 の場合]
Scoring Round: Promise.all(5 agents × getAgentScoring) [tickers > 0 の場合]
Final: generateFinalSummary (モデレーター)
```

v1.0では全て Gemini API (`generateText`, `generateTextLight`) を直接呼ぶ関数ベース。
v2.0ではこれを **Claude Code Agent tool** の呼び出しに置き換える。

### 各ラウンドの入出力マッピング

| ラウンド | v1.0 関数 | v2.0 対応 | 入力 | 出力型 |
|---------|----------|----------|------|--------|
| Round 1 | `getAgentAnalysis()` | Agent tool (opus) | market.json, news.json, portfolio.json | `AnalystRound1Output` |
| Round 2 | `getDiscussionComments()` | Agent tool (sonnet推奨) | Round 1 全結果 | `AnalystRound2Output` |
| Moderator-1 | なし | Agent tool (opus) | Round 1 全結果 | `ticker[]` (スコア対象銘柄) |
| Round 3 | `getAgentScoring()` | Agent tool (sonnet推奨) | Round 1+2 結果 + tickers | `AnalystRound3Output` |
| Moderator-2 | `generateFinalSummary()` | Agent tool (opus) | 全ラウンド結果 | `MeetingResultJson` |

**注意:** v1.0の Research Round (Web検索) は Phase 2 のスコープ外。スコア対象銘柄の抽出はモデレーターが Round 1+2 テキストから行う（D-06）。

### 既存の再利用可能アセット

1. **`src/agents/*.ts` の systemPrompt** — 6エージェント全員のプロンプトをそのまま Agent tool の prompt パラメータに埋め込む。修正不要。
2. **`src/agents/types.ts` の型定義** — `StockScoreSummary` の構造（ticker, averageScore, verdict, agentScores）が v2.0 の meeting-result.json のベースになる。
3. **データスコーピング定義** — `.claude/commands/invest.md` のコメント部分に各アナリスト×JSONファイルの対応が定義済み。

---

## 2. Implementation Patterns

### Pattern A: Agent tool でのアナリスト並列実行

スキル（invest.md）は、1ラウンド分の5アナリストを一つのメッセージで並列 Agent tool call として実行する。

```markdown
<!-- スキル内の記述パターン -->

5アナリストを並列実行してください（全て同時に Agent tool を呼び出す）:

- **ファンダメンタルズアナリスト**: [systemPrompt] + [市場データ] + [portfolio.json の内容]
  schema: AnalystRound1Output
  model: opus

- **テンバガーハンター**: [systemPrompt] + [市場データ] + [portfolio.json の内容]
  schema: AnalystRound1Output
  model: opus

... (5エージェント分)
```

各エージェントの prompt には以下を含める:
1. そのエージェントの `systemPrompt` 全文
2. 必要な tmp/*.json ファイルの内容（スキル内で Read ツールで先読みして埋め込む）
3. 出力フォーマットの指示（schema パラメータで強制するため簡潔でよい）

### Pattern B: スキル内でのラウンド間データ受け渡し

各ラウンドの結果は `tmp/round-N/` に書き込み、次のラウンドのエージェントプロンプトに埋め込む:

```
tmp/
├── market.json         (Phase 1 出力)
├── news.json           (Phase 1 出力)
├── portfolio.json      (Phase 1 出力)
├── round-1/
│   ├── fundamentals.json
│   ├── tenbagger.json
│   ├── macro.json
│   ├── technical.json
│   └── risk-manager.json
├── round-2/
│   ├── fundamentals.json
│   ├── tenbagger.json
│   ├── macro.json
│   ├── technical.json
│   └── risk-manager.json
├── round-3/
│   ├── fundamentals.json
│   ├── tenbagger.json
│   ├── macro.json
│   ├── technical.json
│   └── risk-manager.json
├── moderator-tickers.json   (Round 1後のモデレーター抽出結果)
└── meeting-result.json      (Phase 2 の最終出力)
```

**スキルのオーケストレーション制御ポイント:**
- ラウンド間はスキル自身（メイン Claude セッション）が制御する
- ラウンド N の結果ファイルを読み込み → ラウンド N+1 の Agent prompt に埋め込む
- 中間ファイルは `tmp/` に毎回上書き（Phase 1 の D-04 踏襲）

### Pattern C: モデレーター介入（銘柄抽出）の実装方式

D-08 は「モデレーターが各ラウンド後に介入」を指定しているが、D-09 の中間介入実装方式はClaude裁量（DISCUSSION-LOG.md参照）。

**推奨:** Round 1後のモデレーター介入は **スキル内のテキスト処理** で実装し、フル Agent tool call は使わない。理由:
- 銘柄抽出は「ティッカー文字列の正規表現マッチ + 出現頻度カウント」で十分
- Agent tool を追加で呼ぶコストとレイテンシを避ける
- ただし Round 1 のモデレーター（論点整理）と Round 3 後のモデレーター（最終統合）は Agent tool を使う

**代替:** 銘柄抽出もモデレーター Agent tool に任せる（精度は上がるがコスト増）。プランナーが判断する。

### Pattern D: エラーハンドリング戦略

v1.0のグレースフルデグラデーション（D-08）をスキルレベルで踏襲:
- 個別アナリストの Agent tool 失敗 → そのエージェントの結果をスキップして残りで続行
- Round 2, 3 は Round 1 の成功分のみで実行
- モデレーター最終統合は「利用可能な結果のみ」で実行
- 全アナリストが失敗した場合のみパイプライン停止

### Pattern E: データスコーピング（各アナリストへのJSON渡し方）

スキルは Agent prompt に tmp/*.json の内容を直接埋め込む（Read ツールで先読みして文字列化）:

```markdown
以下のデータを分析してください:

## 市場データ (tmp/market.json)
{market_json_content}

## ポートフォリオデータ (tmp/portfolio.json)  
{portfolio_json_content}
```

**注意:** news.json は大きくなる可能性があるため、マクロエコノミストとリスクマネージャーのみに渡す（Phase 1 のデータスコーピング定義踏襲）。

---

## 3. JSON Schema Design

### 3.1 共通フィールド（全アナリスト）

```typescript
interface AnalystRound1Output {
  agentId: string;           // "fundamentals" | "tenbagger" | "macro" | "technical" | "risk-manager"
  agentRole: string;         // 日本語ロール名
  summary: string;           // 全体サマリー（300文字以内）
  highlights: string[];      // 注目ポイントのリスト（3-5項目）
  risks: string[];           // リスク・懸念点のリスト（2-4項目）
  picks: StockPick[];        // 推奨銘柄（0件以上）
  sectorView: string;        // セクター見通し（1-2文）
}

interface StockPick {
  ticker: string;            // "AAPL", "7203.T" 等
  direction: "強気" | "中立" | "弱気";
  rationale: string;         // 推奨理由（100文字以内）
}
```

**確信度スコアは採用しない。** 理由: LLMの自己確信度はキャリブレーションが難しく（D-03の DISCUSSION-LOG 参照）、スコアリングラウンド（Round 3）で数値評価を実施するため冗長。

### 3.2 アナリスト固有フィールド

```typescript
// ファンダメンタルズアナリスト固有
interface FundamentalsExtra {
  valuationComment: string;  // バリュエーション評価コメント
  qualityFlags: string[];    // "PER割安", "高ROE", "財務健全" 等のフラグ
}

// テンバガーハンター固有
interface TenbaggerExtra {
  growthTheme: string;       // 注目テーマ ("AI", "バイオテック" 等)
  potentialMultiple: string; // "3-5倍", "10倍以上" 等（テキスト）
}

// マクロエコノミスト固有
interface MacroExtra {
  rateOutlook: string;       // 金利見通し（1文）
  fxImpact: string;          // 円ドル為替への影響（1文）
  sectorRanking: string[];   // セクター推奨順位（上位3-5）
}

// テクニカルストラテジスト固有
interface TechnicalExtra {
  marketTrend: "上昇" | "下降" | "レンジ";
  keyLevels: string;         // 主要サポート/レジスタンス（1-2文）
  entryComment: string;      // エントリータイミングコメント
}

// リスクマネージャー固有
interface RiskManagerExtra {
  topRisks: string[];        // 最重要リスク（3項目）
  hedgeSuggestion: string;   // ヘッジ提案（1-2文）
  sentimentAlert: "警戒" | "中立" | "良好";
}
```

### 3.3 Round 2 出力スキーマ

```typescript
interface AnalystRound2Output {
  agentId: string;
  comment: string;           // 他アナリスト全員へのコメント（500文字以内、v1.0踏襲）
  agreements: string[];      // 同意する点（1-3項目）
  disagreements: string[];   // 異議がある点（1-3項目）
}
```

### 3.4 Round 3 出力スキーマ（スコアリング）

```typescript
interface AnalystRound3Output {
  agentId: string;
  agentRole: string;
  scores: StockScore[];
}

interface StockScore {
  ticker: string;
  score: number;             // 1-10 整数
  reason: string;            // 30文字以内（v1.0踏襲）
}
```

### 3.5 meeting-result.json スキーマ（Phase 3 消費）

```typescript
interface MeetingResult {
  date: string;              // "YYYY-MM-DD"
  generatedAt: string;       // ISO 8601 timestamp
  
  // 市場総覧
  marketOverview: {
    summary: string;         // エグゼクティブサマリー（3-5文）
    trend: "上昇" | "下降" | "混合";
    keyIndices: Array<{
      name: string;
      changePercent: number;
    }>;
  };
  
  // セクター推奨
  sectorRecommendations: Array<{
    rank: number;
    sector: string;
    rationale: string;
    outlook: "強気" | "中立" | "弱気";
  }>;
  
  // 注目銘柄（スコア付き）
  highlightedStocks: Array<{
    ticker: string;
    averageScore: number;    // 1.0-10.0
    verdict: "強気" | "中立" | "弱気";
    summary: string;         // モデレーターによる統合コメント
    agentScores: Array<{
      agentRole: string;
      score: number;
      reason: string;
    }>;
    nominatedBy: string[];   // このエージェントが Round 1 で推奨した
  }>;
  
  // リスク警告
  riskWarnings: Array<{
    severity: "高" | "中" | "低";
    description: string;
  }>;
  
  // アクションアイテム
  actionItems: string[];     // 投資家がすべき具体的なアクション
  
  // 今週のイベント
  weeklyEvents: Array<{
    date: string;            // "YYYY-MM-DD" または "未定"
    event: string;
    impact: "高" | "中" | "低";
  }>;
  
  // インデックス投資家向け
  indexInvestorAdvice: string;  // v1.0の「米国株インデックス戦略」セクション相当
  
  // デバッグ用（Phase 3で使用しない）
  roundSummary: {
    round1Count: number;     // Round 1 成功エージェント数
    round2Count: number;
    round3Count: number;
    scoredTickers: string[];
  };
}
```

---

## 4. Open Questions（プランナーへの委任事項）

### OQ-1: ラウンド2/3のモデル選択
**Context:** D-10/D-11でRound 1とモデレーターはopus確定。D-03の裁量でRound 2/3はClaude任せ。
**Tradeoff:**
- 全ラウンドopus: 品質最優先、コスト最大（5エージェント×3ラウンド = 15 opus呼び出し）
- Round 2-3をsonnet: コスト削減（15 opus → 5 opus + 10 sonnet）、品質は若干低下
**Recommendation:** Round 2（ディスカッション）はsonnet、Round 3（スコアリング）もsonnet。スコアリングは数値出力が主で推論深度の寄与が小さい。

### OQ-2: モデレーター中間介入の実装（Pattern C 参照）
**Context:** D-08で各ラウンド後にモデレーターが介入。D-09の中間介入方式はClaude裁量。
**Tradeoff:**
- スキル内テキスト処理（正規表現）: 高速・低コスト、抽出精度が劣る可能性
- Agent tool（モデレーター）: 精度高い、追加コスト発生
**Recommendation:** 銘柄抽出は正規表現で十分（ティッカーは `[A-Z]{1,5}(\.[A-Z]{1,2})?` や日本株は `\d{4}\.T` で抽出可能）。ただし Round 2 後の論点整理は Agent tool を使う（論点の抽象化には LLM が必要）。

### OQ-3: Agent tool の schema パラメータの実際の挙動確認
**Context:** D-02で「Agent toolのschemaパラメータで構造化JSONを強制」と決定。
**What's unclear:** Claude Code の Agent tool が `schema` パラメータをサポートしているかどうかの確認が必要。Claude API の tool_use 機能とは異なる可能性がある。
**Risk:** schemaパラメータが使えない場合、プロンプトで「以下のJSONフォーマットで回答してください」と指示する代替手段に切り替える。
**Action:** PLAN.md で実装者が最初に schema パラメータ動作確認タスクを設けること。

### OQ-4: スキル内での大容量プロンプトの制約
**Context:** news.json は記事数が多い場合（100件以上）に非常に大きくなる。
**What's unclear:** Agent tool の prompt 引数に渡せる最大文字数に制限があるか。
**Mitigation:** ニュースは最新 50 件に絞る、または記事タイトルと要約のみ渡す（本文を除外）。プランナーが実装時に対応する。

---

## 5. Pitfalls

### Pitfall 1: Agent tool の並列呼び出しは1メッセージで行う
**What goes wrong:** スキルが5エージェントを順次（sequential）で呼ぶと、各エージェントの待ち時間が直列に加算される（5倍遅い）。
**Why it happens:** 実装者がデフォルトで順次実行してしまう。
**How to avoid:** スキルの指示文に「5エージェントを**同時に**（一つのメッセージで）Agent tool を呼び出す」と明記する。AGENT-08要件（並列実行）の実現に必須。

### Pitfall 2: Round 2の入力サイズ爆発
**What goes wrong:** Round 2 では各アナリストが他の4人の Round 1 分析全文を読む。5エージェント×Round1出力が1プロンプトに入ると、大量のトークンを消費する。
**Why it happens:** v1.0の `getDiscussionComments()` と同じ設計を踏襲するため。
**How to avoid:** Round 2エージェントに渡す Round 1 結果は、`highlights` と `picks` フィールドのみに限定する（`summary` の詳細は除外）。または各分析を500文字以内に要約してから渡す。

### Pitfall 3: tmp/round-N/ ディレクトリの未作成エラー
**What goes wrong:** `tmp/round-1/fundamentals.json` への書き込みで `ENOENT` が発生する。
**Why it happens:** `mkdir -p tmp/round-1` を忘れる。
**How to avoid:** スキルの Round 1 開始前に `mkdir -p tmp/round-1 tmp/round-2 tmp/round-3` を Bash ツールで実行する。

### Pitfall 4: スコアリング対象銘柄が0件になる
**What goes wrong:** Round 1/2 で言及銘柄が抽出できず、Round 3 がスキップされる。
**Why it happens:** アナリストが ticker 形式（"AAPL" 等）を使わず銘柄名のみで言及する場合。
**How to avoid:** Round 1 の `picks` フィールドに `ticker` を必須として構造化JSONで強制する（D-02の schema パラメータ）。ティッカーが空の場合は `"UNKNOWN"` ではなく省略させる。

### Pitfall 5: meeting-result.json のスキーマと Phase 3 の期待の不一致
**What goes wrong:** Phase 3（レポート生成）が `meeting-result.json` の特定フィールドを期待するが、Phase 2 の出力スキーマが異なる。
**Why it happens:** Phase 2 と Phase 3 を独立して実装するとスキーマの齟齬が生まれる。
**How to avoid:** Phase 2 の PLAN.md で `meeting-result.json` の最終スキーマを確定させ、Phase 3 の PLAN.md でそれを canonical reference として参照させる。本 RESEARCH.md の Section 3.5 がその仕様書となる。

### Pitfall 6: Agent tool の schema パラメータ非サポート
**What goes wrong:** `schema` パラメータを指定しても構造化出力が保証されず、自由テキストが返る。
**Why it happens:** Claude Code の Agent tool が Claude API の tool_use 機能とは異なる実装の場合。
**How to avoid:** プロンプト内に `以下のJSONフォーマットで回答してください。他のテキストは出力しないでください。` を含め、JSON パースエラー時は `{}` をデフォルト値として使うフォールバック処理を実装する。

### Pitfall 7: 日本語ティッカーの正規表現マッチ
**What goes wrong:** `7203.T`（トヨタ）等の日本株ティッカーが正規表現で `7203` と `.T` に分割されてスコアリング結果のマッチングに失敗する。
**Why it happens:** v1.0 の `computeScoreSummaries()` が `includes()` で部分マッチしている（`runner.ts:231-234`）が、完全マッチには設計が必要。
**How to avoid:** 抽出した ticker は `Set<string>` で管理し、マッチングは `ticker === candidate || ticker.startsWith(candidate.split('.')[0])` のパターンを使う。

---

## 6. Package Legitimacy Audit

> 新規パッケージインストールなし — Phase 2 は既存依存関係のみで完結する。

| 要件 | 使用方法 | 既存パッケージ |
|------|---------|--------------|
| 構造化JSONスキーマ定義 | Agent tool の schema パラメータ、またはプロンプト内 JSON 仕様 | なし（Claude API ネイティブ） |
| JSON バリデーション | meeting-result.json の整合性確認 | `zod` 4.3.6（既存・未使用） |
| ファイル書き込み | tmp/round-N/*.json 出力 | `node:fs/promises`（Node.js 標準） |

**Phase 2 で新規インストールが必要なパッケージ: なし**

---

## 7. Orchestration Flow（実装参考図）

```
invest.md スキル（Phase 2 Step 2）
│
│ [Bash] mkdir -p /Users/arai/invest/tmp/round-1 round-2 round-3
│ [Read] tmp/market.json, tmp/news.json, tmp/portfolio.json を先読み
│
├── Round 1: 5アナリスト並列（全て同時に Agent tool 呼び出し）
│   ├── Agent: fundamentals (opus) → tmp/round-1/fundamentals.json
│   ├── Agent: tenbagger (opus)    → tmp/round-1/tenbagger.json
│   ├── Agent: macro (opus)        → tmp/round-1/macro.json
│   ├── Agent: technical (opus)    → tmp/round-1/technical.json
│   └── Agent: risk-manager (opus) → tmp/round-1/risk-manager.json
│
│ [スキル内ロジック] Round 1 結果から ticker を抽出 → tmp/moderator-tickers.json
│   (正規表現: [A-Z]{1,5}, \d{4}\.T パターン)
│
├── Round 2: 5アナリスト並列（sonnet推奨）
│   各エージェントへの input = Round 1 全員の highlights + picks (簡略版)
│   ├── Agent: fundamentals (sonnet) → tmp/round-2/fundamentals.json
│   ├── Agent: tenbagger (sonnet)    → tmp/round-2/tenbagger.json
│   ├── Agent: macro (sonnet)        → tmp/round-2/macro.json
│   ├── Agent: technical (sonnet)    → tmp/round-2/technical.json
│   └── Agent: risk-manager (sonnet) → tmp/round-2/risk-manager.json
│
│ [Moderator Agent] 論点整理（D-08: Round 2後介入）
│   Input: Round 1+2 全結果
│   Output: 論点サマリー（tmp/moderator-issues.json）
│
├── Round 3: 5アナリスト並列スコアリング（sonnet推奨）
│   各エージェントへの input = tmp/moderator-tickers.json のティッカーリスト
│   ├── Agent: fundamentals (sonnet) → tmp/round-3/fundamentals.json
│   ├── Agent: tenbagger (sonnet)    → tmp/round-3/tenbagger.json
│   ├── Agent: macro (sonnet)        → tmp/round-3/macro.json
│   ├── Agent: technical (sonnet)    → tmp/round-3/technical.json
│   └── Agent: risk-manager (sonnet) → tmp/round-3/risk-manager.json
│
└── [Moderator Agent] 最終統合（opus）
    Input: Round 1+2+3 全結果 + tmp/market.json (サマリー)
    Output: tmp/meeting-result.json
```

---

## Sources

### Primary (HIGH confidence)
- `src/meeting/runner.ts` — v1.0ミーティングフロー、直接コード読解
- `src/agents/*.ts` — 全6エージェントのsystemPrompt、直接コード読解
- `src/agents/types.ts` — 既存型定義、直接コード読解
- `.planning/phases/02-analyst-subagents/02-CONTEXT.md` — Phase 2 決定事項の一次情報源
- `.claude/commands/invest.md` — スキル骨格とデータスコーピング定義

### Secondary (MEDIUM confidence)
- `.planning/phases/01-data-layer-skill-foundation/01-RESEARCH.md` — Phase 1 の設計パターンと制約
- `tmp/market.json` — 実際のデータ構造確認（実行済みデータが存在する）

---

## Metadata

**Confidence breakdown:**
- Existing Architecture Analysis: HIGH — 直接コード読解に基づく
- Implementation Patterns: HIGH — v1.0パターン踏襲 + Phase 1 RESEARCH の確立済みパターン適用
- JSON Schema Design: MEDIUM — プランナーが確定させる部分（OQ-1〜4）あり
- Pitfalls: HIGH — v1.0の実装上の問題点と Phase 2 固有の制約から導出

**Research date:** 2026-06-24
**Valid until:** 2026-07-24
