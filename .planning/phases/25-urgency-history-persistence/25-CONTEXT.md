# Phase 25: Urgency History Persistence - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

> **注記:** `--auto` モードで生成。各グレーエリアは推奨（デフォルト）オプションを自動採択した。意思決定は下記 `<decisions>` に記録。

<domain>
## Phase Boundary

保有銘柄の緊急度フラグ（`urgent`）と判断（`decision`）を、日次パイプライン実行のたびに `data/urgency-history.json` に日付キーで永続化する。同日中に複数回パイプラインを実行しても同日エントリは上書きされ重複しない（v2.5 の同日再実行ガードと同方式）。この履歴ファイルは非公開の `data/`（公開 `docs/` ではない）に置き、既存の Step 4 デプロイの git commit/push フローに相乗りしてリポジトリに永続化される。データは全12保有銘柄の日次スナップショット（監査可能な追記履歴）であり、Phase 26 の週次ロールアップ表示の**データ基盤**を提供する。

**このフェーズに含まれないもの（scope外）:**
- ロールアップの**表示**（portfolio.html への週次セクション描画は Phase 26 / HIST-03 の担当）
- LLM 呼び出し（urgent/decision は既に tmp/portfolio-analysis.json に確定済み。追加の LLM 判断は一切なし）
- ミーティング・ポートフォリオ分析側のスキーマ/生成フロー変更（tmp/portfolio-analysis.json は読み取り専用）
- 履歴の剪定（pruning）— append-only の完全履歴を維持する（監査要件。Phase 26 は読み取り側で直近7日をフィルタ）
- 緊急度の再計算・差分ロジック（decision 差分は既存 decision-diff.ts が担当。本フェーズは生スナップショットを日次保存するのみ）

</domain>

<decisions>
## Implementation Decisions

### 履歴ファイルのスキーマ形状（History schema shape）
- **D-01:** `data/urgency-history.json` のトップレベルは**日付キーのオブジェクト** `Record<"YYYY-MM-DD", HoldingUrgencySnapshot[]>` とする（例: `{ "2026-07-04": [ ... ], "2026-07-03": [ ... ] }`）。日付キーの単純代入で同日上書きが構造的に保証され、Phase 26 の日付フィルタ（直近7日）も自然に行える。update-index.ts の `mergeEntry`（新しい日付が勝つ）と同じ「date-keyed / new date wins」思想の object 版。
- **D-02:** 各スナップショットエントリは**最小4フィールド** `{ symbol, nameJa, urgent, decision }` とする。すべて `tmp/portfolio-analysis.json` の `HoldingEvaluation`（`symbol`/`nameJa`/`urgent: boolean`/`decision: "保持"|"買増"|"一部売却"|"全売却"`）から決定論的に抽出する。`rationale`/`riskNote`/`previousDecision`/`decisionChanged` は保存しない（履歴には生の日次状態のみを焼き込み、判断変更の計算は Phase 26 の読み取り側で日付間 decision 比較として行う。previousDecision を焼き込むと二重情報源になる）。
- **D-03:** 履歴は **append-only**（剪定なし）。全12保有銘柄を毎日保存する（`urgent: false` の銘柄も含む）。Phase 26 が「今週どの銘柄が緊急フラグ/判断変更の対象になったか」を出すには、全銘柄の日次 `urgent` 状態と `decision` の連続スナップショットが必要なため。

### 同日再実行ガードの実装方式（Same-day guard mechanism）
- **D-04:** 同日ガードは **TS 純関数側で日付キー上書き**として実装する。純関数 `appendUrgencySnapshot(history, dateKey, snapshots)` が `history` の当該 `dateKey` を上書きした**新しいオブジェクト**を返す（イミュータブル: `{ ...history, [dateKey]: snapshots }`）。object の同一キー代入なので重複は構造的に不可能。update-index.ts の `mergeEntry` の filter-and-append と同じ「同日は上書き」思想を object map で表現。
- **D-05:** 日付キー（`dateKey`）の導出は invest.md Step 3d の退避スニペットと**同一方式**で JST 基準とする: `new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)`。ただし本フェーズでは meeting-result.json の `date`（既に Step 4 デプロイでシェルインジェクション対策済みの正準日付）を単一情報源として優先利用する方が整合的。planner は「meeting-result.json の date を使う」か「JST 再導出」かを既存パターンとの整合で確定してよいが、**docs/ 配下の日付ディレクトリ・デプロイコミットの date と必ず一致させる**こと（同日判定の基準を揃える）。
- **D-06:** 日付文字列は書き込み前に `/^\d{4}-\d{2}-\d{2}$/` で検証する（Step 4 デプロイの date バリデーションと同方針。不正 date キーで履歴を汚染しない）。不正時はその日の追記をスキップし FAIL マーカーを出す。

