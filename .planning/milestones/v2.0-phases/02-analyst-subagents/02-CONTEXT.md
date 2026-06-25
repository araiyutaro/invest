# Phase 2: Analyst Subagents - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

5アナリスト（ファンダメンタルズ、テンバガー、マクロ、テクニカル、リスクマネージャー）をClaude Codeサブエージェントとして並列実行し、3ラウンド制ミーティング（分析→ディスカッション→スコアリング）を経て、モデレーターが統合し `tmp/meeting-result.json` を生成する。Phase 1で確立したデータ収集パイプライン（`tmp/market.json`, `tmp/news.json`, `tmp/portfolio.json`）を入力として使用する。レポート生成はPhase 3、Geminiクリーンアップは Phase 4で行う。

</domain>

<decisions>
## Implementation Decisions

### 分析出力スキーマ
- **D-01:** 各アナリストのJSON出力はハイブリッド方式。共通フィールド（summary, highlights, risks等）＋各アナリスト固有フィールドの組み合わせ
- **D-02:** Agent toolの `schema` パラメータで構造化JSONを強制し、パースエラーを防止する
- **D-03:** 出力言語は日本語で統一（既存systemPromptの方針を踏襲）

### ミーティング構造
- **D-04:** 3ラウンド制を採用: ラウンド1（分析プレゼンテーション）→ ラウンド2（相互ディスカッション）→ ラウンド3（銘柄スコアリング）→ モデレーター統合
- **D-05:** ディスカッションは全員が全員にコメント方式（v1.0踏襲）。各アナリストが他の4人の分析を読み、自分の専門視点からコメントを並列生成
- **D-06:** スコアリングは毎回必須実行。スコア対象銘柄はモデレーターが分析+ディスカッションから言及頻度の高い銘柄を自動抽出
- **D-07:** 5アナリストの各ラウンドは並列実行（AGENT-08要件）

### モデレーター統合方式
- **D-08:** モデレーターは各ラウンド後に介入: 分析後に銘柄抽出、ディスカッション後に論点整理、スコアリング後に最終統合
- **D-09:** 統合出力（meeting-result.json）はv1.0踏襲＋強化: 市場総覧、セクター推奨、注目銘柄（スコア付き）、リスク警告、アクションアイテム、今週のイベント

### モデル選択
- **D-10:** 5アナリストは全員 `model: "opus"` を使用。分析品質を最優先
- **D-11:** モデレーターも `model: "opus"` で統一

### Claude's Discretion
- 推奨銘柄のJSONスキーマ詳細設計（picks配列のフィールド構成）
- 確信度スコアの採否
- 中間介入（銘柄抽出・論点整理）のサブエージェント vs スキル内ロジックの判断
- ディスカッション・スコアリングラウンドのモデル選択（opus維持 or sonnetで最適化）
- 各アナリスト固有フィールドの具体的な設計

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — プロジェクト定義、技術スタック制約、キー決定事項
- `.planning/REQUIREMENTS.md` — v2.0全要件マッピング（AGENT-01〜08がPhase 2対象）
- `.planning/ROADMAP.md` — Phase 2のゴールとサクセスクライテリア

### Phase 1 Context（依存フェーズ）
- `.planning/phases/01-data-layer-skill-foundation/01-CONTEXT.md` — Phase 1の決定事項（データスコーピング、中間JSON設計、スキルコマンド設計）

### Existing Architecture
- `.planning/codebase/ARCHITECTURE.md` — 既存パイプラインのレイヤー構成（エージェントレイヤー、ミーティングオーケストレーション、データフロー）
- `.planning/codebase/STACK.md` — 技術スタック詳細

### Key Source Files
- `.claude/commands/invest.md` — `/invest` スキルコマンド（Phase 2のアナリスト並列分析セクションにデータスコーピング定義あり）
- `src/agents/` — 既存6エージェントプロファイル定義（systemPrompt参照元）
- `src/agents/types.ts` — 既存型定義（AgentProfile, AgentAnalysis, MeetingRecord, StockScoring等）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/agents/*.ts` の既存systemPrompt: 5アナリスト+モデレーターのプロンプトがそのまま再利用可能。id, name, role, systemPromptの4フィールド構成
- `src/agents/types.ts` の型定義: AgentProfile, MeetingRecord, StockScoring, StockScoreSummary等がv2.0のスキーマ設計の参照元になる
- `.claude/commands/invest.md` のデータスコーピングコメント: 各アナリストがどのJSONファイルを読むべきか定義済み
- `zod` 4.3.6: package.jsonに含まれるがコード内未使用。JSONスキーマ定義に活用可能

### Established Patterns
- `Promise.all()` による並列実行: v1.0のエージェント分析・ディスカッション並列パターンを踏襲
- グレースフルデグラデーション: 個別アナリストの失敗が全体をブロックしない
- イミュータブルデータ構造: `readonly` 型による不変性の強制
- v1.0の3フェーズミーティング: プレゼンテーション→ディスカッション→スコアリング→統合

### Integration Points
- `.claude/commands/invest.md` Step 2: Phase 2実装がここに統合される。Agent toolで5アナリストをスポーンし、結果を `tmp/meeting-result.json` に出力
- `tmp/*.json`: Phase 1が出力するデータファイルを入力として読み込み
- `tmp/meeting-result.json`: Phase 2の出力ファイル。Phase 3のレポート生成が消費する

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 2-Analyst Subagents*
*Context gathered: 2026-06-24*
