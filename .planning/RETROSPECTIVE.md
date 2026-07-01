# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.3 — Analysis Quality & Operational Stability

**Shipped:** 2026-07-01
**Phases:** 5 (11-14.1) | **Plans:** 12 | **Tasks:** 25

### What Was Built
- ニュース品質底上げ: Finnhubティッカー別カンパニーニュース取得、直近6h優先の時間重み付けスコア、英日クロス言語dedup (Phase 11)
- 分析品質: 前日 meeting-result.json をRound 1全5エージェントに注入するクロスセッション記憶、Round 3スコアリングの専用並列エージェント化 (Phase 12)
- 運用安定性: STEP マーカー（START/OK/FAIL）ログ、docs HTMLのSHA256チェックサム保護、macOS通知 (Phase 13)
- レポートUI: 外部ライブラリ不要のインラインSVGチャート（セクター横バー/VIX折れ線）、index.htmlヒーロー+月別アコーディオン刷新、モバイルレスポンシブCSS (Phase 14)
- OPSギャップ実修正: run.sh の stream-json 化でSTEPマーカーがログ到達、EXIT_CODE 実捕捉、deploy の spawnSync 引数配列化でシェルインジェクション除去 (Phase 14.1)

### What Worked
- 監査駆動のギャップクローズ: マイルストーン監査が Phase 13 の「実装済み」誤判定（OPS-01/03）を発見し、Phase 14.1 を挿入して根本バグ（run.sh 35-41行）を実修正できた
- TDD の徹底（RED→GREEN）が Phase 11/14 のピュア関数（スコアリング、SVGレンダラ）で機能
- tmp/*.json ファイル境界による TS↔Claude ハンドオフが安定
- 監査再実行 + gsd-integration-checker による実コード独立検証で、修正後の CONNECTED を客観確認

### What Was Inefficient
- Phase 13 の VERIFICATION がコード実装を「済み」と誤判定し、監査まで発覚しなかった（静的読解のみで run.sh の実挙動を追えていなかった）
- finnhub.ts:43 の Array.map (value, index) シグネチャ取り違えバグが tech debt として残存（tsc で検出済みだが未修正）
- 11-01/11-02 の SUMMARY.md に requirements-completed frontmatter が欠落し、監査で3ソース相互参照が必要になった

### Patterns Established
- 「実装済み」判定は必ず実コード（実ファイル内容）に対する検証を伴うこと。VERIFICATION は静的読解を超えた実挙動確認を要する
- 監査 gaps_found → `/gsd-phase --insert` でクローズフェーズ挿入 → discuss/plan/execute → 監査再実行、のクローズループ
- LLM生成値（date等）を外部コマンドに渡す際は正規表現検証 + spawnSync 引数配列（execSync文字列連結禁止）
- 外部チャートライブラリを足さず、既存の formatXxxHtml 規約に沿ったピュアSVG文字列生成

### Key Lessons
1. 監査は実コードを検証する。Phase単位の VERIFICATION が「human_needed」で止まる領域（run.sh の実行時挙動）こそ、後続監査で実ファイルを読んで裏取りする価値が高い。
2. `set -euo pipefail` 下の grep パイプ（ノーマッチ）はスクリプトを黙って中断しうる。`2>/dev/null | ... || true` でガードする（CR-01）。
3. tsc --noEmit で検出済みの型契約違反は、実害が軽微でも frontmatter/deferred-items に明記し、次マイルストーンで確実に拾う。

### Cost Observations
- Model mix: 主にサブエージェント（executor/reviewer/integration-checker）へ委譲、メインは Opus で監査・レビュー主導
- Notable: 監査再実行 + 統合チェッカーの二段検証が、誤判定の再クローズにおいて費用対効果が高かった

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v2.0 | 4 | Gemini → Claude Code サブエージェント移行 |
| v2.1 | 3 | 3レポート構成復元 + 自動デプロイ |
| v2.2 | 3 | ニュース品質フィルタ（TDDピュア関数モジュール）+ パイプライン計測 |
| v2.3 | 5 | 監査駆動のギャップクローズ（Phase 14.1挿入）で誤判定を実修正 |

### Top Lessons (Verified Across Milestones)

1. TS↔Claude のハンドオフは stdout ではなく tmp/*.json ファイル境界を経由する（v2.2で確立、v2.3で継続有効）。
2. 新規npm依存を足さずネイティブTypeScript/SVGで実装する方針が品質と保守性を両立（v2.2 Jaccard、v2.3 SVGチャート）。
3. 「実装済み」の主張は実コード検証で裏取りする（v2.3で顕在化した教訓）。
