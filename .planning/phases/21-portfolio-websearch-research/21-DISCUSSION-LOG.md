# Phase 21: Portfolio WebSearch Research - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 21-Portfolio WebSearch Research
**Mode:** --auto（全質問で Claude が推奨オプションを自動選択、ユーザー確認なし）
**Areas discussed:** パイプライン配置と並列実行設計, クエリ設計とエンティティ誤認対策, 出力契約とディレクトリ運用, fail-soft挙動とSTEPマーカー・計測

---

## パイプライン配置と並列実行設計

| Option | Description | Selected |
|--------|-------------|----------|
| Step 3.0 直後に独立ステップとして挿入 + 候補ラウンドと逐次実行 | highlightedStocks 0件時のスキップ分岐に影響されず必ず実行される。ピーク並列度を約12に抑制（Pitfall 6） | ✓ |
| Step 3a と同時並列実行 | 実行時間は最短だがピーク並列 Agent 数が最大27に達し、無人実行での429/529リスクが増大 | |
| Step 3b の後（Step 3d の直前）に挿入 | 逐次だが highlightedStocks 0件時のジャンプ先変更が必要になり分岐管理が複雑化 | |

**Auto-selected:** Step 3.0 直後 + 逐次実行（1メッセージで12 Agent並列、切り詰め観測時のみ6+6分割にフォールバック）
**Notes:** SUMMARY.md の推奨「まず12並列を試し、必要時のみ分割」と Pitfall 6 の「逐次/並列は名前付き決定にせよ」を両立。Agentモデルは Step 3a と同じ sonnet。

---

## クエリ設計とエンティティ誤認対策

| Option | Description | Selected |
|--------|-------------|----------|
| ティッカー+社名併記クエリ + エンティティ確認指示 + 日本株は日本語クエリ | EE（英通信）/NXT（英小売）の衝突を構造的に回避（Pitfall 5）。日本小型株4銘柄は nameJa の日本語クエリでカバレッジ確保 | ✓ |
| Step 3a テンプレートをそのまま流用（bareティッカー） | プロンプト作成工数ゼロだが EE/NXT で誤エンティティ情報が売却・保有判断へ混入するリスク | |

**Auto-selected:** 社名併記 + エンティティ確認指示 + 日本語クエリ
**Notes:** リサーチ観点は PORT-02 の列挙（決算・訴訟・規制変更・大型契約・ガイダンス変更）を反映。定性情報のみ（Step 3a 方針踏襲）。フェーズ検証で EE/NXT をスポットチェック。

---

## 出力契約とディレクトリ運用

| Option | Description | Selected |
|--------|-------------|----------|
| WebSearchResult 形状をそのまま再利用 + alias-transform 硬化 + 全12ファイル必書き+ステップ冒頭クリーン | SUMMARY.md の明示推奨。緊急度フィールド追加は Phase 22 の portfolio-analyst 判断に委ねる。前日ファイル残留を構造的に防止 | ✓ |
| 新設スキーマに urgentSignals 等の構造化フィールドを追加 | Phase 22 の PORT-04 を先取りできるがスコープ超過、SUMMARY.md は「WebSearchResult 無変更再利用」を推奨 | |
| 既存 webSearchResultSchema を無改変で流用 | 最小工数だが alias-transform 未適用のままでフィールド名発明インシデント（Pitfall 8）の再発面が12倍化 | |

**Auto-selected:** WebSearchResult 再利用 + alias-transform 硬化 + tmp/portfolio-research/ 分離 + クリーン&全件書き込み
**Notes:** tmp/websearch/・tmp/reeval/ への書き込みは絶対禁止（Pitfall 1）。ファイル名は symbol そのまま（`/`→`-` 置換のみ）。TSローダー統合は Phase 22。

---

## fail-soft挙動とSTEPマーカー・計測

| Option | Description | Selected |
|--------|-------------|----------|
| 12/12=OK、1件でも失敗=FAIL（ティッカー明記）だがパイプライン継続 + metrics記録 | OPS-05「一部または全部の失敗が可視化」を文字通り満たす。run.sh の既存3値語彙（START/OK/FAIL）と互換。news-digest の非ブロッキングFAIL前例踏襲 | ✓ |
| 1件以上成功なら OK（メッセージのみで部分失敗を表示） | 通知ノイズは減るがSTEPマーカーでの失敗可視化という要件の文言を満たさない | |
| PARTIAL マーカーを新設 | 意味論は明確だが run.sh のマーカーパースに新語彙対応が必要になり変更範囲が拡大 | |

**Auto-selected:** OK/FAIL 2値 + FAIL詳細に失敗ティッカー列挙 + 非ブロッキング継続
**Notes:** ユーザー表示は「ポートフォリオリサーチ完了: N/12銘柄成功」形式。pipeline-metrics.json に portfolioResearchStart/End を追加し最終のステップ別時間表示に組み込む（Pitfall 6 の継続観測）。

---

## Claude's Discretion

- 新ステップの節番号・見出し命名（invest.md 既存構成との整合優先）
- クエリテンプレートの具体的文言・本数（2-3回の範囲）
- alias-transform の実装形（バックポート vs 新設スキーマ）
- フォールバックJSONの researchSummary 文言
- フェーズ検証でのスキーマ適合確認の実施形

## Deferred Ideas

- リサーチ結果の portfolio-analyst 注入・再評価・アンカリング対策（PORT-03, Pitfall 9）— Phase 22
- 緊急度フラグ（PORT-04）・前日比較（PORT-05）— Phase 22
- tmp/portfolio-research/ の TS ローダー（Pitfall 7 の console.warn 規約適用）— Phase 22
- 既存 loadWebSearchResults/loadReevalResults の catch ログ負債修正 — Phase 22 で併せて検討
- 6+6 バッチ分割 — ライブ検証で切り詰め観測時のみ