### 統合ポイント・型・fail-soft 隔離（Integration & fail-soft）
- **D-07:** 抽出・マージロジックは**新規の純関数モジュール** `src/portfolio/urgency-history.ts` に実装する（holding-news.ts / digest-crossref.ts のファイル配置・純関数・副作用なし・throwしない設計を踏襲、`.test.ts` 併置）。純関数: `extractUrgencySnapshots(analysis: PortfolioAnalysis): HoldingUrgencySnapshot[]`（holdings から4フィールド抽出）と `appendUrgencySnapshot(history, dateKey, snapshots)`（D-04）。I/O は含めない。
- **D-08:** ファイル I/O は**薄い CLI ラッパースクリプト** `src/scripts/write-urgency-history.ts` が担当する: `tmp/portfolio-analysis.json` を読み込み → 純関数で抽出・マージ → `data/urgency-history.json` に書き出し（既存ファイルが無ければ空 `{}` から開始、`data/` ディレクトリは `mkdir -p` 相当で自動生成）。generate-report.ts には相乗りしない（関心の分離 = many small files。デプロイ前の独立ステップとして分離実行できる方が fail-soft 隔離が明快）。
- **D-09:** invest.md に**専用パイプラインステップ**を追加する（news-digest の Step 3e より後、Step 4 デプロイより前が自然。planner が既存ステップ番号採番に合わせて確定 — 例 Step 3f）。**専用の STEP マーカー** `[STEP:urgency-history:OK]` / `[STEP:urgency-history:FAIL:...]` で成否を可視化する。`[PIPELINE:FAIL]` は絶対に出力しない（Phase 24 / OPS-04 と同方針: この失敗は4レポート・デプロイをブロックしない）。
- **D-10:** シンボルは holding-news.ts の `normalizeHoldingSymbol`（trim + toUpperCase、内部文字不変）と同方式で正規化してから保存する（米国ティッカーと日本株 `8522.T` 等の表記揺れを構造的に吸収し、Phase 26 の日付間銘柄突合を安定させる）。既存関数の再利用 or 同一実装は planner が判断。

### git 永続化の統合（Git persistence integration）
- **D-11:** `data/urgency-history.json` は既存の Step 4 デプロイの git フローに**相乗り**させる。`git add docs/` を `git add docs/ data/` に拡張し、既存の変更検知（`git diff --staged --quiet`）・commit（`report: {date} daily update`）・push（origin master）経路をそのまま流用する（新規のコミット/プッシュ経路は作らない。docs + data が1コミットにまとまる）。
- **D-12:** `data/` は `.gitignore` で無視されていない（`tmp/` のみ無視。確認済み）ため追加の gitignore 設定は不要。履歴は非公開 `data/` 配下のみに置き、公開 `docs/` には一切出さない（Success Criteria #2: 非公開 data/ に永続化、docs/ ではない）。

### 空/欠損時のフォールバック（Empty/missing handling）
- **D-13:** `tmp/portfolio-analysis.json` が読めない、または `holdings` が0件の日は、その日の追記を**スキップ**し既存 history を一切変更しない（分析0件の日は正常系。`[STEP:urgency-history:OK]` を skip ログ付きで出す）。JSON パース失敗・書き込み失敗・不正 date（D-06）のみ `[STEP:urgency-history:FAIL:...]` を出す。いずれの FAIL でもデプロイ（Step 4）はブロックしない。
- **D-14:** 既存 `data/urgency-history.json` の読み込みが破損等で失敗した場合、planner は「空 `{}` から再構築して当日分を書く（履歴喪失リスク）」か「その日はスキップして既存ファイルを保全」かを既存 fail-soft 方針に沿って選ぶ。デフォルトは**既存ファイル保全を優先**（監査履歴を破壊しない側に倒す）とし、パース失敗は FAIL マーカーで可視化する。

