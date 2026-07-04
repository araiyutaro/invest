# Phase 26: Weekly Urgency Rollup Display - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

> **注記:** `--auto` モードで生成。各グレーエリアは推奨（デフォルト）オプションを自動採択した。意思決定は下記 `<decisions>` に記録。

<domain>
## Phase Boundary

Phase 25 で `data/urgency-history.json` に永続化された保有銘柄の日次スナップショット（`{symbol, nameJa, urgent, decision}` × 全12銘柄 × 日付キー）を **読み取り側で集計し、portfolio.html（Portfolio Report）に週次ロールアップセクションとして描画する**。ユーザーは portfolio.html 上で「直近1週間にどの保有銘柄が緊急フラグ（urgent）や判断変更（decision の前日差）の対象になったか」を振り返れる。新規ページ追加はなく、既存 portfolio-report.html に1セクション追加するのみ。集計は TS 側決定論（LLM 非経由）で、Phase 22 の decision-diff 思想を「履歴内の日付間比較」に写像する。

**このフェーズに含まれないもの（scope外）:**
- 履歴データの**生成・永続化**（`data/urgency-history.json` の書き込みは Phase 25 / HIST-01・HIST-02 が完了済み。本フェーズは読み取り専用）
- LLM 呼び出し（集計・描画はすべて既存の永続データからの決定論的処理。追加の AI 判断なし）
- 履歴の剪定・書き換え（append-only の完全履歴を維持する Phase 25 の要件を尊重。本フェーズは読み取り時に直近7日をフィルタするのみ）
- 新規レポートページ・新規 index.html リンク（Success Criteria #1: 新規ページの追加はなし）
- invest.md パイプラインの新ステップ追加（履歴は Step 3f で既に永続化済み。本フェーズは既存の generate-report.ts 実行内でファイルを追加読み込みするだけ。専用 STEP マーカーは不要）
- 銘柄別ニュース・当日 urgent/decisionChanged バッジ（既存の holding-news / 個別評価カードの責務。本セクションは「週次の履歴集計」に限定）

</domain>

<decisions>
## Implementation Decisions

### ロールアップの集計ロジック（Aggregation logic）
- **D-01:** 「直近7日」は **meeting-result.json の `date`（当日正準日付）を起点とした7カレンダー日窓**として定義する（当日を含み `date` から6日前まで）。この窓に含まれる履歴の日付キーのみを集計対象とする。ユーザーの「今週」という直感に合致し、Success Criteria #2「直近7日間のエントリから集計」に忠実。履歴に該当日が欠けていても（実行しなかった日）エラーにせず、存在する日だけを使う。実データ上の当日 date と docs/ デプロイ日付は一致するため（Phase 25 D-05）、起点日は既存の正準日付を単一情報源として流用する。
- **D-02:** **判断変更（decision change）の検出は履歴内の日付間 decision enum 比較**で行う。7日窓に含まれる各銘柄について、記録のある日付を昇順に並べ、隣接する記録日間で `decision`（"保持"|"買増"|"一部売却"|"全売却"）が変化した箇所を「判断変更（{前日決定} → {当日決定}）」として集計する。Phase 22 の `attachDecisionChanges`（前日スナップショットとの enum 等値比較）と同じ決定論思想を、単日差分ではなく履歴列に写像したもの。**LLM 自己申告は使わない。** 欠測日を挟む場合は「記録のある隣接2日」で比較する（カレンダー上の連続日ではなく履歴上の連続記録日を比較）。
- **D-03:** **緊急フラグ（urgent）は `urgent === true` の記録日を銘柄ごとに集計**する。7日窓内で urgent が true になった日付の一覧を銘柄別に持つ。urgent が一度も true にならない銘柄はこの集計に現れない。
- **D-04:** 銘柄の突合キーは Phase 25 で保存済みの正規化済み `symbol`（`normalizeHoldingSymbol` 適用済み）をそのまま使う。履歴側は既に正規化されているため、集計側は追加正規化なしでキー一致を取れる（米国ティッカーと日本株 `8522.T` の表記揺れは書き込み時に吸収済み）。

