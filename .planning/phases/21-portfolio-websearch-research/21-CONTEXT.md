# Phase 21: Portfolio WebSearch Research - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning
**Mode:** --auto（Claude が既存パターン・前フェーズ決定・v2.5リサーチ文書に基づき推奨決定を自動選択）

<domain>
## Phase Boundary

保有12銘柄それぞれについてWebSearchによる最新材料リサーチ（決算・訴訟・規制変更・大型契約・ガイダンス変更等）が実行され、結果が Daily Report 用領域（tmp/websearch/）とは分離された専用領域 `tmp/portfolio-research/{symbol}.json` に保存される。一部または全部の銘柄でリサーチが失敗しても、4レポート全ての生成・デプロイが継続し、専用の `[STEP:portfolio-research:*]` マーカーで失敗が可視化される（PORT-02, OPS-05）。

具体的な成果物:
1. invest.md への新設パイプラインステップ（12銘柄並列の WebSearch リサーチ Agent、Step 3a パターン踏襲）
2. `tmp/portfolio-research/` 専用ディレクトリへの銘柄別JSON保存（Daily Report ローダーから完全隔離）
3. fail-soft 動作: 部分/全部失敗時もパイプライン継続 + `[STEP:portfolio-research:*]` マーカーによる失敗可視化 + pipeline-metrics 計測

リサーチ結果を portfolio-analyst プロンプトへ注入し売却・保有判断を再評価すること（PORT-03/04/05）は Phase 22、カード表示は Phase 20（完了済み）、新規組入候補セクション削除は Phase 23 の対象であり本フェーズには含まない。

</domain>

<decisions>
## Implementation Decisions

**注:** `--auto` モードにより、以下は Claude が Step 3a 前例・v2.5 リサーチ文書（SUMMARY.md / PITFALLS.md）・既存 fail-soft 規約に基づいて確定した推奨決定。

### パイプライン配置と並列実行設計
- **D-01:** 新ステップは **Step 3.0（準備）直後、`highlightedStocks` 0件分岐より前**に独立ステップとして挿入する。候補銘柄が0件で Step 3a/3b がスキップされる日でも保有銘柄リサーチは必ず実行される（保有リストは固定12銘柄で候補数に依存しない）
- **D-02:** 候補銘柄WebSearchラウンド（Step 3a）とは**逐次実行**（同時に走らせない）。ピーク並列Agent数を約12に抑え、無人実行での429/529レート制限リスクを抑制する（PITFALLS.md Pitfall 6 の名前付き決定。実行時間増よりも無人パイプラインの安定性を優先）
- **D-03:** ラウンド内は **1メッセージで12 Agent並列**（Step 3a 前例踏襲）。ライブ検証で切り詰め・失敗多発が観測された場合のみ6+6の2バッチに分割するフォールバックを採用（リサーチ SUMMARY.md 推奨）
- **D-04:** リサーチAgentのモデルは **sonnet**（Step 3a と同一。12並列のコスト・速度バランス）

### クエリ設計とエンティティ誤認対策
- **D-05:** WebSearchクエリは**必ずティッカー+社名併記**（例: `"Excelerate Energy (EE) stock latest news"`）。bareティッカークエリは不採用 — EE（英通信会社）/ NXT（英小売NEXT plc）のエンティティ衝突が売却・保有判断を汚染するリスク（Pitfall 5）
- **D-06:** 日本株4銘柄（8522.T / 5885.T / 5576.T / 7711.T）は **nameJa による日本語クエリ**を使用（例: `"名古屋銀行 決算 ニュース"`）。英語クエリでは日本小型株の材料が実質取得できないため
- **D-07:** Agentプロンプトに**エンティティ確認指示を必須添付**: 「結果が {name}（{ticker}）に関するものか必ず確認し、別企業・別銘柄の情報は除外すること」。フェーズ検証で EE / NXT の出力を個別スポットチェックする
- **D-08:** リサーチ対象は**定性情報のみ**（決算・訴訟・規制変更・大型契約・ガイダンス変更等の材料）。株価・財務数値は Yahoo Finance で別途取得済みのため対象外（Step 3a の既存方針踏襲）。クエリは保有銘柄の売却・保有判断に効く材料（ネガティブ材料含む）へ焦点を当てる

