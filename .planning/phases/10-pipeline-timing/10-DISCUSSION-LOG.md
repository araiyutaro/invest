# Phase 10: Pipeline Timing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 10-Pipeline Timing
**Areas discussed:** ステップ粒度, 表示フォーマット

---

## ステップ粒度

### 最終出力のタイミング内訳をどの粒度で表示するか

| Option | Description | Selected |
|--------|-------------|----------|
| 大カテゴリ (4段階) | Step 1-4 と同じ単位。シンプルだがRound別のボトルネックが見えない | |
| 中カテゴリ (7-8段階) | Round別の所要時間がわかる。モデレーター介入等の細かいステップは含まれない | ✓ |
| Claudeおまかせ | METR-02の要件を満たす範囲で実装時に判断 | |

**User's choice:** 中カテゴリ (7-8段階)
**Notes:** Round別の所要時間が見えるレベルを希望

### モデレーター介入の扱い

| Option | Description | Selected |
|--------|-------------|----------|
| Roundに含める | ティッカー抽出・モデレーターをRound時間に含める。行数が少ない | |
| 別行で表示 | モデレーター介入の時間も別行で表示。ボトルネックがより正確に見える | ✓ |
| Claudeおまかせ | 実装時に判断 | |

**User's choice:** 別行で表示
**Notes:** 結果として計測ステップは約10-12段階になる

---

## 表示フォーマット

### パイプライン完了時のタイミング表示スタイル

| Option | Description | Selected |
|--------|-------------|----------|
| リスト形式 (推奨) | Step階層付きリスト。現行の完了サマリーと統一感がある | ✓ |
| フラットリスト | Step階層なしで全ステップをフラットに並べる | |
| Claudeおまかせ | 実装時に判断 | |

**User's choice:** リスト形式 (推奨)
**Notes:** Step 1-4 の大カテゴリの下にサブステップをインデントして表示するスタイル

### タイミング表示の配置

| Option | Description | Selected |
|--------|-------------|----------|
| サマリーに統合 | 現在の完了サマリーの各行に所要時間を追加 | |
| 別ブロック | 完了サマリーの後に Pipeline Timing ブロックを追加 | |
| Claudeおまかせ | 実装時に判断 | ✓ |

**User's choice:** Claudeおまかせ
**Notes:** なし

---

## Claude's Discretion

- タイミング表示ブロックの配置（完了サマリーに統合 vs 別ブロック）
- invest.md 内のタイムスタンプ取得方式（Bash `date` コマンド、`node -e` 等）
- tmp/pipeline-metrics.json のスキーマ設計
- collect-data.ts 内の performance.now() 計測ポイントの配置
- 時間フォーマットの詳細

## Deferred Ideas

None — discussion stayed within phase scope
