# Phase 12: Analysis Quality - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

アナリストの分析品質を向上させる。(1) 前日の meeting-result.json から推奨銘柄データを Round 1 プロンプトに注入し、前日推奨銘柄への見解変化を議論に反映させる。(2) Round 3 スコアリングの並列起動・完了ログを追加し、パイプライン実行の可視性を向上させる。

</domain>

<decisions>
## Implementation Decisions

### 前日レポート注入 (ANLQ-01)
- **D-01:** Round 1 プロンプトに注入するのは `meeting-result.json` の **`highlightedStocks` フィールドのみ**。各銘柄の ticker, averageScore, verdict, agentScores を含む。marketOverview や sectorRecommendations 等は注入しない
- **D-02:** 各アナリストの Round 1 プロンプトに「前日の推奨銘柄」セクションを追加し、「前日推奨銘柄への見解変化を明示的に述べること」を指示する
- **D-03:** 前日の meeting-result.json が存在しない場合（初回実行等）は**サイレントスキップ** — 前日セクションを省略し、通常の Round 1 プロンプトで実行する。コンソールログに「前日データなし」と表示

### Round 3 専用並列エージェント化 (ANLQ-02)
- **D-04:** 現在の invest.md 内の Agent 並列呼び出し方式を**そのまま維持**。TypeScript モジュール化は行わない
- **D-05:** Round 3 起動時に「Round 3: 5エージェント並列起動」ログ、各エージェント完了時に「[agentRole] スコアリング完了」ログを追加
- **D-06:** Round 2 の全5アナリスト応答完了を**明示的に確認**してから Round 3 を起動する（現在も暗黙的に順序保証されているが、ログとコメントで明示化）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### パイプラインフロー
- `.claude/commands/invest.md` — 全パイプラインの制御フロー。Round 1/2/3 のプロンプトテンプレートと Agent 起動手順
- `tmp/meeting-result.json` — 前日レポートデータ（highlightedStocks が注入対象）

### アナリストエージェント
- `src/agents/fundamentals.ts` — ファンダメンタルズアナリストの system prompt
- `src/agents/tenbagger.ts` — テンバガーハンターの system prompt
- `src/agents/macro.ts` — マクロエコノミストの system prompt
- `src/agents/technical.ts` — テクニカルストラテジストの system prompt
- `src/agents/risk-manager.ts` — リスクマネージャーの system prompt
- `src/agents/moderator.ts` — モデレーターの統合ロジック
- `src/agents/types.ts` — エージェント型定義

### 要件
- `.planning/REQUIREMENTS.md` — ANLQ-01, ANLQ-02 の要件定義

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `invest.md Step 2a` — Round 1 の Agent 呼び出しテンプレート。前日データ注入セクションの追加先
- `invest.md Step 2e` — Round 3 の Agent 並列呼び出し。ログ追加の対象
- `tmp/meeting-result.json` の `highlightedStocks` — 前日推奨銘柄の構造化データ

### Established Patterns
- **Agent 並列呼び出し:** Round 1/3 で5つの Agent を同時に起動するパターンが確立済み
- **tmp/ JSON 境界:** TypeScript と Claude のハンドオフは `tmp/*.json` ファイル経由（STATE.md の Key Decision）
- **グレースフルデグラデーション:** API 失敗時は空配列を返却するパターン（前日データ不在時にも適用）

### Integration Points
- `invest.md Step 2a` — Round 1 プロンプトへの前日データ注入
- `invest.md Step 2e` — Round 3 のログ追加
- `invest.md Step 2.0` — 前日 meeting-result.json の読み込みと存在チェック

</code_context>

<specifics>
## Specific Ideas

- highlightedStocks の各銘柄について「前日スコア: X.X / 判定: 強気」のようなフォーマットで注入
- 各アナリストには「前日推奨銘柄について、今日の市場データ・ニュースを踏まえて見解が変化したか明示すること」と指示
- Round 3 のログ形式: `[Round 3] エージェント起動: ファンダメンタルズ, テンバガー, マクロ, テクニカル, リスクマネ` → `[Round 3] ファンダメンタルズアナリスト スコアリング完了 (1/5)`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-Analysis Quality*
*Context gathered: 2026-06-30*
