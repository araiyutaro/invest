# Phase 22: Portfolio-Analyst Re-Evaluation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 22-Portfolio-Analyst Re-Evaluation
**Mode:** --auto（全エリア自動選択、各質問で推奨オプションを採用）
**Areas discussed:** リサーチ結果のプロンプト注入, アンカリング対策, 緊急度フラグの出力契約, 前日スナップショットと差分検出, カード視覚強調, スコープ境界

---

## リサーチ結果のプロンプト注入（PORT-03）

| Option | Description | Selected |
|--------|-------------|----------|
| invest.md Step 3d で Read→埋め込み | holding-news D-07 前例踏襲。読み込みリストに tmp/portfolio-research/*.json を追加 | ✓ |
| TSローダー経由で注入 | プロンプト組み立てを TS 側へ移す。既存の orchestration 層責務分担に反する | |

**Auto-selected:** invest.md 直接埋め込み（既存規約との整合・変更最小）
**Notes:** 埋め込みフィールドは researchSummary + positive/negativeFindings のみ（keyArticles の URL は非注入）。全12銘柄列挙 + 失敗銘柄は「本日のリサーチ結果なし」明記。rationale 上限は 200→300 文字に拡大。

---

## アンカリング対策（Pitfall 9）

| Option | Description | Selected |
|--------|-------------|----------|
| independent-then-compare 構成 | まず本日の材料のみで独立評価→その後前日判断と比較。前日セクションはプロンプト末尾 | ✓ |
| 前日判断を冒頭参照として提示 | 既存 Step 3b 流の「あなたの前回判断（参考）」形式。アンカリングリスクが文献で指摘 | |

**Auto-selected:** independent-then-compare（リサーチ SUMMARY.md §Phase 4 の明示推奨）
**Notes:** changed 比率のライブ観測は 22-HUMAN-UAT.md へ。

---

## 緊急度フラグの出力契約（PORT-04）

| Option | Description | Selected |
|--------|-------------|----------|
| LLM出力 `urgent: boolean` + alias-transform 硬化 | UI-07 の機械可読要求と ROADMAP 文言（「フラグが付与され」）を直接満たす | ✓ |
| riskNote テキストへの折込み | リサーチ SUMMARY.md 案。スキーマ表面は増えないが機械可読でなくバッジ描画が不安定 | |
| TS側キーワード検知 | 決定論的だが表記揺れに脆い。重大材料の判定は文脈依存 | |

**Auto-selected:** `urgent: boolean` 新設（省略時 false、urgency/isUrgent 等を alias 吸収）
**Notes:** 緊急理由は riskNote に記載（新フィールド追加なし）。乱発防止指示付き。

---

## 前日スナップショットと差分検出（PORT-05）

| Option | Description | Selected |
|--------|-------------|----------|
| Step 3d 冒頭で tmp→prev コピー + TS等値比較 | ANLQ-01 前例そのまま。tmp/ の実行間残留を利用。差分は decision enum 等値比較 | ✓ |
| docs/ の過去レポートからパース | HTML パースが必要で脆い。ANLQ-01 も採用していない | |
| LLM に decisionChanged を自己申告させる | 要件（PORT-05）が明示的に禁止 | |

**Auto-selected:** ANLQ-01 ミラー + TS決定論計算
**Notes:** prev 欠損・銘柄不一致は decisionChanged = undefined（バッジなし、「変化なし」と区別）。LLM が decisionChanged/previousDecision を出力しても strip。ローダー console.warn 必須 + 既存 loadWebSearchResults/loadReevalResults の負債も併せて回収（Phase 21 deferred）。

---

## カード視覚強調（UI-07）

| Option | Description | Selected |
|--------|-------------|----------|
| バッジ2種追加・border-left は decision 色維持 | 緊急=赤ピル「⚠ 緊急」、変化=アンバー「判断変更: 前日→当日」。decision 色の意味論を保持 | ✓ |
| urgent 時に border-left を赤へ上書き | 全売却（既存赤）と区別不能になり decision 色の意味論が崩れる | |

**Auto-selected:** バッジ方式（既存「社名一致」ピルの実装流儀踏襲）
**Notes:** 薄い赤背景ティント等の追加強調は Claude's discretion。ニュースなし銘柄のデエンファシス（Phase 20 deferred）は不採用。

---

## スコープ境界

- リサーチ内容のカード直接表示: 不採用（要件外、v2.6+ 候補）
- 第2の再評価エージェント艦隊（Step 3b 流の5エージェント）: 不採用（リサーチの最重要推奨 — 単一 portfolio-analyst 呼び出しを維持）

## Claude's Discretion

- プロンプトセクションの見出し文言・並び順詳細
- urgent カードの追加強調スタイルの有無
- バッジの文言・スタイル詳細
- prev スナップショットスニペットの具体形
- HoldingEvaluation 型拡張の実装形（LLM出力フィールドと TS付与フィールドの区別表現)
- リサーチ12ファイルのプロンプト展開整形

## Deferred Ideas

- changed 比率の複数日ライブ観測 → 22-HUMAN-UAT.md
- hasNewInformation 形式の構造的区別 → v2.6+
- リサーチ内容のカード表示 → v2.6+
- 緊急度フラグの履歴監査トレイル（PORT-F1）→ v2.6+
- ニュースなし銘柄のデエンファシス → 不採用（再検討は v2.6+）