### 出力契約とディレクトリ運用
- **D-09:** 出力JSONは**既存 `WebSearchResult` 形状をそのまま再利用**（ticker / researchSummary / positiveFindings / negativeFindings / keyArticles / researchedAt）。新フィールドは追加しない — 緊急度検知（PORT-04）は Phase 22 で portfolio-analyst が内容から判断する設計（リサーチ SUMMARY.md の明示推奨）
- **D-10:** 保存先は `tmp/portfolio-research/{symbol}.json`（ロードマップ Success Criteria で確定済み）。ファイル名は symbol そのまま（`.T` サフィックス可、`/` のみ `-` 置換の Step 3a 規約踏襲）。**tmp/websearch/ / tmp/reeval/ への書き込みは絶対禁止**（Daily Report ローダーが無差別に全ファイルを読むため。Pitfall 1）
- **D-11:** ステップ冒頭で `tmp/portfolio-research/` を**クリーン（既存JSONを削除）してから mkdir**し、失敗銘柄も含め**全12ファイルを必ず書く**（無効JSON時は Step 3a 前例のフォールバックJSONを保存）。前日ファイルの残留や保有リスト変更時の古い銘柄ファイル混入を構造的に防止
- **D-12:** zodスキーマには **alias-transform（`passthrough().transform()`）硬化を適用**する（Pitfall 8: フィールド名発明インシデントの再発防止。12銘柄分プロンプトで表面積が12倍）。既存 `webSearchResultSchema` へのバックポートか新設スキーマかは planner の裁量。TS側のレポート統合ローダーは Phase 22 の領域だが、ファイル契約を定義するスキーマ+ユニットテストは本フェーズで整備し、フェーズ検証（保存された12ファイルのスキーマ適合確認）にも使用する

### fail-soft挙動とSTEPマーカー・計測
- **D-13:** マーカーは `[STEP:portfolio-research:START]` / `[STEP:portfolio-research:OK]` / `[STEP:portfolio-research:FAIL:詳細]` の既存3値語彙を使用（run.sh のパースとの互換のため PARTIAL 等の新値は導入しない）
- **D-14:** マーカー意味論: **12/12成功 → OK。1銘柄でも失敗 → FAIL（失敗ティッカーを詳細に明記、例: `[STEP:portfolio-research:FAIL:3/12銘柄失敗（EE, NXT, 5576.T）]`）。ただしFAILでもパイプラインは継続**（news-digest の非ブロッキングFAIL前例踏襲）。OPS-05「一部または全部の失敗が可視化される」を文字通り満たし、レート制限傾向の監視（Pitfall 6 警告サイン）にも使う
- **D-15:** ユーザー表示は「ポートフォリオリサーチ完了: N/12銘柄成功」の部分成功形式（Step 3a の N/{total} 前例踏襲）
- **D-16:** `tmp/pipeline-metrics.json` に `portfolioResearchStart` / `portfolioResearchEnd` を記録し、最終のステップ別実行時間表示に「ポートフォリオリサーチ」行を追加（実行時間増加を継続観測可能にする。Pitfall 6）

### Claude's Discretion
- 新ステップの節番号・見出し命名（例: Step 3a の前に「Step 3-P」等。invest.md 既存の節構成との整合を優先）
- クエリテンプレートの具体的文言・本数（2-3回の範囲で Step 3a 踏襲）
- alias-transform の実装形（既存 webSearchResultSchema バックポート vs 新設 portfolioResearchSchema）
- フォールバックJSONの researchSummary 文言（「リサーチ失敗」等）
- フェーズ検証でのスキーマ適合確認の実施形（検証スクリプト vs 手動 zod parse）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.5 マイルストーンリサーチ
- `.planning/research/SUMMARY.md` §Phase 3 — 本フェーズ相当の推奨実装（Step 3a パターン流用、新設ディレクトリ、12並列→6+6フォールバック、WebSearchResult 型再利用、社名併記クエリ、[STEP:portfolio-research:*] マーカー）
- `.planning/research/PITFALLS.md` — Pitfall 1（tmp/websearch/ 流用禁止・ディレクトリ隔離テスト）、Pitfall 5（EE/NXT エンティティ衝突・社名併記＋エンティティ確認指示）、Pitfall 6（fan-out倍増のレート制限・逐次/並列の名前付き決定・部分成功fail-soft・metrics計測）、Pitfall 7（catch時の console.warn 必須 — Phase 22 ローダー実装時にも適用）、Pitfall 8（alias-transform スキーマ硬化）

### 要件・ロードマップ
- `.planning/REQUIREMENTS.md` — PORT-02 / OPS-05 の正確な要件文言（tmp/portfolio-research/ 分離保存・fail-soft・STEPマーカー可視化）
- `.planning/ROADMAP.md` §Phase 21 — Success Criteria 2項目（12銘柄の分離保存・失敗時の4レポート継続+マーカー可視化）

### 実装前例（コード内）
- `.claude/commands/invest.md` Step 3.0〜3b（1243〜1530行目付近） — 流用元の WebSearch 並列 Agent パターン（プロンプト構造・フォールバックJSON・N/total 表示・pipeline-metrics 記録・STEPマーカー）
- `git show ba01275^:src/data/research.ts` — v1.0 の銘柄別リサーチ実装前例（参考。現行は Agent+WebSearch 方式で再実装）

