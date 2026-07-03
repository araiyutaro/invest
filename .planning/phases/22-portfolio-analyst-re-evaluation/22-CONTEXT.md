# Phase 22: Portfolio-Analyst Re-Evaluation - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning
**Mode:** --auto（Claude が既存パターン・前フェーズ決定・v2.5リサーチ文書に基づき推奨決定を自動選択）

<domain>
## Phase Boundary

保有銘柄の売却・保有判断が、ニュース・リサーチ結果を踏まえた再考であることがレポート上で確認でき、重大材料と前日からの判断変化が視覚的に強調される（PORT-03 / PORT-04 / PORT-05 / UI-07）。

具体的な成果物:
1. portfolio-analyst プロンプト（invest.md Step 3d）への **WebSearchリサーチ結果セクション**（tmp/portfolio-research/ 由来）と**前日判断セクション**（tmp/prev-portfolio-analysis.json 由来）の条件付き追加 + rationale がニュース・リサーチへ明示的に言及する指示（PORT-03）
2. HoldingEvaluation への **`urgent: boolean` フィールド追加**（LLM出力、alias-transform 硬化。決算ミス・訴訟・規制変更・大型契約・ガイダンス引下げ等の重大材料で true。PORT-04）
3. **前日スナップショット機構**（Step 3d 冒頭で前日の tmp/portfolio-analysis.json を tmp/prev-portfolio-analysis.json へ退避、ANLQ-01 前例）と **TS側の決定論的 decisionChanged 計算**（LLM自己申告禁止。PORT-05）
4. 保有銘柄カードの**緊急バッジ（赤系）と判断変化バッジ（アンバー系、前日→当日を明記）**の描画（UI-07）

新規組入候補セクション削除は Phase 23、リサーチの実行自体（Step 3-P）は Phase 21（完了済み）、保有銘柄別ニュースの供給・カード表示は Phase 19/20（完了済み）の対象であり本フェーズには含まない。

</domain>

<decisions>
## Implementation Decisions

**注:** `--auto` モードにより、以下は Claude が Phase 19〜21 の決定・v2.5 リサーチ文書（SUMMARY.md §Phase 4 / PITFALLS.md）・既存コード規約に基づいて確定した推奨決定。