### Claude's Discretion
- 専用ステップの正確なステップ番号（Step 3f 等）と STEP マーカー発出箇所（スクリプト内 stderr か invest.md 側 echo か）は、既存の news-digest（Step 3e）/ digest-crossref のパターンに合わせて planner が選択してよい。
- `dateKey` を meeting-result.json の date とするか JST 再導出とするか（D-05）は、docs/ デプロイ日付との一致を満たす範囲で planner が確定してよい。
- `HoldingUrgencySnapshot` 型を新規定義するか `HoldingEvaluation` の Pick 派生とするかは planner が既存型定義スタイルに合わせて判断してよい（保存フィールドは D-02 の4つで固定）。
- 破損 history 読み込み失敗時の再構築 vs 保全（D-14）はデフォルト「保全」だが、planner が既存パターンを踏まえ最終決定してよい。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### データ形状（入力・型）
- `src/meeting/types.ts` §`HoldingEvaluation`（L110-131: `symbol`/`nameJa`/`decision`/`urgent: boolean`/`previousDecision?`/`decisionChanged?`）, §`PortfolioAnalysis`（L134-140: `date`/`generatedAt`/`holdings[]`）— 履歴に保存する urgent/decision の源泉型
- `tmp/portfolio-analysis.json` — 当日ポートフォリオ分析の実データ（Step 3d で portfolio-analyst が生成、追記ステップ時点で存在）。**tmp/ は gitignore 対象**なので履歴は必ず data/ に別途永続化する必要がある

### 設計テンプレート（この設計思想を踏襲する）
- `src/portfolio/holding-news.ts` — TS側純関数モジュールの基準実装（副作用なし・throwしない・全キー保持・`normalizeHoldingSymbol`）。**Phase 25 の urgency-history.ts はこの設計を写像する。**
- `src/portfolio/holding-news.test.ts` — 純関数の単体テスト設計パターン
- `src/scripts/update-index.ts` §`mergeEntry`（L86-92: `existing.filter(e => e.date !== newEntry.date)` → new date wins）— **同日上書き（same-day overwrite）の基準実装。D-01/D-04 はこれの object map 版。**

### 同日ガード・日付導出
- `src/scripts/generate-report.ts` §`resolvePrevHoldingsForDiff`（L94-118: WR-02 同日ガード、prev.date === current.date で null）— 同日再実行の意味論と防御の参考
- `.claude/commands/invest.md` §Step 3d（L1699-1711: 前日退避の JST date ガード `new Date(Date.now() + 9*60*60*1000).toISOString().slice(0,10)`）— **D-05 の JST 日付導出の単一情報源パターン**

### 統合ポイント・パイプライン・デプロイ
- `src/scripts/report-data-loaders.ts` §`loadPortfolioAnalysis`（L83-85）/ `loadPrevPortfolioAnalysis`（L98-100）— tmp/portfolio-analysis.json の読み込み・schema parse パターン（write-urgency-history.ts の読み込み側の参考）
- `.claude/commands/invest.md` §Step 3e（L1985-2038: news-digest の fail-soft・専用 STEP マーカー・`[PIPELINE:FAIL]` 禁止）— **D-09 の専用ステップ/マーカー方針のテンプレート**
- `.claude/commands/invest.md` §Step 4 デプロイ（L2056-2152: `git add docs/`→変更検知→commit `report: {date} daily update`→push origin master、date の `/^\d{4}-\d{2}-\d{2}$/` 検証）— **D-11/D-06 の統合対象。`git add docs/` を `git add docs/ data/` に拡張する箇所（L2104）**
- `.gitignore`（L27-28: `tmp/` のみ無視、`data/` は追跡対象）— D-12 の前提（data/ は commit される）

