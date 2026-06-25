---
phase: 02-analyst-subagents
plan: "02"
subsystem: skill-command
tags: [agent-orchestration, parallel-execution, meeting-pipeline, json-schema]
dependency_graph:
  requires: ["02-01"]
  provides: ["tmp/meeting-result.json schema contract", "3-round meeting orchestration"]
  affects: ["Phase 3 report generation"]
tech_stack:
  added: []
  patterns:
    - "Parallel Agent tool invocation (5 analysts × 3 rounds)"
    - "Inline ticker extraction via Bash node script"
    - "Moderator intervention pattern (3 times)"
    - "JSON-only output enforcement via prompt"
    - "Graceful degradation (skip failed analysts)"
key_files:
  modified:
    - .claude/commands/invest.md
decisions:
  - "Round 1/moderator use opus model; Round 2/3 use sonnet for cost optimization (OQ-1)"
  - "Ticker extraction is inline Bash script (not Agent tool) per OQ-2 resolution"
  - "JSON output enforced via prompt instruction (no schema parameter) per OQ-3 resolution"
  - "Round 2 input limited to highlights+picks only (Pitfall 2 mitigation)"
  - "Error threshold: abort if 3+ analysts fail in Round 1"
metrics:
  duration: "~10 minutes"
  completed: "2026-06-24"
  tasks_completed: 1
  files_modified: 1
---

# Phase 02 Plan 02: Analyst Meeting Orchestration Summary

invest.md の Step 2 を3ラウンド制アナリストミーティングの完全なオーケストレーション指示に置き換え、Claude Code の Agent tool を使った5アナリスト並列実行×3ラウンド＋モデレーター介入3回のフルパイプラインを定義した。

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | invest.md Step 2 を3ラウンド制ミーティングオーケストレーションに置き換え | fff6214 | .claude/commands/invest.md |

## What Was Built

### invest.md Step 2 の全体構成

**Step 2.0: 準備**
- `mkdir -p` でラウンド用ディレクトリ作成
- 6エージェントの systemPrompt と tmp/*.json を Read ツールで先読み

**Step 2a: Round 1 — 分析プレゼンテーション（5 Agent tools、opus、並列）**
- ファンダメンタルズアナリスト: market.json + portfolio.json
- テンバガーハンター: market.json + portfolio.json
- マクロエコノミスト: market.json + news.json（最新50件）
- テクニカルストラテジスト: market.json + portfolio.json
- リスクマネージャー: market.json + news.json + portfolio.json
- 出力: AnalystRound1Output JSON → tmp/round-1/{agentId}.json
- エラー処理: 3人以上失敗でミーティング中止

**Step 2b: モデレーター介入1 — ティッカー抽出（インラインBash）**
- Round 1 の picks[].ticker を集約
- テキストから正規表現（[A-Z]{1,5}、\d{4}\.T）で追加抽出
- 一般英単語フィルタリング適用
- tmp/moderator-tickers.json に保存

**Step 2c: Round 2 — ディスカッション（5 Agent tools、sonnet、並列）**
- 他4人の highlights + picks のみを入力（サイズ制御）
- 出力: AnalystRound2Output JSON → tmp/round-2/{agentId}.json

**Step 2d: モデレーター介入2 — 論点整理（1 Agent tool、opus）**
- Round 1+2 全結果を入力
- keyThemes、consensus、debates を抽出
- tmp/moderator-issues.json に保存（失敗時1回リトライ）

**Step 2e: Round 3 — 銘柄スコアリング（5 Agent tools、sonnet、並列）**
- moderator-tickers.json のティッカーリストを入力
- 各エージェントの Round 1 highlights+picks と Round 2 comment を参照
- 出力: AnalystRound3Output JSON → tmp/round-3/{agentId}.json
- ティッカー0件時はスキップ

**Step 2f: モデレーター最終統合（1 Agent tool、opus）**
- 全ラウンド結果 + market.json サマリー + moderator-issues.json を入力
- スコア判定閾値: 平均≥7=強気、平均≥4=中立、平均<4=弱気
- RESEARCH.md Section 3.5 スキーマ準拠の MeetingResult JSON を出力
- tmp/meeting-result.json に保存（失敗時1回リトライ、2回失敗でミーティング中止）

**Step 2g: バリデーション**
- `npx tsx src/scripts/validate-meeting.ts` で出力スキーマ検証
- ミーティングサマリー（注目銘柄・アクションアイテム・Round完了数）をユーザーに表示

## Decisions Made

1. **Round 2/3 は sonnet モデル使用（OQ-1）**: コスト最適化のためディスカッション・スコアリングは sonnet で十分。Round 1 と moderator は品質最優先で opus を維持。

2. **ティッカー抽出はインラインBash（OQ-2）**: モデレーター Agent tool を追加呼び出しするコストを避け、正規表現＋picks集約で十分な精度を実現。

3. **JSON出力はプロンプト内指示で強制（OQ-3）**: Agent tool に schema パラメータは存在しないため、「JSONフォーマットのみを出力してください」をプロンプトに明記し、parse失敗時は空のフォールバック JSON を保存。

4. **Round 2 入力サイズ制御（Pitfall 2 対策）**: Round 1 の full analysis ではなく highlights + picks のみを Round 2 の各エージェントに渡してトークン消費を抑制。

## Deviations from Plan

None - plan executed exactly as written.

## Security Review

T-02-01（Tampering: Agent出力JSON）: プロンプト内に「JSONフォーマットのみ出力」指示を明記。validate-meeting.ts によるスキーマ検証を Step 2g に組み込み済み。

T-02-02（DoS: Round 2 prompt size）: Round 1 結果の highlights+picks 限定で対応済み。

T-02-03（Tampering: Round 3 score range）: プロンプトで 1-10 整数スコアを明示。validate-meeting.ts での範囲チェック対象。

## Known Stubs

なし。Step 2 は実際の Agent tool 呼び出しと tmp/*.json ファイル書き込みで完結するオーケストレーション指示。

## Threat Flags

なし。新規ネットワークエンドポイント・スキーマ外のトラストバウンダリ変更はなし。

## Self-Check

### Files Check

- `/Users/arai/invest/.claude/worktrees/agent-a7575fead3f104ce6/.claude/commands/invest.md`: FOUND (850 lines added)
- `/Users/arai/invest/.claude/worktrees/agent-a7575fead3f104ce6/.planning/phases/02-analyst-subagents/02-02-SUMMARY.md`: FOUND (this file)

### Commit Check

- `fff6214` feat(02-02): implement 3-round analyst meeting orchestration in invest.md: FOUND

### Verification Checks

- `grep -c "Round 1"` → 11 (≥1)
- `grep -c "Round 2"` → 13 (≥1)
- `grep -c "Round 3"` → 12 (≥1)
- `grep -c "モデレーター"` → 14 (≥1)
- `grep -c "meeting-result.json"` → 5 (≥1)
- `grep -c "validate-meeting"` → 1 (≥1)
- `grep -c "opus"` → 7 (≥1)
- `grep -c "fundamentals"` → 25 (≥1)
- `grep -c "tenbagger"` → 25 (≥1)
- `grep -c "macro"` → 26 (≥1)
- `grep -c "technical"` → 25 (≥1)
- `grep -c "risk-manager"` → 25 (≥1)
- `grep -c "collect-data.ts"` → 1 (Step 1 preserved)
- `grep -c "Phase 3"` → 3 (Step 3 preserved)

## Self-Check: PASSED
