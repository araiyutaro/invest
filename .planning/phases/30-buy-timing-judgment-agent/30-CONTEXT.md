# Phase 30: Buy-Timing Judgment Agent - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** --auto（全グレーエリアを推奨オプションで自動確定。根拠は .planning/research/ の v2.7 リサーチ（特に Pitfall 4/5・ARCHITECTURE Step 3-J 設計）、REQUIREMENTS.md の TIME-01〜05、および Phase 22/27/28/29 の確定済み決定・実装成果物）

<domain>
## Phase Boundary

ウォッチリスト（`data/watchlist.json`）のアクティブ銘柄それぞれについて、Phase 29 が供給した実データ（`tmp/watchlist-technicals.json` / `tmp/watchlist-news.json`）に基づく「今日買うべき / 待つべき」の二値判定を、理由付き・前日比較付きで日次生成する LLM＋TS 検証ハイブリッドを実装する:

1. **判定生成（TIME-01）**: 新設の Claude Agent ステップが銘柄ごとに `todayAction`（買い/待ち）と判定理由を出力 → `tmp/watchlist-judgment.json`
2. **TS 検証（TIME-02）**: zod スキーマ（`passthrough().transform()` alias 硬化）で検証し、フィールド名ゆらぎ・不正出力でもパイプラインが停止しない
3. **フリップフロップ緩和（TIME-03）**: 前日判定スナップショットを independent-then-compare 方式でプロンプト注入し、判定変化は TS 側決定論で検出（Phase 22 `decisionChanged` パターン流用）
4. **confluence 契約（TIME-04）**: 判定理由は供給された実データの複数シグナル合致（≥2、例: MA位置＋RSI＋出来高＋ニュース材料）に基づく。指標値の創作禁止
5. **ルックアヘッド防止（TIME-05）**: 米国株（前日終値・次の実行可能セッションは当日夜JST）と日本株（寄付き前・当日9:00 JSTセッション）の as-of 基準時点を判定入力と出力の両方で区別

Daily Report での表示（Phase 31）・ウォッチリストの登録/除外（Phase 28 完了済み）・追跡データ収集（Phase 29 完了済み）は本フェーズの範囲外。Requirements: TIME-01, TIME-02, TIME-03, TIME-04, TIME-05。

</domain>

<decisions>
## Implementation Decisions

### エージェント構成（判定の実行単位）
- **D-01: 銘柄ごとの単一ティッカー並列 Agent（model: sonnet）で開始する**。Step 3-P（12銘柄並列）と Round 3（スコアリング=sonnet 帯）の実証済み前例に一致。research ARCHITECTURE の明示推奨（想定 1〜12 銘柄規模では並列単一ティッカーが最適、バッチ化は 30 銘柄超で検討するトリガーポイント — deferred）
- **D-02: 判定エージェントは供給済みデータのみを入力とし、WebSearch / WebFetch / 株価取得のライブツール呼び出しを行わない**。プロンプトには orchestrator（invest.md）が当該銘柄のデータスライス（テクニカル＋ニュース＋ウォッチリストエントリ情報＋前日判定）を直接埋め込む。TIME-04 の「存在しない指標値の創作禁止」を、参照可能なデータを構造的に閉じることで担保する（research Pattern 3。ニュース材料は Phase 29 供給分で充足）
- **D-03: 1銘柄あたりのプロンプトは自己完結（他銘柄のデータを含めない）**。銘柄間の相互汚染を構造的に防止し、ウォッチリスト件数の増減に対して線形にスケールする