### 前フェーズの決定（隣接契約）
- `.planning/phases/19-data-foundation-holding-news-supply/19-CONTEXT.md` — deferred「EE / NXT のWebSearchエンティティ衝突対策（社名併記クエリ）は Phase 21 の領域」→ 本フェーズ D-05/D-07 で回収

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.claude/commands/invest.md` Step 3a（1269行目〜） — 銘柄ごと並列 Agent + WebSearch のプロンプトテンプレート・フォールバックJSON規約・N/total 部分成功表示。本フェーズの直接の流用元
- `src/portfolio/holdings.ts` の `PORTFOLIO_HOLDINGS` — 12銘柄（symbol / name / nameJa / sector / matchAliases）。クエリの社名併記（D-05）と日本語クエリ（D-06）の情報源
- `src/meeting/types.ts` の `WebSearchResult`（86行目）+ `src/meeting/schemas.ts` の `webSearchResultSchema`（112行目） — 出力契約の再利用元（D-09）。alias-transform 硬化の適用対象（D-12）
- `src/meeting/schemas.ts` の `portfolioAnalysisSchema` — alias-transform（`passthrough().transform()`）パターンの実装前例
- `tmp/pipeline-metrics.json` 記録用の node -e スニペット（invest.md 1274-1281行目） — portfolioResearchStart/End の記録に流用（D-16）

### Established Patterns
- fail-soft STEPマーカー: `[STEP:name:START/OK/FAIL:詳細]` の3値語彙 + FAILでもパイプライン継続（news-digest 前例）→ D-13/D-14 が踏襲
- 部分成功レポート: 「WebSearch完了: N/{total}銘柄リサーチ成功」→ D-15 が踏襲
- 無効JSON時のフォールバックJSON保存（Step 3a）→ D-11 が踏襲
- tmp/*.json ハンドオフ境界: TS↔Claude の受け渡しは全てファイル経由
- Date.now() は invest.md 内の metrics スニペットでは既存使用あり（run.sh 外の wall-clock 記録用）。TS コード内では performance.now() 規約に従う

### Integration Points
- `.claude/commands/invest.md` Step 3.0 直後（1265行目の highlightedStocks 0件分岐より前）— 新ステップの挿入位置（D-01）。0件時のジャンプ先（Step 3c）に影響を与えない配置にする
- `tmp/portfolio-research/` — 新設ディレクトリ。Phase 22 の portfolio-analyst プロンプト注入（Step 3d、1542行目〜）が消費予定。本フェーズは書き込み側のみ
- `src/scripts/generate-report.ts` の `loadWebSearchResults()` / `loadReevalResults()` — **触らない**（Daily Report 専用。Pitfall 1 の隔離検証で「本フェーズ実装後も Daily Report 出力が portfolio-research ファイルの有無に影響されない」ことを確認）
- run.sh の STEPマーカーパース・通知 — 新マーカー `portfolio-research` が既存の語彙規約に従う限り変更不要の想定（planner が要確認）
- 最終のステップ別実行時間表示（invest.md 2012行目付近の console.log 一覧）— 「ポートフォリオリサーチ」行の追加先（D-16）

</code_context>

<specifics>
## Specific Ideas

- エンティティ確認指示の文言イメージ（Pitfall 5 のまま採用）: 「結果が {name}（{ticker}）に関するものか必ず確認し、別企業・別銘柄の情報は除外すること」
- FAILマーカー詳細の文言イメージ: `[STEP:portfolio-research:FAIL:3/12銘柄失敗（EE, NXT, 5576.T）]` — 失敗ティッカーが通知から直接読める形
- 日本語クエリ例: `"名古屋銀行 決算 ニュース"` / `"助川電気工業 業績"` — nameJa ベース
- リサーチ観点はPORT-02の列挙をクエリに反映: 決算・訴訟・規制変更・大型契約・ガイダンス変更

</specifics>

<deferred>
## Deferred Ideas

- リサーチ結果の portfolio-analyst プロンプト注入と売却・保有判断の再評価（PORT-03）、アンカリングバイアス対策の independent-then-compare プロンプト設計（Pitfall 9）— Phase 22
- 緊急度フラグ（PORT-04）— リサーチ出力には専用フィールドを設けず（D-09）、Phase 22 で portfolio-analyst が内容から判断
- 前日比較の決定論的判断変化検出（PORT-05）— Phase 22
- `tmp/portfolio-research/` を読む TS ローダー（console.warn 必須の Pitfall 7 規約適用）とレポート統合 — Phase 22
- 既存 `loadWebSearchResults`/`loadReevalResults` への catch ログ追加（Pitfall 7 の既存負債修正）— Phase 22 のローダー実装時に併せて検討
- 6+6 バッチ分割（D-03 のフォールバック）— ライブ検証で切り詰めが観測された場合のみ

</deferred>

---

*Phase: 21-Portfolio WebSearch Research*
*Context gathered: 2026-07-03*
