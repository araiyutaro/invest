# Phase 25: Urgency History Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.
>
> **Mode:** `--auto` — 各エリアは推奨（デフォルト）オプションを自動採択（AskUserQuestion 非使用）。

**Date:** 2026-07-04
**Phase:** 25-Urgency History Persistence
**Areas discussed:** 履歴スキーマ形状, 同日再実行ガード実装, 統合ポイント, git永続化, 空/欠損フォールバック

---

## 履歴ファイルのスキーマ形状

| Option | Description | Selected |
|--------|-------------|----------|
| date-keyed object `Record<YYYY-MM-DD, snapshot[]>` | 日付キーの単純代入で同日上書き。Phase 26 の日付フィルタが自然 | ✓ |
| array-of-entries `{date, holdings}[]` | update-index.ts の mergeEntry と同形だが同日上書きに filter が必要 | |
| 最小4フィールド `{symbol, nameJa, urgent, decision}` | 生スナップショットのみ、派生値は Phase 26 読み取り側で計算 | ✓ |
| 全フィールド（previousDecision/decisionChanged/rationale 含む） | 二重情報源になるリスク | |

**User's choice:** date-keyed object + 最小4フィールド（推奨自動採択）
**Notes:** D-01/D-02/D-03。全12銘柄を毎日保存（urgent=false 含む）、append-only（剪定なし）。

---

## 同日再実行ガードの実装方式

| Option | Description | Selected |
|--------|-------------|----------|
| TS 純関数で日付キー上書き | `{ ...history, [dateKey]: snapshots }` イミュータブル。object キー代入で重複構造的に不可能 | ✓ |
| invest.md 側の JST date ガードのみ | Step 3d の退避スキップ方式を踏襲するが TS 側の保証がない | |

**User's choice:** TS 純関数で日付キー上書き（推奨自動採択）
**Notes:** D-04/D-05/D-06。日付導出は JST（Step 3d と統一）or meeting-result.json の date。`/^\d{4}-\d{2}-\d{2}$/` 検証。

---

## 統合ポイントと実行タイミング

| Option | Description | Selected |
|--------|-------------|----------|
| 独立: 純関数 urgency-history.ts + CLI write-urgency-history.ts + 専用ステップ | 関心の分離、fail-soft 隔離が明快、専用 STEP マーカー | ✓ |
| generate-report.ts に相乗り | 1スクリプトに集約するが関心が混在、fail-soft 隔離が困難 | |

**User's choice:** 独立モジュール + CLI + 専用ステップ（推奨自動採択）
**Notes:** D-07/D-08/D-09/D-10。`[STEP:urgency-history:OK/FAIL]`、`[PIPELINE:FAIL]` 禁止。normalizeHoldingSymbol 再利用。

---

## git 永続化の統合

| Option | Description | Selected |
|--------|-------------|----------|
| Step 4 デプロイに相乗り（`git add docs/ data/`） | 既存 commit/push 経路を流用、docs+data が1コミット | ✓ |
| 独立の commit/push 経路を新設 | 二重コミット・複雑化 | |

**User's choice:** Step 4 デプロイに相乗り（推奨自動採択）
**Notes:** D-11/D-12。data/ は gitignore 対象外（確認済み）。docs/ には出さず非公開 data/ のみ。

---

## 空/欠損時のフォールバック

| Option | Description | Selected |
|--------|-------------|----------|
| 0件/欠損日はスキップ・OK扱い、パース/書込失敗のみ FAIL | 分析0件は正常系。デプロイはブロックしない | ✓ |
| 0件でも空エントリを書く / 欠損時 FAIL | 履歴汚染・過剰 FAIL のリスク | |

**User's choice:** スキップ・OK扱い（推奨自動採択）
**Notes:** D-13/D-14。破損 history 読込失敗はデフォルト「既存ファイル保全」に倒す。

---

## Claude's Discretion

- 専用ステップ番号（Step 3f 等）と STEP マーカー発出箇所（スクリプト stderr / invest.md echo）
- dateKey の導出（meeting-result.json date vs JST 再導出、docs/ 日付との一致が条件）
- `HoldingUrgencySnapshot` 型を新規定義するか `HoldingEvaluation` の Pick 派生とするか
- 破損 history 読込失敗時の再構築 vs 保全（デフォルト保全）

## Deferred Ideas

- 週次ロールアップの**表示**（portfolio.html セクション）— Phase 26 / HIST-03
- 履歴の剪定・ローテーション — 現時点 append-only、ファイルサイズ問題化で将来検討
- `rationale`/`riskNote` 等の履歴保存 — Phase 26 で必要になれば D-02 拡張として検討