### 出力スキーマと TS 検証（TIME-02 / TIME-04）
- **D-04: 新スキーマは `src/meeting/schemas.ts` に追加し、`rawHoldingSchema`→`holdingEvaluationSchema` の二段階（raw passthrough → transform 正準化）パターンを踏襲する**。LLM 出力契約の単一情報源として schemas.ts / types.ts に集約（第2の契約ファイルを作らない — research ARCHITECTURE 明示）
- **D-05: 正準判定フィールドは `todayAction: "buy" | "wait"` の二値 enum**。alias 硬化で `action` / `verdict` / `buyToday`（boolean は `lenientBoolean` 流用）/ 日本語値（「買い」「待ち」等）のゆらぎを transform で正準形に吸収する。正確な alias リストはプランナー裁量
- **D-06: 判定理由は `rationale`（日本語散文）＋ `signals`（合致シグナルの配列）の2フィールド構成**。signals は「どのシグナルに合致したか」を列挙可能な形で持たせ、confluence 検証（D-07）と Phase 31 の表示の両方が消費できる構造にする
- **D-07: confluence ≥2 は TS 側決定論ゲートで強制する** — `todayAction: "buy"` かつ `signals` が2件未満の場合、TS 検証が決定論的に `wait` へ降格し、降格理由をログに記録する（Phase 27 D-01 の fail-closed 思想: 買いシグナルは疑わしきは出さない。LLM のプロンプト契約遵守を信用せず TS で構造的に検証する v2.5/2.6 方針の適用）。プロンプト契約側にも ≥2 シグナル要求と創作禁止を明記する（二層防御）
- **D-08: TS 専用フィールド（`previousAction` / `actionChanged` / `asOf` / `market`）は LLM 出力スキーマの transform で構造的に strip し、検証後に TS が決定論的に付与する**。LLM が偽装・エコーしても最終ファイルに混入しない（Phase 22 D の strip 保証パターンをそのまま流用）

### フリップフロップ緩和（TIME-03、research Pitfall 4）
- **D-09: 前日判定の退避は Step 3d と同一のパターン** — 判定ステップ冒頭で、既存 `tmp/watchlist-judgment.json` を `tmp/prev-watchlist-judgment.json` へ退避する。同日再実行は date ガード（判定ファイルの date === 当日 meeting-result date なら退避スキップ・既存 prev 保持）で冪等。date キーは `tmp/meeting-result.json` の `date` フィールドから取得（Phase 25 D-05 / Phase 28 D-13 の前例踏襲、JST 再導出しない）
- **D-10: 前日判定の注入は independent-then-compare 方式** — プロンプトは「まず本日の供給データのみで独立に判定 → その後、前日の判定（todayAction＋rationale 要約）と比較し、変化した場合は理由に言及」の順序を強制する（Step 3d の実証済み文面構造を流用、アンカリング抑制）。prev が存在しない場合（初日・前日空リスト）はセクション全体を省略
- **D-11: 判定変化の検出は TS 側決定論** — `attachDecisionChanges`（decision-diff.ts）と同型の純関数を新設し、前日ファイルとの `todayAction` enum 等値比較のみで `previousAction` / `actionChanged` を付与する。prev がない銘柄はプロパティ自体を付与しない（undefined と false を区別、Phase 22 D-14）。銘柄キー照合は `normalizeHoldingSymbol` を流用
- **D-12: TS 側デバウンス（2日連続同一判定まで表示を切り替えない等のヒステリシス）は本フェーズでは実装しない** — research flag への明示的決定: 前日注入（D-10）＋決定論的変化検出（D-11）を launch 時の緩和機構とし、デバウンスは複数日の判定履歴永続化（WLST-F2 の日付キー別ファイル）が前提となるため、実運用で振動（フラットな株価での buy⇄wait 往復）が観測されたら将来フェーズで追加する。`actionChanged` フィールドが観測データそのものを供給する

### as-of / US-JP セッション区別（TIME-05、research Pitfall 5）
- **D-13: `market: "US" | "JP"` は TS がティッカーから決定論的に導出する**（`.T` サフィックス → JP、それ以外 → US。extract-tickers.ts の既存正規化規約に準拠）。LLM に判定させない
- **D-14: 判定入力の各銘柄に `asOf`（TechnicalSnapshot.asOf = 最終バー日付）と market・セッション文脈を明記して注入する** — US 銘柄:「データは前営業日終値時点。次の実行可能セッションは本日夜（JST）の米国市場」、JP 銘柄:「データは前営業日終値時点（寄付き前）。次の実行可能セッションは本日 9:00 JST の東京市場」。「今日買うべき」の言語は常に次の実行可能セッション基準で書かせる（曖昧な「現在の株価」表現の禁止をプロンプト契約に含める）
- **D-15: 出力ファイルの `asOf` / `market` は TS が入力データから決定論的に再付与する（LLM のエコーを採用しない、D-08 の帰結）**。Phase 31 はこの値をバッジ横の as-of 表示に使う（データ契約として欠落させない）

