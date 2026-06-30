# Phase 13: Operational Stability - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

自動実行パイプライン（launchd 毎朝7時）の運用信頼性を向上させる。(1) パイプライン失敗時に失敗ステップを特定するエラーログの構造化出力。(2) docs/index.html・docs/portfolio.html の保護機構。(3) macOS通知（terminal-notifier）のlaunchd環境での動作検証ドキュメント化。

</domain>

<decisions>
## Implementation Decisions

### エラーログ構造化 (OPS-01)
- **D-01:** invest.md の各主要ステップにマーカーを追加する。形式: `[STEP:{step-name}:START]` / `[STEP:{step-name}:OK]` / `[STEP:{step-name}:FAIL:{error}]`。grep可能なフラットテキスト形式
- **D-02:** ステップ粒度は既存の Step 構造に対応: `data-collection` / `round-1` / `round-2` / `round-3` / `report-generation` / `deploy` の6ステップ
- **D-03:** 失敗時は invest.md の最終出力（Step 4 タイミングサマリの直後）に **失敗サマリ** を追加する。形式: `[PIPELINE:FAIL] ステップ: {step-name}, エラー: {error-message}`。成功時は `[PIPELINE:OK]`
- **D-04:** `scripts/run.sh` 側は既存のログ記録（全出力→ `logs/invest-*.log`）をそのまま維持し、変更しない。ステップマーカーは invest.md 内で出力するため run.sh のログに自動的に含まれる

### HTML保護機構 (OPS-02)
- **D-05:** `scripts/run.sh` で **チェックサム方式** を採用。パイプライン実行前に `docs/index.html` と `docs/portfolio.html` の SHA256 を記録し、実行後に比較。変更があれば `git checkout -- docs/index.html docs/portfolio.html` で復元する
- **D-06:** git pre-commit hook は不採用 — 開発中の意図的な手動編集を妨げるため。保護はパイプライン実行時のみ適用する
- **D-07:** 保護対象ファイルは `docs/index.html` と `docs/portfolio.html` の2ファイルのみ。日次レポート出力先の `docs/YYYY-MM-DD/` ディレクトリは保護対象外

### macOS通知検証 (OPS-03)
- **D-08:** terminal-notifier は `scripts/run.sh` に既に実装済み（開始/完了/失敗の3パターン）。launchd 環境での動作も `logs/launchd-out.log` で確認済み（6/29, 6/30）
- **D-09:** Phase 13 での OPS-03 タスクは **検証結果のドキュメント化のみ**。新規コード実装は不要。VERIFICATION.md で動作確認済みとして記録する

### Claude's Discretion
- ステップマーカーの具体的な挿入位置（invest.md 内の各 Step の先頭/末尾）は実装時に最適な箇所を判断する
- チェックサム記録・復元ロジックの scripts/run.sh 内での配置は実装時に判断する

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### パイプライン制御
- `.claude/commands/invest.md` — 全パイプラインの制御フロー。ステップマーカー追加の対象
- `scripts/run.sh` — launchd から起動されるエントリポイント。HTML保護ロジックの追加先

### launchd 設定
- `com.arai.invest-agent.plist` — launchd 定期実行設定（毎朝7時）
- `logs/launchd-out.log` — launchd stdout ログ（動作確認用）
- `logs/launchd-err.log` — launchd stderr ログ

### 保護対象ファイル
- `docs/index.html` — GitHub Pages ランディングページ（保護対象）
- `docs/portfolio.html` — ポートフォリオ一覧ページ（保護対象）

### 要件
- `.planning/REQUIREMENTS.md` — OPS-01, OPS-02, OPS-03 の要件定義

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/run.sh` の既存ログ記録パターン: `tee "$LOG_FILE"` で全出力をファイルに記録。ステップマーカーは自動的にこのログに含まれる
- `scripts/run.sh` の terminal-notifier 呼び出し: 3パターン（開始/完了/失敗）が実装済み
- `invest.md` の既存タイミング計測: `performance.now()` ベースの Step 別計測。ステップマーカーと自然に共存可能

### Established Patterns
- **パイプラインタイミング計測:** `tmp/pipeline-metrics.json` 経由でメトリクス値をスキルに返却するパターン（Phase 10 で確立）
- **グレースフルデグラデーション:** API 失敗時の空配列返却、try/catch での継続
- **7日ローテーション:** `find "$LOG_DIR" -name "invest-*.log" -mtime +7 -delete` でログファイルを自動削除

### Integration Points
- `invest.md` 各 Step の先頭と末尾 — ステップマーカー追加箇所
- `scripts/run.sh` の `claude --dangerously-skip-permissions` 呼び出し前後 — HTML チェックサム記録・検証の追加箇所
- `invest.md` Step 4（最終出力）— 失敗サマリの追加箇所

</code_context>

<specifics>
## Specific Ideas

- ステップマーカー例: `echo '[STEP:data-collection:START]'` → データ収集処理 → `echo '[STEP:data-collection:OK]'`
- HTML保護例: `sha256sum docs/index.html docs/portfolio.html > /tmp/html-checksums.txt` → パイプライン実行 → 比較 → 不一致時は `git checkout`
- 失敗ログの grep 例: `grep '\[STEP:.*:FAIL\]' logs/invest-2026-06-30_070000.log`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-Operational Stability*
*Context gathered: 2026-06-30*
