# Phase 10: Pipeline Timing - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

`/invest` コマンドの最終出力にパイプライン全体とステップ別の実行時間を計測・表示する。collect-data.ts 内の計測は performance.now() で行い、invest.md 内の各ステップ計測は Bash タイムスタンプで行い、最終的にStep階層付きリスト形式で表示する。

</domain>

<decisions>
## Implementation Decisions

### ステップ粒度
- **D-01:** 中カテゴリ（Round別）＋モデレーター介入を別行で表示する。計測ステップは約10-12段階:
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

### 表示フォーマット
- **D-02:** Step階層付きリスト形式。Step 1〜4 の大カテゴリの下に、各サブステップをインデントして表示する。現行の invest.md 完了サマリーと統一感のあるスタイル
- **D-03:** 表示例:
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
    バリデーション        0m 02s
  Step 3: WebSearch+レポート
    WebSearch+再評価       1m 10s
    ポートフォリオ分析    0m 22s
    レポート生成          0m 08s
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### パイプライン制御
- `.claude/commands/invest.md` — パイプライン全体のオーケストレーション。タイミング計測の Bash 指示を追加する対象
- `src/scripts/collect-data.ts` — データ収集スクリプト。performance.now() による内部計測と tmp/pipeline-metrics.json 書き出しの対象

### レポート生成
- `src/scripts/generate-report.ts` — レポート生成スクリプト。計測ステップの1つ

### 要件定義
- `.planning/REQUIREMENTS.md` — METR-01, METR-02 の要件定義

### 先行フェーズの決定事項
- `.planning/phases/09-pipeline-integration/09-CONTEXT.md` — tmp/ JSON 境界パターン、console.log によるログ出力パターン

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `console.log` によるステップ進捗表示（collect-data.ts、invest.md 両方で既に使用中）
- `tmp/` ディレクトリ — TS↔Claude のデータハンドオフに使用済み。pipeline-metrics.json もここに書き出す
- invest.md の既存の完了サマリー表示（Step 1〜4 のチェックリスト形式）

### Established Patterns
- **tmp/ JSON 境界**: TS スクリプトは tmp/*.json に書き出し、invest.md の Claude がそれを読む
- **console.log によるログ出力**: 集中ロガーなし、直接 console.log/error を使用
- **performance.now()**: NTPジャンプによる負値防止のため Date.now() ではなく performance.now() を使用（STATE.md で決定済み）

### Integration Points
- collect-data.ts: `main()` 関数の開始/終了時に performance.now() を追加、各フェッチャーの前後にも計測を追加
- invest.md: 各 Step の前後に Bash タイムスタンプ取得コマンドを追加
- invest.md: パイプライン完了セクションにタイミング表示ブロックを追加

</code_context>

<specifics>
## Specific Ideas

- collect-data.ts 内のサブステップ計測（市場データ/ニュース/ポートフォリオ）は D-01 のステップ粒度では「データ収集」として1行にまとめる。tmp/pipeline-metrics.json に内部計測値を書き出すが、最終表示では合計値のみ使用
- invest.md 内での計測は、各ステップの前後に `node -e "console.log(Date.now())"` 等の Bash コマンドを実行してタイムスタンプを取得し、最後に差分を計算してフォーマット表示する方式が自然

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-Pipeline Timing*
*Context gathered: 2026-06-28*