### パイプライン配置・fail-soft（OPS-06 の本フェーズ分担）
- **D-16: 実行位置は invest.md Step 3 序盤 — Step 3-P（保有銘柄リサーチ）セクションの直後・Step 3a より前に新ステップとして挿入する**。入力（tmp/watchlist-technicals.json / tmp/watchlist-news.json / data/watchlist.json）は Step 2i 完了時点ですべて確定済み。Step 3c（レポート生成）より前に完了することが構造的な必須条件（Step 3f が 3c より前に置かれたのと同じ「当日分を当日レポートに含める」規律 — research ARCHITECTURE の hard requirement）。正確なステップ名（Step 3-J 等）はプランナー裁量
- **D-17: 専用 STEP マーカーは watchlist-judgment 名前空間** — `[STEP:watchlist-judgment:OK]` / `[STEP:watchlist-judgment:FAIL:<短い理由>]`。部分失敗は Step 3-P の様式（`FAIL:{N}/{M}銘柄失敗（{ティッカー}）`）に準拠。`[PIPELINE:FAIL]` は絶対に出さない — 判定失敗は既存4レポートの生成・デプロイを一切ブロックしない
- **D-18: 銘柄単位 fail-soft** — 1銘柄の Agent 失敗・検証失敗はその銘柄の判定欠落として記録し、他銘柄の処理を続行する。全滅時も `tmp/watchlist-judgment.json` には有効 JSON（空 judgments＋メタ情報）を書く
- **D-19: 空ウォッチリスト（アクティブ0件）は正常系** — Agent を1体も起動せず `[STEP:watchlist-judgment:OK]` を出し、空の有効 JSON を書く（0件ログ付き。Phase 29 D-04 と同じ「Phase 31 のローダーが常に有効 JSON を読める」契約）
- **D-20: テクニカルスナップショット欠落銘柄は LLM に送らず、TS が決定論的に `status: "skipped"`（データ不足）として出力ファイルに記録する**（Phase 29 D-17 の下流契約の履行。Phase 31 が「判定不能」状態を描画できる形にする）。ニュース0件は skip 条件ではない（テクニカルのみで判定可能 — その場合 confluence はテクニカル系シグナルで満たす）
- **D-21: 純関数モジュール＋fail-soft CLI の分離構成** — 検証・confluence ゲート・変化検出・asOf/market 付与を担う純関数群（配置はプランナー裁量: 新規 `src/portfolio/watchlist-judgment.ts` 等）と、raw Agent 出力の読込・zod 検証・最終 `tmp/watchlist-judgment.json` 書き出しを行う fail-soft CLI（`validate-portfolio-research.ts` / `write-watchlist.ts` の雛形踏襲）に分離する。CLI 自身が stderr へ STEP マーカーを出力し、invest.md 側は追加 echo しない（Phase 28 D の二重出力回避判断を踏襲）
- **D-22: Agent の raw 出力は銘柄別ファイルに分離保存する**（例: `tmp/watchlist-judgment-raw/{ticker}.json` — Step 3-P の `tmp/portfolio-research/{symbol}.json` 分離保存パターン踏襲）。検証 CLI がそれらを統合・検証して最終ファイルを生成する。raw ディレクトリは実行冒頭で `rm -rf`＋再作成（過去日残留の混入防止）。**`tmp/watchlist-judgment.json`（最終ファイル）と `tmp/prev-watchlist-judgment.json` はクリーンアップ対象に絶対に含めない**（前日注入 D-09 の入力源。Phase 29 D の Pitfall 5 と同じ警告）

### テスト方針
- **D-23: 純関数部分（zod スキーマ alias 硬化・confluence 降格ゲート・変化検出・market/asOf 付与・skipped 記録）を単体テストする**。モック規約は既存準拠（プレーン Error シミュレート、ENOENT 二重チェック — urgency-history.test.ts / watchlist.test.ts / schemas.test.ts 参照）。「buy で signals 1件 → wait 降格」「prev なし → プロパティ非付与」「同日再実行 → 退避スキップ」を必須ケースに含める

