# Phase 3: Report Builder + WebSearch Research - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning

<domain>
## Phase Boundary

`/invest` パイプラインの最終段階。Step 2（3ラウンド制ミーティング）完了後の `tmp/meeting-result.json` を入力として、(1) highlightedStocksに対するWebSearch+WebFetchリサーチ、(2) リサーチ結果を踏まえた5アナリストの再評価ラウンド（コメント+スコア再提出）、(3) 全結果を統合したBloomberg風HTMLレポートの生成・保存を行う。Geminiクリーンアップは Phase 4 で行う。

</domain>

<decisions>
## Implementation Decisions

### WebSearchリサーチの設計
- **D-01:** WebSearchリサーチはミーティング後補完方式。Step 2完了後に `tmp/meeting-result.json` の `highlightedStocks` 配列に含まれる全銘柄を対象にWebSearchを実行する
- **D-02:** highlightedStocksの全銘柄をリサーチ対象とする（スコアによるフィルタリングは行わない）
- **D-03:** WebSearch + WebFetchの組み合わせで調査。WebSearchで概要を取得後、重要な記事2-3件をWebFetchで深掘りする
- **D-04:** WebSearch結果を踏まえた再評価ラウンドを実施。5アナリストがWebリサーチ結果を読み、コメント（見解変更理由等）+ スコア再提出を行う
- **D-05:** 既存の制約を継続: WebSearchは定性情報のみ。株価・財務数値等の定量データはYahoo Finance APIを使用（STATE.md決定事項）

### investスキルへの統合
- **D-06:** WebSearchリサーチは銘柄ごとに並列Agent（`model: "sonnet"`）でスポーン。各Agentがその銘柄についてWebSearch+WebFetchを実行し、結果をJSONで返す
- **D-07:** 再評価ラウンドの5アナリストは `model: "sonnet"` で並列実行。Round 2ディスカッションと同様の軽量モデルで十分
- **D-08:** HTMLレポート生成はTSスクリプトで実装。既存の `src/report/generator.ts` を参照しつつ、v2.0の `meeting-result.json` スキーマに対応した新規レポート生成スクリプトを作成。invest.mdから `npx tsx` で実行する
- **D-09:** レポート出力先は `reports/YYYY-MM-DD/`（RPT-02要件）

### Claude's Discretion
- WebSearch Agentの検索クエリ設計（銘柄名+業界キーワードの組み合わせ等）
- WebFetchで取得する記事の選定基準
- 再評価ラウンドの出力JSONスキーマ詳細設計
- TSレポートジェネレータの内部構造（v1.0のgenerator.tsからの流用度合い）
- `tmp/` に保存するWebSearch結果・再評価結果のファイル構成
- レポートのセクション構成・ビジュアルデザインの詳細

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — プロジェクト定義、技術スタック制約、キー決定事項
- `.planning/REQUIREMENTS.md` — v2.0全要件マッピング（RSRCH-01, RSRCH-02, RPT-01, RPT-02がPhase 3対象）
- `.planning/ROADMAP.md` — Phase 3のゴールとサクセスクライテリア

### Prior Phase Context（依存フェーズ）
- `.planning/phases/01-data-layer-skill-foundation/01-CONTEXT.md` — Phase 1の決定事項（中間JSON設計、スキルコマンド設計）
- `.planning/phases/02-analyst-subagents/02-CONTEXT.md` — Phase 2の決定事項（分析スキーマ、3ラウンド制ミーティング、モデル選択）

### Key Source Files
- `.claude/commands/invest.md` — `/invest` スキルコマンド（Step 3がPhase 3の実装対象箇所）
- `src/report/generator.ts` — v1.0レポートジェネレータ（Bloomberg風HTML、CSS、markdownToHtml等の参照元）
- `src/report/portfolio-generator.ts` — v1.0ポートフォリオレポートジェネレータ
- `src/agents/types.ts` — 既存型定義（MeetingRecord, StockScoring等のv2.0スキーマ設計参照元）

### Existing Architecture
- `.planning/codebase/ARCHITECTURE.md` — パイプラインのレイヤー構成とデータフロー
- `.planning/codebase/INTEGRATIONS.md` — 外部API連携詳細

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/report/generator.ts` のBloomberg風CSSスタイル（HTML_STYLES）: ダークテーマ、agent-card、discussion-card、scoring table等のスタイルがそのまま再利用可能
- `src/report/generator.ts` の `markdownToHtml()`: Markdown→HTML変換ロジック
- `src/report/generator.ts` の `formatScoringHtml()`: スコアリングマトリクスのHTML生成。v2.0の再評価スコアにも流用可能
- `src/report/generator.ts` の `formatResearchHtml()`: WebリサーチセクションのHTML生成。Phase 3のWebSearch結果表示に直接流用可能
- `src/agents/types.ts` の型定義: v2.0スキーマ設計の参照元

### Established Patterns
- `tmp/*.json` によるステップ間データ受け渡し（Phase 1で確立）
- Agent toolの並列スポーン（Phase 2で確立）
- JSON出力のバリデーション（`validate-meeting.ts` パターン）
- グレースフルデグラデーション（部分失敗でも続行）

### Integration Points
- `.claude/commands/invest.md` Step 3: Phase 3実装がここに統合される
- `tmp/meeting-result.json`: Phase 2出力 → Phase 3入力（WebSearchの銘柄選定ソース）
- `tmp/` 配下にWebSearch結果・再評価結果を保存（新規ファイル）
- `reports/YYYY-MM-DD/`: 最終HTMLレポート出力先（新規ディレクトリ、v1.0のdocs/から変更）

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

*Phase: 3-Report Builder + WebSearch Research*
*Context gathered: 2026-06-24*
