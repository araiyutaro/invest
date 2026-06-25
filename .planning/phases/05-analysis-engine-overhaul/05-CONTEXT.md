# Phase 5: Analysis Engine Overhaul - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

アナリストの分析エンジンを改修し、ポートフォリオ非依存の銘柄発掘能力と、プロフェッショナルな散文品質の分析出力を確立する。対象は Round 1 分析プロンプト、Round 2 ディスカッションプロンプト、Round 3 スコアリング理由フィールド、invest.md スキルコマンド、TypeScript 型定義・Zod スキーマ。レポート生成（3ファイル分離）やデプロイは Phase 6-7 のスコープ。

</domain>

<decisions>
## Implementation Decisions

### Round 1 散文分析の形式
- **D-01:** ハイブリッド方式を採用。既存の JSON スキーマに `analysis` フィールド（複数段落の詳細散文）を追加し、`summary`, `highlights`, `risks`, `picks`, `sectorView` の構造化フィールドも維持する。
- **D-02:** `analysis` フィールドには 4 セクション構成を要求する: 「市場認識」「専門領域からの洞察」「注目銘柄の詳細分析」「リスクと懸念」。各セクション最低 1 段落。
- **D-03:** `picks` の `rationale` フィールドを 100 文字 → 300 文字に拡張する。
- **D-04:** Round 1 の model は `opus` を維持。散文品質が最重要。

### 銘柄発掘の入力ソース
- **D-05:** Round 1 からポートフォリオデータ（`portfolio.json`）を除外する。`market.json` + `news.json`（最新 50 件）のみを全 5 アナリストに渡す。ポートフォリオ分析は Phase 7 の Portfolio Report で担当する。
- **D-06:** 各アナリストの推奨銘柄数は 1〜3 銘柄に制限する（ROADMAP.md の成功基準と一致）。プロンプトで「ニュース・市況から新規の注目銘柄を 1〜3 銘柄に絞って推奨」と明示的に指示する。

### Round 2 ディスカッションの深化
- **D-07:** Round 2 で他アナリストの Round 1 `analysis` 全文 + `picks` を共有する（現行の highlights + picks のみから拡張）。具体的な相互参照を可能にする。
- **D-08:** Round 2 の出力に `discussion` フィールド（複数段落の散文）を追加し、`[Analyst名] の〇〇という主張について...` のような明示的な相互参照を要求する。`agreements` / `disagreements` 配列も維持する。
- **D-09:** Round 2 の model を `sonnet` → `opus` に変更する。他アナリストの分析を読み込んで具体的な反論・支持を生成するには高品質モデルが必要。

### invest.md スキルコマンド改修
- **D-10:** インプレース改修。Phase 5 では Step 2a（Round 1 プロンプト）、Step 2c（Round 2 プロンプト）、JSON スキーマの更新を行う。Step 1（データ収集）、Step 3（WebSearch + レポート生成）は変更しない。
- **D-11:** TypeScript 型定義（`meeting/types.ts`）、Zod スキーマ（`meeting/schemas.ts`）、バリデーション（`validate-meeting.ts`）も Phase 5 で同時更新する。整合性を保つ。
- **D-12:** Round 3 スコアリングの `reason` フィールドを 30 文字 → 100 文字に拡張する（ANL-04 の「各アナリストの理由付きコメント」要件への対応）。

### Claude's Discretion
- エージェント systemPrompt（`src/agents/*.ts`）の改修内容: ニュース駆動の銘柄発掘を促す表現の追加は Claude の判断に委ねる
- Round 2 の相互参照プロンプトの具体的な文面は Claude が設計してよい

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 要件定義
- `.planning/REQUIREMENTS.md` — ANL-01〜ANL-04 の要件定義（Phase 5 担当分）
- `.planning/ROADMAP.md` §Phase 5 — 成功基準 4 項目（銘柄発掘、散文品質、実質的議論、スコアリング表）

### 現行実装（改修対象）
- `.claude/commands/invest.md` — 全パイプライン定義（Step 2a Round 1 / Step 2c Round 2 / Step 2e Round 3 が改修対象）
- `src/meeting/types.ts` — AnalystRound1Output, AnalystRound2Output, AnalystRound3Output 型定義
- `src/meeting/schemas.ts` — analystRound1OutputSchema, analystRound2OutputSchema, analystRound3OutputSchema の Zod スキーマ
- `src/scripts/validate-meeting.ts` — meeting-result.json のバリデーションテスト
- `src/scripts/generate-report.ts` — HTML レポート生成（formatHighlightedStocksHtml のスコアリング表）

### エージェントプロファイル（参照のみ）
- `src/agents/fundamentals.ts` — systemPrompt
- `src/agents/tenbagger.ts` — systemPrompt
- `src/agents/macro.ts` — systemPrompt
- `src/agents/technical.ts` — systemPrompt
- `src/agents/risk-manager.ts` — systemPrompt
- `src/agents/moderator.ts` — systemPrompt

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `meeting/schemas.ts`: Zod スキーマによるバリデーション基盤 — `analysis` フィールド追加、`rationale` / `reason` の文字数制限変更に対応
- `meeting/types.ts`: TypeScript readonly 型定義 — 新フィールド追加の型安全性を保証
- `generate-report.ts` の `formatHighlightedStocksHtml`: 既存スコアリングマトリクス HTML — reason フィールド拡張で自動的に表示が充実する
- `validate-meeting.ts`: テストスイート — スキーマ変更に追従すれば整合性チェックが継続される

### Established Patterns
- **tmp/ JSON 境界**: TS ↔ Claude のハンドオフは `tmp/*.json` ファイル経由。Round 1/2 の出力先 `tmp/round-1/*.json`, `tmp/round-2/*.json` のパターンを維持
- **並列 Agent 実行**: invest.md で 5 アナリストを同時に Agent ツールで起動する確立されたパターン
- **エラーハンドリング**: 無効 JSON 時のフォールバックオブジェクト保存、3 人以上失敗時のパイプライン停止
- **Immutable データ構造**: 全型に `readonly` を使用する規約

### Integration Points
- `invest.md` Step 2a/2c: エージェントプロンプトの JSON フォーマット指示 → `meeting/schemas.ts` のバリデーション → `generate-report.ts` の HTML レンダリング。3 つが同期している必要がある
- `invest.md` Step 2b: ティッカー抽出ロジック — `picks` 配列の構造が変わらないため影響なし
- `invest.md` Step 2f: モデレーター最終統合 — Round 1/2 の出力フォーマット変更に対応する必要がある

</code_context>

<specifics>
## Specific Ideas

- analysis フィールドの 4 セクション構成（市場認識 / 専門領域からの洞察 / 注目銘柄の詳細分析 / リスクと懸念）は、各アナリストの systemPrompt に記載の「分析の方針」と対応させる
- Round 2 の相互参照形式: `[ファンダメンタルズアナリスト] の「XYZ 社の PER が割安」という主張に対して、テクニカル面では...` のように名前指定で言及
- v1.0 品質への回帰: アナリストが「プロの投資アナリストのレポート」のように書くことを目標とする

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 5-Analysis Engine Overhaul*
*Context gathered: 2026-06-25*