### パイプライン・要件
- `.planning/ROADMAP.md` §Phase 25（L124-132）— Goal と Success Criteria 3項目
- `.planning/REQUIREMENTS.md` §HIST-01 / HIST-02（L18-19）— 要件定義（日次追記・git永続化 / 同日重複防止）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `normalizeHoldingSymbol`（holding-news.ts）: シンボル正規化の単一情報源。履歴保存前の正準化に再利用可能（D-10）
- `mergeEntry`（update-index.ts）: 「同一 date は新しい方が勝つ」マージの基準パターン。object map 版の `appendUrgencySnapshot`（D-04）に写像
- `loadPortfolioAnalysis` / `portfolioAnalysisSchema`（report-data-loaders.ts / schemas.ts）: tmp/portfolio-analysis.json の読み込み + zod 検証パターン。write-urgency-history.ts の読み込み側で再利用可能
- Step 3d の JST date 導出スニペット（invest.md）: `Date.now() + 9h` → `toISOString().slice(0,10)` の日付キー生成パターン（D-05）
- Step 4 の date バリデーション `/^\d{4}-\d{2}-\d{2}$/`（invest.md）: date キー検証に再利用（D-06）

### Established Patterns
- **純関数モジュール + .test.ts 併置**: src/portfolio/ は実装と単体テストを併置（holding-news.ts / decision-diff.ts）。urgency-history.ts も同構成
- **決定論的スナップショット（LLM非経由）**: v2.5（Phase 19/20）以降、TS側で既存の確定データを加工し履歴/参照を残す設計。urgent/decision は既に確定済みで再 LLM 呼び出し不要
- **fail-soft + 専用 STEP マーカー**: news-digest（Step 3e）/ digest-crossref（Step 3e）は exit code / STEP マーカーで OK/FAIL を分離し `[PIPELINE:FAIL]` を出さず既存レポート・デプロイをブロックしない。urgency-history も同方針で新マーカー `[STEP:urgency-history:*]` を追加（D-09）
- **同日再実行ガード（date-keyed overwrite）**: update-index.ts の date フィルタ、generate-report.ts の same-date null ガード、invest.md Step 3d の JST date 退避スキップ — v2.5 全体で確立された「同日は上書き/スキップ、前日差分の意味論を壊さない」思想

### Integration Points
- **新ステップ（write-urgency-history.ts）**: Step 3d（portfolio-analysis.json 生成）より後、Step 4 デプロイより前に実行。tmp/portfolio-analysis.json を読み data/urgency-history.json に追記（D-08/D-09）
- **Step 4 デプロイ**: `git add docs/` を `git add docs/ data/` に拡張し既存 commit/push に相乗り（D-11）。data/ ディレクトリは書き出し時に新規作成される
- **パイプライン順序**: Step 3d（分析生成）→ 新ステップ（履歴追記）→ Step 4（デプロイで docs/+data/ を一括コミット）。新たな順序依存は Step 3d 完了後の実行のみ

</code_context>

<specifics>
## Specific Ideas

- `data/urgency-history.json` の想定形状（イメージ）:
  ```json
  {
    "2026-07-04": [
      { "symbol": "MRNA", "nameJa": "モデルナ", "urgent": true,  "decision": "一部売却" },
      { "symbol": "8522.T", "nameJa": "名古屋銀行", "urgent": false, "decision": "保持" }
    ],
    "2026-07-03": [ ... ]
  }
  ```
- Phase 26 のロールアップは、このファイルから「日付キーで直近7日を抽出 → 期間内に `urgent: true` になった銘柄」「日付間で `decision` が変化した銘柄」を**読み取り側で決定論的に計算**する想定。ゆえに Phase 25 は判断変更フラグ等の派生値を焼き込まず、生の日次スナップショットだけを残す（D-02）
- 全12保有銘柄を毎日保存（urgent=false も含む）— Phase 26 が全銘柄の連続状態を必要とするため（D-03）

</specifics>

<deferred>
## Deferred Ideas

- 週次ロールアップの**表示**（portfolio.html への「今週の緊急フラグ履歴」セクション描画）— Phase 26 / HIST-03 の担当（本フェーズ scope 外）
- 履歴の剪定（古いエントリの自動削除・ローテーション）— 現時点は append-only の完全履歴を維持（監査要件）。ファイルサイズが問題になれば将来検討
- `rationale` / `riskNote` など詳細フィールドの履歴保存 — Phase 26 のロールアップに必要になれば D-02 のスキーマ拡張として検討。デフォルトは最小4フィールド（保守的）

None beyond the above — discussion stayed within phase scope.

</deferred>

---

*Phase: 25-Urgency History Persistence*
*Context gathered: 2026-07-04*
