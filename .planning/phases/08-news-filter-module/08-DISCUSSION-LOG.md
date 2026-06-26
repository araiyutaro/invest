# Phase 8: News Filter Module - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 08-news-filter-module
**Areas discussed:** 重複排除の閾値, denylistの設計, 既存dedupの統合

---

## 重複排除の閾値

### Q1: Jaccard類似度の閾値をどう設定しますか？

| Option | Description | Selected |
|--------|-------------|----------|
| 0.70（積極的） | 重複を多く排除。似た見出しの別記事も統合されるリスクあり | |
| 0.75（バランス） | SUMMARY.md推奨の中間値。精度と網羅性のバランス | ✓ |
| 0.80（保守的） | 本当に同じ記事だけ排除。重複が残る可能性あるが安全 | |
| 設定可能に | 定数で外出しして実データで調整できるようにする | |

**User's choice:** 0.75（バランス）

### Q2: 重複排除で同一記事が見つかった場合、どの記事を残しますか？

| Option | Description | Selected |
|--------|-------------|----------|
| 日本語優先 | 日本語記事があればそちらを残す | |
| 新しい方を残す | publishedAtが新しい方を優先 | |
| summaryが長い方 | より詳細な記事を優先 | ✓ |

**User's choice:** summaryが長い方（アナリストへの情報量最大化）

---

## denylistの設計

### Q1: denylistのマッチング方式をどうしますか？

| Option | Description | Selected |
|--------|-------------|----------|
| 除外+例外ルール | denylistにマッチしても投資関連キーワードがあれば通す | ✓ |
| 単純部分文字列 | キーワードが含まれたら除外。誤除外のリスクあり | |
| カテゴリ制限のみ | denylistを使わずRSSソースのcategoryフィールドだけでフィルタ | |

**User's choice:** 除外+例外ルール

### Q2: 除外すべきカテゴリとして、どのようなジャンルを想定していますか？

| Option | Description | Selected |
|--------|-------------|----------|
| 娯楽・スポーツ・天気 | 明らかに無関係なものだけ | ✓ |
| 上記 + 政治・社会 | 選挙・犯罪・社会問題なども除外 | |
| 最小限だけ | スポーツ結果と芸能のみ | |

**User's choice:** 娯楽・スポーツ・天気（政治・社会は投資に影響するため除外しない）

---

## 既存dedupの統合

### Q1: rss-sources.ts内の既存dedupロジックをどうしますか？

| Option | Description | Selected |
|--------|-------------|----------|
| 完全削除して一元化 | rss-sources.tsからdedup削除、filter.tsで全ソース横断のみ | ✓ |
| 残しつつ改善 | rss-sources.ts内dedupをJaccardに差し替え、filter.tsでもクロスソースdedup | |
| そのまま残す | rss-sources.tsのdedupはそのまま、filter.tsはクロスソースのみ担当 | |

**User's choice:** 完全削除して一元化（シンプルで管理しやすい）

---

## Claude's Discretion

- denylistの具体的なキーワードリストの策定
- NFKC正規化の詳細実装パターン
- URL正規化の具体的な方法
- `NewsFilterResult` / `NewsFilterStats` の型設計

## Deferred Ideas

None — discussion stayed within phase scope
