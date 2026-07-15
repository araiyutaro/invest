# Phase 31: Daily Report Watchlist Section - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 31-Daily Report Watchlist Section
**Areas discussed:** セクション配置と見出し, 銘柄表示フォーマット, バッジ体系と判定変化の視覚表現, ローダー契約と空・欠損・日付不整合の描画状態
**Mode:** --auto（全質問で推奨オプションを自動選択。ユーザーへの対話プロンプトなし）

---

## セクション配置と見出し

| Option | Description | Selected |
|--------|-------------|----------|
| 注目銘柄スコアリング直後 | 強気銘柄→ウォッチリストの文脈連続性。行動可能情報を市場文脈の後・詳細リサーチの前に配置（推奨） | ✓ |
| レポート末尾（週間イベント後） | 追加情報として最後にまとめる | |
| 市場概況直後（レポート先頭付近） | 最重要情報として最上部に | |

**Auto-selected:** 注目銘柄スコアリングマトリクス直後・WebSearch リサーチ結果の前（D-01）
**Notes:** [auto] 専用純関数としてセクションを実装（既存セクション関数の規律準拠、D-02）。

---

## 銘柄表示フォーマット

| Option | Description | Selected |
|--------|-------------|----------|
| portfolio-report カード様式 | h4 見出し＋散文段落。LLM散文はテーブル不可の既存方針に整合（推奨） | ✓ |
| テーブル（スコアリングマトリクス様式） | コンパクトだが rationale 散文がテーブルを崩す | |
| シンプル箇条書きリスト | 最小実装だがバッジ・メタ情報の載せ場が乏しい | |

**Auto-selected:** portfolio-report 保有銘柄カード様式の流用（D-03）
**Notes:** [auto] 会社名は watchlist.json join（D-04）、signals 列挙（D-05）、as-of＋市場セッション注記必須（D-06）、skipped は「判定不能」グレー表示（D-07）、登録日メタ表示（D-08）。

---

## バッジ体系と判定変化の視覚表現（UI-10）

| Option | Description | Selected |
|--------|-------------|----------|
| 既存バッジ視覚文法の踏襲＋方向別色分け | formatUrgentBadgeHtml/formatDecisionChangedBadgeHtml と同文法。buy=緑・待ち→買い=緑系点灯・買い→待ち=アンバー系（推奨、UI-10 の文言どおり） | ✓ |
| 新規デザイン体系 | 既存バッジUXとの一貫性を損なう（UI-10 違反） | |
| テキストのみ（バッジなし） | 一目把握という Phase Goal を満たさない | |

**Auto-selected:** 既存バッジ視覚文法の踏襲＋方向別色分け（D-09/D-10）
**Notes:** [auto] 変化バッジは TS 付与の actionChanged のみを情報源とし、undefined/false はいずれも非表示（D-10/D-11）。buy バッジは目立たせ wait は控えめにする強度非対称。

---

## ローダー契約と空・欠損・日付不整合の描画状態

| Option | Description | Selected |
|--------|-------------|----------|
| throw-free ローダー新設＋date 不一致は stale 扱い＋3状態描画 | loadUrgencyHistory 様式踏襲。judgment ファイル残留（Phase 30 D-22）による前日データ誤表示を date ガードで防止（推奨） | ✓ |
| ローダーのみ新設（date 検証なし） | Step 3-J 失敗日に前日判定を当日として誤表示するリスク | |
| 欠損時もセクション枠を常時表示 | 誤解を招く空枠。非表示のほうが fail-soft として自然 | |

**Auto-selected:** throw-free ローダー新設＋date 不一致 stale 扱い＋3状態描画（D-12/D-13/D-14）
**Notes:** [auto] generateDailyReportHtml への受け渡しは加法的 optional 引数で既存テスト非破壊（D-15）。invest.md の変更は不要。

---

## Claude's Discretion

- セクション見出しの正確な文言・HTML/CSS 詳細（ピル vs 箇条書き）
- バッジの正確な色コード（既存配色との整合範囲内）
- formatWatchlistSectionHtml の配置と関数シグネチャ
- ローダーの正確な形（loadWatchlist 新設 vs 既存関数の防御的ラップ）
- 単体テストのケース構成の詳細

## Deferred Ideas

- stale「待ち」エントリの視覚的減衰（グレーアウト等） — 実運用で観測されたら
- 判定履歴永続化と的中率検証（WLST-F2）
- TS 側表示デバウンス（Phase 30 D-12 継続）
- index.html へのウォッチリスト導線強化
- 保有銘柄への買い増しタイミング判定（WLST-F1）
