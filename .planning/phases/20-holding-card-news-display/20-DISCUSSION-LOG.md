# Phase 20: Holding-Card News Display - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 20-Holding-Card News Display
**Areas discussed:** カード内レイアウト, 表示件数と並び順, 各ニュースのメタ情報, 空状態・欠損時の表現（すべて Claude に委任）

---

## グレーエリア選択

| Option | Description | Selected |
|--------|-------------|----------|
| カード内レイアウト | 常時表示リスト vs 折りたたみ vs 独立ミニセクション | |
| 表示件数と並び順 | 5件全件 vs 3件絞り込み、供給順 vs 公開日時順 | |
| 各ニュースのメタ情報 | 公開日時・マッチ方式バッジ・スコアの表示可否 | |
| 空状態・欠損時の表現 | 空状態の文言・スタイル、ファイル欠損時の挙動 | |

**User's choice:** 「全部おまかせします。」（Other・自由記述）
**Notes:** 4エリアすべての実装判断を Claude に全面委任。Claude が既存パターン・Phase 19 決定・リサーチ文書（SUMMARY.md / PITFALLS.md）に基づき推奨案で確定した。

---

## Claude's Discretion

ユーザー委任により、以下をすべて Claude が決定（詳細は CONTEXT.md D-01〜D-10）:

- カード内レイアウト: rationale 下の常時表示コンパクトリスト（折りたたみ・テーブル不採用）
- 表示件数: holding-news.json の最大5件をそのまま全件表示（Phase 19 D-09 の透明性原則を維持）
- 並び順: 供給順踏襲（ticker一致優先 → スコア降順）
- メタ情報: 見出しリンク + ソース名 + 公開日時。社名/エイリアス一致のみバッジ表示、スコア非表示
- 空状態: 「本日の関連ニュースなし」をミュートグレーで明示（セクション省略不採用）
- 欠損時: holding-news.json 欠損は全銘柄0件扱いで fail-soft 継続、未解決IDは個別スキップ

加えて実装詳細（リゾルバー命名・配置、スタイル詳細、日時フォーマット、読み込み処理の組み込み方、テスト構成）も Claude の裁量。

## Deferred Ideas

- ニュースなし銘柄カードの視覚的デエンファシス（PITFALLS.md 提案）— Phase 22 の変化バッジ設計と合わせて検討
- 社名フォールバック誤マッチ率の定量集計監査 — マイルストーン監査時（D-07 バッジで目視監査は可能に）
