# Phase 27: ETF Exclusion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 27-ETF Exclusion
**Areas discussed:** 安全側方針（lookup失敗時）, ETF判定基準, TS側フィルタ統合ポイント, プロンプト指示の挿入箇所, 除外の可視性・監査性
**Mode:** --auto（全項目を推奨オプションで自動選択。ユーザーとの対話なし）

---

## 安全側方針（lookup失敗時の扱い）

| Option | Description | Selected |
|--------|-------------|----------|
| fail-closed（除外） | quoteType取得失敗の銘柄はhighlightedStocksから除外。ETF混入によるウォッチリスト履歴汚染を防ぐ | ✓ |
| fail-open（通過） | 取得失敗の銘柄はそのまま通過。正当な個別株のレポート脱落を防ぐが、ETFがすり抜ける | |

**Auto-selected:** fail-closed（research PITFALLS Pitfall 1 の明示推奨）。ただしフィルタ機構全体の故障は fail-soft で未フィルタ継続、という二段構えを明確化。

---

## ETF判定基準

| Option | Description | Selected |
|--------|-------------|----------|
| allowlist（EQUITYのみ通過） | quoteType === "EQUITY" 以外をすべて除外。日本ETF/REIT/投信を列挙不要で網羅 | ✓ |
| denylist（ETF/MUTUALFUNDを除外） | 既知のファンド系quoteTypeのみ除外。未知タイプは通過 | |

**Auto-selected:** allowlist。fail-closed 思想と整合し、quoteType は決定論的 enum のため news フィルタでの denylist 採用理由（誤除外54%）は当てはまらない。

---

## TS側フィルタの統合ポイント

| Option | Description | Selected |
|--------|-------------|----------|
| 純関数＋CLI分離を Step 2g 先頭に挿入 | src/portfolio/etf-exclusion.ts（純関数）+ src/scripts/filter-etf-stocks.ts（fail-soft CLI）。validate-meeting.ts の前に実行し tmp/meeting-result.json を書き戻す | ✓ |
| validate-meeting.ts を直接拡張 | 既存スクリプトにフィルタを内蔵。ステップ追加は不要だがバリデーションと副作用が混在 | |
| 独立した新パイプラインステップ | Step 2h として分離。マーカーは明確だが invest.md の構造変更が大きい | |

**Auto-selected:** 純関数＋CLI分離（urgency-history の実証済みパターン踏襲、Phase 28 での純関数再利用を考慮）。batch quote() 1回でレート制限回避。専用 [STEP:etf-exclusion:*] マーカー付き。

---

## プロンプト指示の挿入箇所

| Option | Description | Selected |
|--------|-------------|----------|
| invest.md の Round 1 5ブロック＋Step 2f | picks 出力契約が定義される正準位置に追記。モデレーターにも防御 | ✓ |
| src/agents/*.ts の systemPrompt | エージェント人格定義側に追記。ただし picks 契約は invest.md 側にあり二重管理になる | |
| 両方に追記 | 最大限の冗長防御だが文言の同期管理コストが発生 | |

**Auto-selected:** invest.md のみ（Round 1 5ブロック＋Step 2f モデレーター注意事項）。二重管理を回避。

---

## 除外の可視性・監査性

| Option | Description | Selected |
|--------|-------------|----------|
| console ログのみ | 除外ティッカー・quoteType・理由を標準出力へ。launchd ログで事後監査可能 | ✓ |
| 永続監査ファイル（data/） | 除外履歴をJSONで永続化。ただし Phase 28 の removedReason 方式と重複 | |
| meeting-result.json に excluded フィールド追加 | スキーマ変更が必要で下流への影響範囲が広い | |

**Auto-selected:** console ログのみ。スキーマ変更なし・新規永続ファイルなし。

---

## Claude's Discretion

- 純関数のシグネチャ・型定義の詳細
- CLI ラッパーのログフォーマット文言
- batch quote() レスポンスの防御的パース実装

## Deferred Ideas

- Step 2b（extract-tickers.ts）段階での早期ETFフィルタ（最適化、将来検討）
- 除外履歴の永続化（Phase 28 のウォッチリスト状態テーブルが担う）
- ウォッチリスト admission 側の防御的二重フィルタ（Phase 28 管轄、純関数を再利用）