### ロールアップの表示形式（Display format）
- **D-05:** 表示は **「今週動きのあった銘柄」のみを対象とした銘柄別集約リスト**とする（bullet list ベース、テーブルは不採用 — LLM 生成でなくても長文・ダークテーマ整合・レイアウト崩れ回避の既存方針を踏襲）。7日窓内で「urgent が true になった」または「判断変更があった」銘柄のみを列挙し、動きのなかった銘柄は非表示にする（「振り返り」の用途は動きのあった銘柄への注目）。
- **D-06:** 各銘柄エントリには **(a) 緊急フラグ発生日**（例「⚠ 緊急フラグ: 07/02, 07/04」）と **(b) 判断変更**（例「判断変更: 07/03 保持 → 買増」）を列挙する。既存の個別評価カードのビジュアル言語（赤系 `#dc2626` 相当=緊急、アンバー系 `#f59e0b`=判断変更）を流用し、色とバッジ意味論をレポート全体で一貫させる。銘柄見出しは既存同様 `{symbol} -- {nameJa}` 形式。
- **D-07:** 日付は集計・表示ともに `MM/DD`（JST）等の短縮表記で可読性を優先し、内部集計は `YYYY-MM-DD` キーのまま扱う。全ての動的文字列（symbol/nameJa/decision）は既存の `escapeHtml` を通す（XSS 防止・既存レンダラーと同方針）。

### セクションの配置と空/部分状態（Placement & empty/partial state）
- **D-08:** セクションは portfolio.html 内で **`overallCommentHtml` の直後・`holdingEvaluationsHtml`（保有銘柄 個別評価）の前**に配置する（週次の振り返り → 当日の個別詳細、というトップダウンの情報階層）。見出しは「今週の緊急・判断変更ロールアップ」等（planner が既存見出しトーンに合わせて確定してよい）。
- **D-09:** 空/部分状態は3段階でフォールバックし、いずれもエラーにしない（Success Criteria #3）:
  - **履歴ファイルが無い / 0件**: 「まだ緊急フラグ・判断変更の履歴がありません（履歴は日次で蓄積されます）」等の説明を出す。
  - **履歴はあるが今週の動きが0件**（7日窓内に urgent も判断変更も無い）: 「今週は緊急フラグ・判断変更はありませんでした」等を出す。
  - **7日未満しか履歴が無い**: エラーにせず存在する日数分で集計し、「（過去N日分の履歴に基づく）」等の補足を添えて部分表示する。
- **D-10:** 履歴が全く無い場合でもセクションの**見出し自体は表示する**（存在を伝え、翌日以降に蓄積される旨を示す）か、あるいは丸ごと非表示にするかは planner が既存レポートの空セクション表現（例: 個別評価0件時 `formatHoldingEvaluationsHtml` は空文字を返す）と整合させて確定してよい。デフォルトは **見出し + 空状態メッセージを表示**（機能の存在をユーザーに認知させる側に倒す）。