### リサーチ結果のプロンプト注入（PORT-03）
- **D-01:** リサーチ注入は **invest.md Step 3d の Read→埋め込み方式**で行う（holding-news の D-07 前例踏襲）。Step 3d 冒頭の読み込みファイルリストに `tmp/portfolio-research/*.json`（12ファイル）を追加し、プロンプトへ展開する。TS ローダー経由のリサーチ注入は不採用（プロンプト組み立ては orchestration 層の責務、tmp/*.json ハンドオフ規約通り）
- **D-02:** 埋め込むフィールドは **researchSummary + positiveFindings + negativeFindings のみ**。keyArticles（URL含む）は埋め込まない — 幻覚URL防止の既存規約（URL非注入）とプロンプト肥大抑制（Pitfall 10 類推）のため
- **D-03:** リサーチセクションも**全12銘柄を必ず列挙**し、リサーチ失敗銘柄（フォールバックJSON）には「本日のリサーチ結果なし（リサーチ不在は問題なしを意味しない）」を明記（Phase 19 D-11 の 0件ニュース表現と対をなす）。ディレクトリ自体が欠損の場合はセクション全体を省略（holding-news と同じ条件付き注入）
- **D-04:** rationale への明示言及はプロンプト指示で担保: 「関連ニュースまたはリサーチ結果が存在する銘柄は、rationale でその具体的内容（材料名）に必ず言及すること。存在しない銘柄は既存材料のみで判断し言及しないこと」。**rationale の文字数上限を 200→300 文字に拡大**（材料言及分の余地。既存カードレイアウトは散文段落なので300文字でも崩れない）

### アンカリング対策（Pitfall 9）
- **D-05:** プロンプトは **independent-then-compare 構成**: 「まず本日の材料（株価・ミーティング結果・ニュース・リサーチ）のみに基づいて各銘柄を独立に判断し、その後に前日判断と比較すること」。前日判断セクションはプロンプトの**末尾**（判断基準の後）に配置し、冒頭アンカリングを避ける
- **D-06:** 前日判断への言及形式: 前日と判断が異なる場合は rationale で変更理由に触れることを推奨する指示を入れる（ただし decisionChanged の判定自体は TS 側 — D-11）
- **D-07:** `changed` 比率の健全性観測（毎日全銘柄 false が続く場合はアンカリング疑い）は単発テストでは検証不能のため、**22-HUMAN-UAT.md で複数日のライブ観測項目として追跡**する

### 緊急度フラグの出力契約（PORT-04）
- **D-08:** HoldingEvaluation に **`urgent: boolean`（LLM出力・省略時 false）を新設**する。リサーチ SUMMARY.md の「riskNote への折込み」案は不採用 — UI-07 の赤/アンバー強調が機械可読フラグを要求し、ROADMAP Success Criteria 2 が「緊急度フラグ（urgent）が付与され」と明記しているため（ロードマップがリサーチ後に確定した決定を優先）。TS側キーワード検知も不採用（表記揺れに脆く、LLM が文脈で判断する方が正確）
- **D-09:** 緊急の**理由テキストは riskNote に記載**させる（`urgencyReason` 等の新フィールドは追加しない — スキーマ表面の最小化）。プロンプト指示: 「urgent: true とした銘柄は riskNote にその重大材料を必ず記載すること」
- **D-10:** zodスキーマは **alias-transform 硬化**を適用: `urgent` / `urgency` / `isUrgent` / `urgentFlag` を吸収し boolean へ正規化、欠落時 false デフォルト（Pitfall 8。portfolioAnalysisSchema の既存 rawPortfolioSchema.passthrough().transform() に追記）。プロンプトの「フィールド名のルール（厳守）」ブロックにも urgent を追記。乱発防止指示: 「決算ミス・訴訟・規制変更・大型契約・ガイダンス引下げ等の重大材料を今日のニュース・リサーチで確認した場合のみ true とすること（通常のリスク注意は riskNote のみ）」

### 前日スナップショットと決定論的差分検出（PORT-05）
- **D-11:** `decisionChanged` / `previousDecision` は **TS側で決定論的に計算**し HoldingEvaluation へ付与する（LLM自己申告は不採用 — 要件文言通り）。LLM がこれらのフィールドを出力しても transform で無視（strip）する
- **D-12:** スナップショット取得は **Step 3d 冒頭**（portfolio-analysis.json を上書きする前）に node -e スニペットで前日の `tmp/portfolio-analysis.json` → `tmp/prev-portfolio-analysis.json` へコピー（ANLQ-01 の prev-highlighted-stocks.json と同構造。tmp/ は実行間で残留するため前日データがそのまま取得できる）。ファイルなし・パース失敗時は「前日データなし」でプロンプトの前日セクションと差分計算の両方をスキップ
- **D-13:** 差分計算は **レポート生成側の収束点**（report-data-loaders.ts の loadPortfolioAnalysis 周辺）で行う: prev スナップショットを読み、`normalizeHoldingSymbol` でキー一致させ、decision enum（保持/買増/一部売却/全売却）の**等値比較**で decisionChanged を判定
- **D-14:** prev 欠損・銘柄不一致（保有リスト変更等）の場合は **decisionChanged = undefined**（バッジなし）とし、「変化なし（false）」とは区別する — 「比較できなかった」を「変化がなかった」と偽らない
- **D-15:** prev スナップショットのローダーは **console.warn 必須**（Pitfall 7）。併せて既存 `loadWebSearchResults` / `loadReevalResults` の無言 catch にも console.warn を追加する（Phase 21 deferred の既存負債回収。同種の修正で差分最小）

### カード視覚強調（UI-07）
- **D-16:** 緊急バッジ: urgent 銘柄のカードヘッダ（h4 内）に**赤系バッジ「⚠ 緊急」**（背景 #ef4444 系、白文字のピル）を表示。riskNote は既存のアンバー表示のまま
- **D-17:** 変化バッジ: decisionChanged === true の銘柄に**アンバー系バッジ「判断変更: {前日} → {当日}」**（例: 「判断変更: 保持 → 一部売却」）を表示。previousDecision を明記し、何から何へ変わったかがカード上で読める形にする
- **D-18:** **border-left の decision 色は維持**する（緊急・変化で上書きしない）— decision 色の意味論（保持=緑/買増=青/一部売却=アンバー/全売却=赤）を壊さず、バッジで直交した情報を重ねる。urgent カードへの薄い赤背景ティント等の追加強調は Claude's discretion
- **D-19:** 「ニュースなし銘柄のカードのデエンファシス」（Phase 20 deferred / Pitfall 11 派生）は**不採用** — 既存の空状態明示（「本日の関連ニュースなし」）で十分であり、保有銘柄の視認性を下げるデメリットが上回る

### スコープ境界
- **D-20:** リサーチ内容（researchSummary 等）の**カード上への直接表示は行わない** — 要件外。リサーチの表出面は rationale への反映（PORT-03）と urgent バッジ（PORT-04）。カード表示が欲しければ v2.6+ で検討
- **D-21:** レンダラーは既存の純関数パターン（formatHoldingEvaluationsHtml 拡張）+ ユニットテストで実装。フォールバックパス（portfolioAnalysis === null）はカード自体が描画されないため本フェーズの描画変更の影響なし（planner は念のため確認）

### Claude's Discretion
- プロンプトのセクション見出し文言・並び順の詳細（D-05 の independent-then-compare 構成を守る範囲で）
- urgent カードの追加強調（薄い赤背景ティント・box-shadow 等）の有無とスタイル詳細
- バッジの正確な文言・フォントサイズ・余白（既存の「社名一致」バッジのスタイル流儀に合わせる）
- prev スナップショット node -e スニペットの具体形（ANLQ-01 スニペット踏襲の範囲で）
- HoldingEvaluation 型拡張の実装形（readonly 維持、TS付与フィールドと LLM出力フィールドの区別をどうコードで表現するか）
- リサーチ12ファイルのプロンプト展開時の整形（銘柄見出し形式は holding-news の「### {symbol}（{nameJa}）」踏襲が自然）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.5 マイルストーンリサーチ
- `.planning/research/SUMMARY.md` §Phase 4 — 本フェーズ相当の推奨実装（prev スナップショット機構＝ANLQ-01 ミラー、3つの条件付きプロンプトセクション、independent-then-compare、TS計算の decisionChanged、単一 portfolio-analyst 呼び出し維持＝第2エージェント艦隊の明示的不採用）
- `.planning/research/PITFALLS.md` — Pitfall 7（ローダー catch の console.warn 必須 + 既存負債）、Pitfall 8（alias-transform スキーマ硬化）、Pitfall 9（アンカリングバイアス・independent-then-compare・changed比率のライブ観測）、Pitfall 10（プロンプト肥大 — リサーチ埋め込みのフィールド絞り込み）、Pitfall 11（stale情報の扱い — D-19 で部分不採用の判断済み）

### 要件・ロードマップ
- `.planning/REQUIREMENTS.md` — PORT-03 / PORT-04 / PORT-05 / UI-07 の正確な要件文言（rationale 明示言及・urgent フラグ・TS側決定論的差分・赤/アンバー強調+変化バッジ）
- `.planning/ROADMAP.md` §Phase 22 — Success Criteria 3項目（rationale の明示言及・urgent フラグ+視覚強調・TS側差分計算+変化バッジ）

### 前フェーズの決定（隣接契約）
- `.planning/phases/21-portfolio-websearch-research/21-CONTEXT.md` — D-09（リサーチ出力は WebSearchResult 形状のまま、緊急度判定は Phase 22 で portfolio-analyst が内容から行う）、D-10（tmp/portfolio-research/{symbol}.json の保存規約）、D-12（スキーマ+契約検証は Phase 21 で整備済み）、deferred（TSローダーの Pitfall 7 規約・既存 loadWebSearchResults/loadReevalResults の負債 → 本フェーズ D-15 で回収）
- `.planning/phases/19-data-foundation-holding-news-supply/19-CONTEXT.md` — D-07（URL非注入）、D-11（全12銘柄列挙+0件明示）、D-12（ガード指示 — 幻覚ニュース言及の抑止。PORT-03 検証の土台）
- `.planning/phases/20-holding-card-news-display/20-CONTEXT.md` — D-03（ダークテーマの明示的色指定）、D-19 の判断対象となった deferred「ニュースなし銘柄のデエンファシス」

### 実装前例（コード内）
- `.claude/commands/invest.md` 94-113行目 — ANLQ-01 前日データ退避の node -e スニペット（D-12 の直接の流用元）
- `.claude/commands/invest.md` Step 3d（1683-1852行目） — portfolio-analyst プロンプト定義。読み込みファイルリスト・条件付きセクション・フィールド名ルール・プロンプトインジェクション注意書きの拡張先
- `src/meeting/schemas.ts` 191-235行目 — rawPortfolioSchema の alias-transform 実装（decision/action, rationale/reason 等の既存吸収パターン。D-10 の urgent 追記先）
- `src/meeting/types.ts` 110-122行目 — HoldingEvaluation / PortfolioAnalysis 型（D-11 の拡張先）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.claude/commands/invest.md` の ANLQ-01 スニペット（94-113行目）: tmp の前日残留ファイルを prev-*.json へ退避する node -e パターン — D-12 がそのまま流用
- `src/meeting/schemas.ts` の `rawPortfolioSchema.passthrough().transform()`（191-226行目）: alias 吸収 + デフォルト補完の前例 — D-10/D-11 の実装先（urgent 正規化・decisionChanged/previousDecision の strip）
- `src/scripts/generate-portfolio-report.ts` の `formatHoldingEvaluationsHtml()`（47-69行目）: カードレンダラー。decisionColor による border-left 色分け・riskNote アンバー表示・関連ニュースサブセクションが既存 — バッジ2種の追加先
- `src/scripts/generate-portfolio-report.ts` の「社名一致」バッジ（28-30行目）: 既存のピル型バッジ実装 — D-16/D-17 のスタイル流儀の参照元
- `src/scripts/report-data-loaders.ts` の `loadPortfolioAnalysis()` / `loadHoldingNews()`: zod パース + null/空フォールバック + console.error のローダーパターン — prev スナップショットローダーの踏襲元
- `src/portfolio/holding-news.ts` の `normalizeHoldingSymbol()`: symbol キー正規化 — D-13 の差分キー一致で再利用
- `tmp/portfolio-research/{symbol}.json`（Phase 21 成果物）: WebSearchResult 形状（ticker / researchSummary / positiveFindings / negativeFindings / keyArticles / researchedAt）。検証スクリプト validate-portfolio-research.ts も Phase 21 で整備済み

### Established Patterns
- 条件付きプロンプトセクション: 「（ファイルが存在する場合のみ以下を含めること）…（存在しない場合はこのセクション全体を省略）」の invest.md 規約（holding-news / prev-highlighted-stocks で実証済み）→ D-01/D-03/D-12 が踏襲
- フィールド名のルール（厳守）ブロック + alias-transform の二重防御（Pitfall 8 対策の既存規約）→ D-10 が踏襲
- URL非注入 + プロンプトインジェクション注意書き（Step 3d の既存3つの「重要:」ブロック）→ リサーチセクションにも同等の注意書きを付ける
- TS決定論 vs LLM判断の分離: 「TSで検証できるものは LLM 自己申告を信用しない」（resolveNewsCuration / decisionChanged）→ D-11 が踏襲
- fail-soft + console.warn ログ（resolveNewsCuration 規約）→ D-15 が踏襲

### Integration Points
- `.claude/commands/invest.md` Step 3d 冒頭（1699-1705行目の読み込みリスト直前）: prev スナップショット退避スニペットの挿入位置（D-12）
- `.claude/commands/invest.md` Step 3d プロンプト本文: リサーチセクション（holding-news セクションの後）+ 前日判断セクション（末尾、D-05）+ urgent フィールドの JSONフォーマット例・フィールド名ルール追記
- `src/meeting/types.ts` / `schemas.ts`: HoldingEvaluation 拡張（urgent は LLM出力、previousDecision / decisionChanged は TS付与）
- `src/scripts/generate-report.ts` 95-110行目の並列読み込み: prev-portfolio-analysis の読み込み追加と decisionChanged 付与の配線（generatePortfolioReportHtml へ渡る PortfolioAnalysis を拡張済みの形にする）
- `src/scripts/generate-portfolio-report.ts` `formatHoldingEvaluationsHtml`: バッジ2種の描画（D-16/D-17/D-18）
- `tmp/prev-portfolio-analysis.json`: 新設ハンドオフファイル。書き込みは invest.md（D-12）、読み取りは TS ローダー（D-13）

</code_context>

<specifics>
## Specific Ideas

- rationale 言及指示の文言イメージ: 「関連ニュースまたはリサーチ結果が存在する銘柄は、rationale でその具体的内容（材料名）に必ず言及すること」— Phase 19 D-12 ガード指示（存在しない銘柄は言及禁止）と対で機能させる
- independent-then-compare の文言イメージ（Pitfall 9 のまま採用）: 「まず本日の材料のみに基づいて独立に評価し、その後に前日判断との差分を確認すること」
- urgent 判定基準はPORT-04の列挙をそのまま使用: 決算ミス・訴訟・規制変更・大型契約・ガイダンス引下げ等
- 変化バッジの文言イメージ: 「判断変更: 保持 → 一部売却」（previousDecision → decision を明記）
- 緊急バッジの文言イメージ: 「⚠ 緊急」（赤背景・白文字のピル、既存「社名一致」バッジと同じ実装流儀）

</specifics>

<deferred>
## Deferred Ideas

- `changed: true/false` 比率の複数日ライブ観測（アンカリング健全性メトリクス）— 22-HUMAN-UAT.md で追跡（単発テストでは検証不能。Pitfall 9）
- `hasNewInformation` 形式の「新規材料なし」と「再評価して変化なし」の構造的区別（Pitfall 11）— 変化バッジ + 空状態明示で部分代替。必要性が確認されれば v2.6+
- リサーチ内容（researchSummary 等）のカード上への直接表示 — 要件外（D-20）。v2.6+ で検討
- 緊急度フラグの履歴監査トレイル / 週次ロールアップ（PORT-F1）— v2.6+（STATE.md 登録済み）
- ニュースなし銘柄のカードのデエンファシス — D-19 で不採用と判断（再検討するなら v2.6+）

</deferred>

---

*Phase: 22-Portfolio-Analyst Re-Evaluation*
*Context gathered: 2026-07-03*
