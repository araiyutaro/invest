# Phase 11: News Quality Enhancements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 11-news-quality-enhancements
**Areas discussed:** ティッカー別ニュースの対象範囲, 時間重み付けの反映方法, クロス言語dedupのアプローチ

---

## ティッカー別ニュースの対象範囲

### 対象範囲

| Option | Description | Selected |
|--------|-------------|----------|
| 米国銘柄のみ | Finnhubがサポートする8銘柄のみ。日本銘柄はRSSでカバー済み。API call: 8+2=10/実行 | ✓ |
| 全銘柄試行 | 12銘柄すべて試し、失敗したらスキップ。API call: 最大12+2=14/実行 | |

**User's choice:** 米国銘柄のみ
**Notes:** Finnhubの日本銘柄サポートは限定的なため実用的な選択

### 統合方法

| Option | Description | Selected |
|--------|-------------|----------|
| フラット統合+dedup | 全記事を同じ配列に入れ、既存のURL+Jaccard dedupが重複除去 | ✓ |
| ティッカー別優先 | ティッカー別ニュースを別枠で優先確保し、残り枠を汎用で埋める | |

**User's choice:** フラット統合+dedup
**Notes:** 既存filterロジックをそのまま活用できるシンプルなアプローチ

### 型拡張

| Option | Description | Selected |
|--------|-------------|----------|
| tickerフィールド追加 | RawNewsArticleにオプショナルなtickerフィールドを追加 | ✓ |
| categoryフィールドで代用 | 既存categoryに「company:MRNA」形式で入れる | |

**User's choice:** tickerフィールド追加
**Notes:** アナリストが銘柄関連記事を識別できるメリット

---

## 時間重み付けの反映方法

### 実現方法

| Option | Description | Selected |
|--------|-------------|----------|
| 数値スコア付与 | 記事に優先度スコアを計算。0-6h=1.0, 6-12h=0.7, 12-24h=0.4 | ✓ |
| ソート順のみ変更 | 6h以内を先頭に固定、その中で日時順 | |

**User's choice:** 数値スコア付与
**Notes:** より柔軟なスコアリングが可能

### ティッカーボーナス

| Option | Description | Selected |
|--------|-------------|----------|
| ティッカーボーナスあり | ポートフォリオ銘柄記事に+0.2ボーナス。時間スコアと加算 | ✓ |
| 時間スコアのみ | ティッカー別であっても純粋に時間だけでソート | |

**User's choice:** ティッカーボーナスあり
**Notes:** ポートフォリオ関連ニュースが優先的にアナリストに届く

### スコア配置

| Option | Description | Selected |
|--------|-------------|----------|
| ソート専用（型変更なし） | filterパイプライン内でスコア計算→ソートのみ。RawNewsArticleの型は変えない | ✓ |
| 型にスコア追加 | RawNewsArticleにオプショナルなscoreフィールドを追加 | |

**User's choice:** ソート専用（型変更なし）
**Notes:** 影響範囲を最小限に抑える

---

## クロス言語dedupのアプローチ

### dedup方式

| Option | Description | Selected |
|--------|-------------|----------|
| 固有名詞+日付近接 | タイトルから数値・英字固有名詞を抽出、発行日6h以内なら同一判定。npm依存ゼロ | ✓ |
| URLドメイン照合 | reuters.com↔jp.reuters.comのようなドメインペアマッピング | |
| 両方組み合わせ | URLドメイン+固有名詞マッチング | |

**User's choice:** 固有名詞+日付近接
**Notes:** コストゼロで中程度の精度。LLM per-articleはOut of Scopeのため軽量ヒューリスティック

### dedup許容度

| Option | Description | Selected |
|--------|-------------|----------|
| 保守的（見逃し許容） | 確実に同一と判断できるもののみ統合。160件/日では実害少 | ✓ |
| 積極的（誤判定許容） | より多くをdedupするが、別記事を誤統合するリスクあり | |

**User's choice:** 保守的（見逃し許容）
**Notes:** 重要な記事を落とすリスクを排除

### 残す言語

| Option | Description | Selected |
|--------|-------------|----------|
| summaryが長い方 | 既存dedupルールと一貫性を保つ。情報量が多い記事を優先 | ✓ |
| 英語優先 | Finnhub経由のソース情報が豊富 | |
| 日本語優先 | ユーザーが日本人なので読みやすい | |

**User's choice:** summaryが長い方
**Notes:** 既存のdedup D-02ルールとの一貫性

---

## Claude's Discretion

None — all areas had explicit user selections.

## Deferred Ideas

None — discussion stayed within phase scope.
