# Phase 24: Digest-Meeting Cross-Reference - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 24-digest-meeting-cross-reference
**Mode:** `--auto`（全グレーエリアを自動選択、各設問で推奨=第一選択肢を採用）
**Areas discussed:** Match signal & priority, Annotation content, Visual placement, Multi-match cap, Integration & fail-soft isolation, Symbol normalization

---

## Match signal & priority（照合ソースと優先順位）

| Option | Description | Selected |
|--------|-------------|----------|
| ティッカー一致優先 + テーマキーワードフォールバック | highlightedStocks/scoredTickers のティッカー照合を優先、不一致時のみ sectorRecommendations のセクター名を title 照合 | ✓ |
| テーマ照合を主軸 | セクター/イベントのキーワード照合を第一とする | |
| 全ミーティングテキストの全文照合 | marketOverview/rationale 等も含め広く照合 | |

**User's choice:** ティッカー一致優先 + テーマキーワードフォールバック（recommended default）
**Notes:** holding-news.ts の「ticker一致 > 社名一致」設計思想を写像。title-only 照合・early-continue も踏襲。

---

## Annotation content（注記の内容）

| Option | Description | Selected |
|--------|-------------|----------|
| 銘柄+verdict / セクター名 | ティッカー一致は「シンボル + 強気/中立/弱気」、テーマ一致はセクター名。全て meeting フィールドから決定論導出 | ✓ |
| バイナリバッジのみ | 「ミーティングで議論」の有無だけを示す | |
| フル rationale 表示 | セクター rationale や stock summary の散文を注記に含める | |

**User's choice:** 銘柄+verdict / セクター名（recommended default）
**Notes:** LLM 生成散文は一切含めない。プレフィックスは固定文字列。

---

## Visual placement（視覚的マーカーの配置）

| Option | Description | Selected |
|--------|-------------|----------|
| news-meta 下の独立注記チップ | .ticker-pill 系スタイル + ミーティングアクセント色、一致0件は非描画 | ✓ |
| h4 見出し行にインラインバッジ | importance バッジの隣に追加 | |
| カード下部の別ブロック | commentary の下に枠付きブロックで表示 | |

**User's choice:** news-meta 下の独立注記チップ（recommended default）
**Notes:** 既存レイアウトへの加法的変更。escapeHtml 必須。0件時レイアウト崩れなし。

---

## Multi-match cap（複数一致時のキャップ）

| Option | Description | Selected |
|--------|-------------|----------|
| ティッカー最大2 + テーマ最大1 | ticker優先で上限キャップ、決定論的安定順 | ✓ |
| キャップなし（全件表示） | 一致した全ティッカー/テーマを表示 | |
| 1件のみ（最優先のみ） | 最も確実な1マッチだけ表示 | |

**User's choice:** ティッカー最大2 + テーマ最大1（recommended default）
**Notes:** holding-news.ts の MAX_ARTICLES_PER_HOLDING / rank-and-cap の思想を踏襲。

---

## Integration & fail-soft isolation（統合ポイント・fail-soft 隔離）

| Option | Description | Selected |
|--------|-------------|----------|
| 新規純関数 digest-crossref.ts + 専用 try/catch + 専用 STEP マーカー | write-news-digest.ts 内で digest 生成とは独立に隔離、crossref 例外時は空注記で通常描画 | ✓ |
| generate-news-digest.ts 内に直接実装 | レンダラーにマッチングを内包 | |
| 既存 digest try/catch に相乗り | 同じ catch で処理（crossref 失敗が digest を巻き込む） | |

**User's choice:** 新規純関数 + 専用 try/catch + 専用 STEP マーカー（recommended default）
**Notes:** Success Criteria #3 の「crossref 例外が digest/既存3レポートをブロックしない」を構造的に保証。`[STEP:digest-crossref:*]` を新設、`[PIPELINE:FAIL]` は出さない。

---

## Symbol normalization（シンボル正規化）

| Option | Description | Selected |
|--------|-------------|----------|
| normalizeHoldingSymbol 方式（trim + toUpperCase） | holding-news.ts と同一の正準化で US/JP ティッカーの表記揺れを吸収 | ✓ |
| 正規化なし（厳密一致） | article.ticker と meeting ticker を素で比較 | |

**User's choice:** normalizeHoldingSymbol 方式（recommended default）
**Notes:** 既存関数の再利用 or 同一実装は planner が判断。

---

## Claude's Discretion

- STEP マーカーの発出箇所（スクリプト内 stderr か invest.md 側 echo か）— 既存 news-digest / portfolio-research パターンに合わせる
- 注記の絵文字/プレフィックス文言・チップの正確な CSS 色値 — パープルアクセント（#8b5cf6）系との調和範囲で
- テーマ照合を weeklyEvents/riskWarnings に広げるか — デフォルトはセクター名のみ（保守的）

## Deferred Ideas

- テーマ照合対象の weeklyEvents/riskWarnings への拡張（過剰注記が問題化した場合）
- ミーティング未議論記事への明示ラベル（現時点は「注記なし通常表示」で十分）
- 緊急度履歴・週次ロールアップ（Phase 25/26 の担当）