### 実装構成・データ供給・fail-soft（Module structure & data flow）
- **D-11:** 集計ロジックは**新規の純関数モジュール** `src/portfolio/urgency-rollup.ts` に実装する（holding-news.ts / urgency-history.ts の設計を踏襲: 副作用なし・throw しない・I/O なし、`.test.ts` 併置）。入力は `UrgencyHistoryFile`（Phase 25 の型を再利用）+ 起点日付、出力は「動きのあった銘柄ごとの緊急発生日リスト + 判断変更リスト」を表す新規の集計結果型（例 `WeeklyUrgencyRollup`）。TDD で7日窓フィルタ・履歴間 decision 比較・欠測日・0件・7日未満・イミュータビリティを検証する。
- **D-12:** HTML 描画は既存の `src/scripts/generate-portfolio-report.ts` に新規 `format*Html` 関数として追加する（集計=純関数モジュール / 描画=レポートジェネレータ、の関心分離を維持）。`generatePortfolioReportHtml` に**第4引数**（例 `urgencyHistory: UrgencyHistoryFile = {}`、省略時は空 = 後方互換）を追加する（既存 Test 38「第3引数省略の2引数呼び出しでも後方互換で動作する」と同じ後方互換パターンを第4引数にも適用）。
- **D-13:** データ読み込みは呼び出し元 `src/scripts/generate-report.ts`（L152 の `generatePortfolioReportHtml` 呼び出し直前）に**薄い loader**を追加する: `data/urgency-history.json` を読み、存在しない/パース失敗時は空 `{}` にフォールバックしてから集計・描画へ渡す。既存の tmp/*.json 読み込み（`loadPortfolioAnalysis` 等）と同じ readFile + zod/型パースのパターンに合わせる。読み込み用の zod スキーマを新設するか型アサーションで済ませるかは planner が既存 loader スタイルに合わせて判断してよい。
- **D-14:** **fail-soft**: 履歴ファイルの読み込み・パース・集計のいずれが失敗しても、portfolio.html および既存3レポートの生成は継続する（ロールアップセクションを空状態扱いにフォールバック）。本フェーズは既存の generate-report.ts 実行内に閉じるため、invest.md への新ステップ追加や新規 `[STEP:*]` マーカーは不要（Phase 25 で履歴永続化は別ステップ化済み）。既存の generate-report のエラーハンドリング方針に従う。

### Claude's Discretion
- セクション見出しの正確な文言・空状態メッセージの正確な文言は planner / executor が既存レポートのトーンに合わせて確定してよい（D-08/D-09/D-10）。
- 集計結果型（`WeeklyUrgencyRollup` 等）の正確な形状（銘柄配列 vs Record、緊急日と判断変更を1銘柄にまとめる構造）は planner が既存型定義スタイルに合わせて設計してよい（保持すべき情報は「銘柄・緊急発生日リスト・判断変更（日付+前後 decision）リスト」）。
- 履歴読み込みに専用 zod スキーマを新設するか型アサーションで済ませるか（D-13）は planner が既存 loader パターンに合わせて確定してよい。
- 履歴0件時にセクション見出しを出すか丸ごと非表示にするか（D-10）はデフォルト「見出し+空状態表示」だが、planner が既存の空セクション表現と整合させて最終決定してよい。
- 判断変更で欠測日を挟むときの比較基準（カレンダー隣接日 vs 記録隣接日、D-02）は「記録のある隣接2日を比較」をデフォルトとするが、planner が集計テストで意図を固定してよい。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### データ形状（入力・型 — Phase 25 の成果物）
- `src/portfolio/urgency-history.ts` §`HoldingUrgencySnapshot`（L9-14: `{symbol, nameJa, urgent, decision}`）, §`UrgencyHistoryFile`（L20: `Record<"YYYY-MM-DD", ReadonlyArray<HoldingUrgencySnapshot>>`）, §`isValidDateKey`（L57-59）— **本フェーズが読み取り・集計する履歴の型。集計モジュールはこの型を再利用する。**
- `data/urgency-history.json` — Phase 25 が日次で永続化する実データ（**非公開 data/ 配下、gitignore 対象外**）。パイプライン未実行時は不在。本フェーズの loader は不在/破損を空 `{}` にフォールバックする
- `.planning/phases/25-urgency-history-persistence/25-CONTEXT.md` — Phase 25 の全 D-01〜D-14 決定（履歴スキーマ形状・4フィールド・append-only・同日上書き・正規化 symbol）。**読み取り側の前提として必読**

### 描画対象・レンダリングパターン（この設計思想を踏襲する）
- `src/scripts/generate-portfolio-report.ts` — Portfolio Report ジェネレータ本体。§`generatePortfolioReportHtml`（L102-152: セクション合成テンプレート、`overallCommentHtml`→`holdingEvaluationsHtml`→`rebalanceActionsHtml` の順。**D-08 の挿入位置・D-12 の第4引数追加箇所**）, §`formatUrgentBadgeHtml`（L48-51: 緊急バッジ）, §`formatDecisionChangedBadgeHtml`（L58-65: アンバー系判断変更バッジ `#f59e0b`）, §`formatHoldingEvaluationsHtml`（L67-92: 0件時 `return ""` の空状態パターン、カード配列 map）— **D-06 のバッジ色・D-05 のリスト描画・D-10 の空状態表現の基準実装**
- `src/scripts/report-utils.ts` §`escapeHtml`（L26）, §`formatPublishedAtJst`（L13: JST 日付整形）, §`generateBaseStyles`（L98）— D-07 の escape・日付整形に再利用
- `src/portfolio/holding-news.ts` §`normalizeHoldingSymbol` — Phase 25 が履歴書き込み時に適用済み。集計側の銘柄突合は正規化済みキー前提（D-04）。TS側純関数モジュールの設計テンプレート（副作用なし・throwしない・.test.ts 併置、D-11 が写像）

### 集計思想の先行実装（decision 差分の決定論検出）
- `src/meeting/decision-diff.ts` / §`attachDecisionChanges`（Phase 22）— 前日スナップショットとの decision enum 等値比較で判断変更を決定論的に付与する基準実装。**D-02 はこれを「単日差分」から「履歴列の日付間比較」へ写像したもの**
- `src/meeting/types.ts` §`HoldingEvaluation`（`decision: "保持"|"買増"|"一部売却"|"全売却"`, `urgent`, `previousDecision?`）— decision enum の正準定義（履歴の decision もこの4値）

### 統合ポイント・データ供給
- `src/scripts/generate-report.ts` L152（`generatePortfolioReportHtml(meetingResult, enrichedPortfolioAnalysis, resolvedHoldingNews)` 呼び出し）+ L128-135（`loadPortfolioAnalysis` 等の tmp/*.json 読み込みパターン）+ L1・L147（`readFile`・`meetingResult.date`）— **D-13 の loader 追加箇所・D-01 の起点日付（meetingResult.date）の取得元**
- `src/scripts/report-data-loaders.ts` §`loadPortfolioAnalysis`（L83-85）— tmp/*.json 読み込み + パースのパターン（D-13 の履歴 loader の参考）
- `src/scripts/generate-report.test.ts` Test 38（L473-475: 引数省略の後方互換テスト）— **D-12 の第4引数後方互換の検証パターン**

### パイプライン・要件
- `.planning/ROADMAP.md` §Phase 26（L136-145）— Goal・Success Criteria 3項目・UI hint: yes
- `.planning/REQUIREMENTS.md` §HIST-03（L20）— 要件定義（portfolio.html で直近7日間の緊急フラグ・判断変更履歴ロールアップを見られる）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `UrgencyHistoryFile` / `HoldingUrgencySnapshot` / `isValidDateKey`（urgency-history.ts）: 履歴の型・日付検証を集計モジュールで再利用（D-11）
- `formatUrgentBadgeHtml` / `formatDecisionChangedBadgeHtml`（generate-portfolio-report.ts）: 緊急=赤 / 判断変更=アンバー `#f59e0b` のバッジ色・意味論。ロールアップ描画で同じ色言語を流用（D-06）
- `formatHoldingEvaluationsHtml`（generate-portfolio-report.ts, L67-92）: 0件時 `return ""`・カード配列 map の空状態/リスト描画パターン（D-05/D-10）
- `escapeHtml` / `formatPublishedAtJst`（report-utils.ts）: 全動的文字列の escape・JST 日付整形（D-07）
- `normalizeHoldingSymbol`（holding-news.ts）: 履歴側は書き込み時に適用済みのため集計側は再正規化不要（D-04）
- `loadPortfolioAnalysis` 等（report-data-loaders.ts）: readFile + パースの loader パターン（D-13）

### Established Patterns
- **純関数モジュール + .test.ts 併置**: src/portfolio/ は実装と単体テストを併置（holding-news.ts / decision-diff.ts / urgency-history.ts）。urgency-rollup.ts も同構成（D-11）
- **決定論的集計（LLM非経由）**: v2.5〜v2.6 は TS 側で既存確定データを加工。urgent/decision は Phase 25 で永続化済み、集計に LLM 不要（D-02/D-03）
- **後方互換なオプション引数追加**: generatePortfolioReportHtml は第3引数（resolvedHoldingNews）をデフォルト値付きで追加した実績あり（Test 38）。第4引数も同パターン（D-12）
- **空状態のグレースフル表示**: 個別評価0件時に空文字を返す等、レポートは常に「壊れない空表示」を優先（D-09/D-10）
- **fail-soft**: v2.4〜v2.6 のニュース系機能は失敗しても本流レポート・デプロイをブロックしない。本フェーズも履歴読み込み失敗を空状態にフォールバック（D-14）

### Integration Points
- **generate-report.ts L152 直前**: `data/urgency-history.json` を読み込む loader を追加し、集計結果を `generatePortfolioReportHtml` の第4引数に渡す（D-13/D-12）。起点日付は同スコープの `meetingResult.date`（D-01）
- **generate-portfolio-report.ts テンプレート L147-149**: `overallCommentHtml` と `holdingEvaluationsHtml` の間に新セクションを挿入（D-08）
- **新規純関数 urgency-rollup.ts**: I/O を持たず、`UrgencyHistoryFile` + 起点日付 → 集計結果型（D-11）。パイプライン新ステップ・新 STEP マーカーは不要（既存 generate-report 実行内に閉じる、D-14）

</code_context>

<specifics>
## Specific Ideas

- 集計結果（イメージ）: 7日窓内で動きのあった銘柄のみ。各銘柄について
  ```
  MRNA -- モデルナ
    ⚠ 緊急フラグ: 07/02, 07/04
    判断変更: 07/03 保持 → 一部売却
  ```
  のような銘柄別サマリを bullet で列挙する。動きのない銘柄（緊急も判断変更も無い）は非表示。
- 空状態3段階（D-09）: ①履歴なし → 「まだ履歴がありません（日次で蓄積されます）」 ②今週動きなし → 「今週は緊急フラグ・判断変更はありませんでした」 ③7日未満 → 「（過去N日分の履歴に基づく）」補足付きで部分表示。
- 配色は既存バッジと統一: 緊急=赤系、判断変更=アンバー `#f59e0b`。

</specifics>

<deferred>
## Deferred Ideas

- 7日を超える期間（月次・四半期）のロールアップや履歴トレンドのグラフ化: 本フェーズは「直近7日」に固定（HIST-03）。長期集計・可視化は別フェーズ候補。
- 履歴の剪定（pruning）や履歴専用ページ: Phase 25 は append-only 完全履歴を維持、本フェーズは新規ページ追加なし。専用履歴ビューアは将来の別フェーズ。

None beyond the above — discussion stayed within phase scope.

</deferred>

---

*Phase: 26-weekly-urgency-rollup-display*
*Context gathered: 2026-07-04*