### Claude's Discretion
- 正確なステップ名・番号（Step 3-J 等）と invest.md 内の記述詳細
- スキーマの正確な alias リスト・型名（`WatchlistJudgment` 等）・signals 要素の形（string vs 構造化）
- 純関数モジュールの配置・関数シグネチャ（D-21 の分離要件を満たす範囲で）
- Agent プロンプトの文面詳細（D-02/D-10/D-14 の契約を満たす範囲で。日本語プロンプト・既存 Step 3d の文体踏襲）
- raw 出力ディレクトリの正確なパス名
- 単体テストのケース構成の詳細

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.7 リサーチ（設計根拠）
- `.planning/research/SUMMARY.md` §Phase 4 — 本フェーズの deliverables（schemas.ts 追加・新 Agent ステップ・tmp/watchlist-judgment.json）と「confluence ≥2・数値創作禁止・Pitfall 4/5 は初期設計に含める（後付け禁止）」の明示指示。Research Flags §Phase 4（ヒステリシス機構の明示的決定要求 — D-12 が回答）
- `.planning/research/PITFALLS.md` §Pitfall 4 — フリップフロップ（temperature=0 でも発生・アーキテクチャ的無状態性が根因・前日注入＋independent-then-compare＋TS 決定論が対策）と警戒サイン
- `.planning/research/PITFALLS.md` §Pitfall 5 — ルックアヘッドバイアス（8AM JST 実行時の US=前日終値/JP=寄付き前の構造差・as-of タイムスタンプとセッション区別の必須化）
- `.planning/research/ARCHITECTURE.md` — Pattern 3（判定エージェントの tmp/*.json ハンドオフ境界）・Step 3-J のデータフロー図・「Step 3c より前完了」の hard requirement・バッチ化トリガー（30銘柄超）・model: sonnet の根拠

### 要件・ロードマップ・前フェーズ決定
- `.planning/REQUIREMENTS.md` — TIME-01〜05 の正式定義
- `.planning/ROADMAP.md` §Phase 30 — Success Criteria 5項目
- `.planning/phases/29-daily-tracking-data-supply/29-CONTEXT.md` — D-05〜D-07（供給ファイル形状と asOf 保持契約）・D-17/D-18（スナップショット欠落=omit・ニュースマップ全キー保証 — 本フェーズ D-20 が消費）
- `.planning/phases/28-watchlist-persistence/28-CONTEXT.md` — D-06（アクティブ銘柄導出の単純性）・D-04（社名の登録時保存）
- `.planning/phases/29-daily-tracking-data-supply/29-PATTERNS.md` / `.planning/phases/28-watchlist-persistence/28-PATTERNS.md` — 前フェーズ実装時のパターンマップ（存在すれば参照）

### 変更対象・参照コード
- `.claude/commands/invest.md` — パイプライン定義。Step 3-P（並列 Agent・銘柄別ファイル分離・部分失敗マーカーの手本、本フェーズの挿入点直前）・Step 3d（前日退避 date ガード＋independent-then-compare プロンプト文面の直接の雛形）・Step 3f（「3c より前」配置規律の前例）・Step 2i（入力ファイルの生成元）
- `src/meeting/schemas.ts` — `rawHoldingSchema` / `holdingEvaluationSchema` / `lenientBoolean`（二段階 alias 硬化の直接の雛形、D-04/D-05 の追加先）
- `src/meeting/types.ts` — LLM 出力型の定義先（新判定型の追加先）
- `src/portfolio/decision-diff.ts` — `attachDecisionChanges`（D-11 の同型実装の雛形。primary/secondary ループ規律・undefined/false 区別・normalizeHoldingSymbol 照合）
- `src/portfolio/holding-news.ts` — `normalizeHoldingSymbol` / `resolvePortfolioHoldingNews`（ID 参照ニュースの解決手順 — 判定入力組み立てで tmp/news.json と突き合わせる際の既存手順）
- `src/portfolio/watchlist.ts` — `getActiveWatchlistEntries` / `WatchlistEntry`（アクティブ銘柄と社名の取得元、変更しない）
- `src/data/technicals.ts` — `TechnicalSnapshot` 型（asOf 含む入力形状、変更しない）
- `src/scripts/validate-portfolio-research.ts` — raw Agent 出力の検証 CLI の直近実装例（D-21 の雛形）

### 流用パターン（実装の雛形）
- `src/scripts/write-watchlist.ts` / `src/scripts/collect-watchlist-data.ts` — fail-soft CLI・stderr STEP マーカー・空リスト正常系の直近実装例（Phase 28/29 成果物）
- `src/meeting/schemas.test.ts` / `src/portfolio/decision-diff.test.ts` / `src/portfolio/watchlist.test.ts` — テストモック規約の参照元

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `rawHoldingSchema` → `holdingEvaluationSchema` の二段階変換＋`lenientBoolean`（schemas.ts）: alias 硬化・TS 専用フィールド strip の実証済み実装 — 新判定スキーマはこの形の複製で足りる（D-04〜D-08）
- `attachDecisionChanges`（decision-diff.ts）: enum 等値比較・undefined/false 区別・純関数規律まで含めて D-11 の直接の雛形
- invest.md Step 3d の前日退避ブロック（date ガード付き）と「まず独立判断→その後比較」プロンプト文面: D-09/D-10 でほぼそのまま流用可能
- Step 3-P の並列 Agent＋銘柄別ファイル分離＋部分失敗マーカー（`FAIL:{N}/12銘柄失敗`）: D-01/D-17/D-22 の運用実証済み様式
- `tmp/watchlist-technicals.json`（TechnicalSnapshot[] — asOf 内包）/ `tmp/watchlist-news.json`（HoldingNewsFile — 全銘柄キー保証・ID 参照方式）: Phase 29 が本フェーズ向けに設計した供給契約そのもの

### Established Patterns
- 「LLM 自己申告を信用せず、TS で決定できるものは TS 側決定論」— 変化検出（D-11）・market/asOf 付与（D-13/D-15）・confluence ゲート（D-07)はすべてこの方針の適用
- fail-soft の2粒度: 銘柄単位（skip＋ログ）とステップ単位（STEP:FAIL でもパイプライン継続）— Phase 27 D-03 / Phase 29 D-10 の区別を踏襲
- tmp/*.json ハンドオフ境界・ID 参照方式・イミュータブル構築・readonly 型・日本語コメント/ログの既存規約

### Integration Points
- invest.md Step 3-P 直後: 新判定ステップを挿入（D-16）。入力は tmp/watchlist-technicals.json＋tmp/watchlist-news.json（＋ID 解決のため tmp/news.json）＋data/watchlist.json＋tmp/prev-watchlist-judgment.json（存在時）
- 出力 `tmp/watchlist-judgment.json`: Phase 31 のレポート描画（loadWatchlistJudgment 系 fail-soft ローダー — Phase 31 管轄）が消費する下流契約。judgments（todayAction/rationale/signals/asOf/market/previousAction?/actionChanged?/status）＋date＋generatedAt を持つ
- `tmp/prev-watchlist-judgment.json`: 翌日実行の D-09 退避が生成・消費する。Step 3.0 等のクリーンアップ対象に含めないこと（D-22）

</code_context>

<specifics>
## Specific Ideas

- research Pitfall 4 の対策3点セットのうち「前日注入」「independent-then-compare」「TS 決定論検出」を採用し、「表示デバウンス」のみ意図的に見送る（D-12）— 見送り自体を research flag への明示的回答として記録する（silently omitting ではない）
- Pitfall 5 の検出テクニック（価格フィーチャを1セッション遅らせて判定根拠が崩れるか確認）は必須実装ではないが、プロンプト契約レビュー（Success Criteria 4）の際の検証観点として計画に含めてよい
- 判定は decision-support であり執行ではない — 数値の目標価格・損切りラインを出力させない（research FEATURES の anti-feature。REQUIREMENTS Out of Scope「目標エントリー価格の決定論的アラート」と整合）。プロンプト契約に明記する

</specifics>

<deferred>
## Deferred Ideas

- **判定 LLM 呼び出しのバッチ化（5〜8銘柄/コール）**: アクティブ30銘柄超で検討するトリガーポイント（research ARCHITECTURE。Phase 29 CONTEXT から継続）
- **TS 側表示デバウンス（2日連続同一判定までバッジ切替を抑制）**: 実運用で buy⇄wait 振動が観測されたら追加（D-12。判定履歴の日付キー永続化が前提）
- **判定履歴の永続化と的中率検証（`data/watchlist-judgment-history.json`）**: WLST-F2（Future Requirements）。watchlist.json への責務混載はしない（research ARCHITECTURE の明示推奨）
- **watchlist ティッカーへの matchAliases 人手キュレーション**: Phase 28/29 から継続。ニュースマッチ精度不足が観測されたら追補
- **保有銘柄への買い増しタイミング判定の適用**: WLST-F1（Future Requirements）

</deferred>

---

*Phase: 30-Buy-Timing Judgment Agent*
*Context gathered: 2026-07-15*
