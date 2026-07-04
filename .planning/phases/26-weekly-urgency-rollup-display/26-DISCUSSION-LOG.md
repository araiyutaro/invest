# Phase 26: Weekly Urgency Rollup Display - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 26-weekly-urgency-rollup-display
**Mode:** `--auto`（各グレーエリアは推奨オプションを自動採択、AskUserQuestion なし）
**Areas discussed:** 集計ロジック, 表示形式, 配置・空/部分状態, 実装構成・データ供給

---

## 集計ロジック（Aggregation logic）

| Option | Description | Selected |
|--------|-------------|----------|
| meeting date 起点の7カレンダー日窓 + 履歴間 decision enum 比較 | 当日正準日付から6日前までを窓とし、履歴列の隣接記録日で decision 変化を検出（LLM非経由） | ✓ |
| 履歴の直近7エントリ（実行日ベース） | カレンダーではなく存在する直近7回分を対象 | |
| LLM に週次要約を生成させる | AI に履歴を渡し変化を要約 | |

**Auto-selected (recommended):** meeting date 起点の7カレンダー日窓 + 履歴間 decision enum 比較
**Notes:** Success Criteria #2「直近7日間のエントリから集計」に忠実。Phase 22 の attachDecisionChanges の決定論思想を履歴列へ写像。欠測日は記録隣接日で比較（D-01/D-02/D-03/D-04）。

---

## 表示形式（Display format）

| Option | Description | Selected |
|--------|-------------|----------|
| 動きのあった銘柄のみ bullet 集約リスト（既存バッジ色流用） | urgent/判断変更があった銘柄のみ列挙、赤=緊急/アンバー=判断変更 | ✓ |
| 全12銘柄 × 7日のマトリクステーブル | 全銘柄・全日を表形式で | |
| 日付ごとのタイムライン | 日別に発生イベントを並べる | |

**Auto-selected (recommended):** 動きのあった銘柄のみ bullet 集約リスト
**Notes:** テーブルはダークテーマ・長文でレイアウト崩れの既存懸念。「振り返り」は動きのある銘柄に注目。既存個別評価カードのバッジ色言語を流用（D-05/D-06/D-07）。

---

## 配置・空/部分状態（Placement & empty/partial state）

| Option | Description | Selected |
|--------|-------------|----------|
| overallComment 直後・個別評価の前 + 3段階の空状態文言 | 週次サマリ→当日詳細のトップダウン。0件/今週動きなし/7日未満を区別 | ✓ |
| 個別評価の後（末尾付近） | 詳細の後に補足的に置く | |
| 空状態ではセクション丸ごと非表示 | 履歴なし時は何も出さない | |

**Auto-selected (recommended):** overallComment 直後・個別評価の前 + 3段階の空状態
**Notes:** Success Criteria #3（0件/7日未満でもエラーにしない）。デフォルトは見出し+空状態メッセージ表示で機能の存在を認知させる（D-08/D-09/D-10）。

---

## 実装構成・データ供給（Module structure & data flow）

| Option | Description | Selected |
|--------|-------------|----------|
| 新規純関数 urgency-rollup.ts + loader + 第4引数(後方互換) + fail-soft | 集計=純関数モジュール / 描画=generate-portfolio-report.ts / 読込=generate-report.ts loader | ✓ |
| generate-portfolio-report.ts に集計も描画も直書き | モジュール分離なし | |
| invest.md に専用ステップ + STEP マーカー追加 | 履歴集計を別パイプラインステップ化 | |

**Auto-selected (recommended):** 新規純関数 urgency-rollup.ts + loader + 第4引数 + fail-soft
**Notes:** holding-news.ts / urgency-history.ts の純関数+.test.ts 併置設計を踏襲。第4引数は Test 38 の後方互換パターン。既存 generate-report 実行内に閉じるため新 STEP マーカー不要（D-11/D-12/D-13/D-14）。

---

## Claude's Discretion

- セクション見出し・空状態メッセージの正確な文言（既存レポートのトーンに合わせる）
- 集計結果型（`WeeklyUrgencyRollup` 等）の正確な形状
- 履歴読み込みに専用 zod スキーマを新設するか型アサーションか
- 履歴0件時にセクション見出しを出すか丸ごと非表示にするか（デフォルト: 見出し+空状態表示）
- 欠測日を挟む判断変更比較の基準（デフォルト: 記録隣接2日を比較）

## Deferred Ideas

- 7日超（月次・四半期）ロールアップ・履歴トレンドのグラフ化 → 本フェーズは直近7日固定（HIST-03）、別フェーズ候補
- 履歴の剪定・履歴専用ページ → Phase 25 は append-only 維持、本フェーズは新規ページなし
