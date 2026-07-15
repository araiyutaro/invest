# Phase 28: Watchlist Persistence - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** --auto（全グレーエリアを推奨オプションで自動確定。根拠は .planning/research/ の v2.7 リサーチ、REQUIREMENTS.md の WLST-01〜05、および既存コード実証パターン）

<domain>
## Phase Boundary

当日「強気」評価された銘柄（ETF除外後）を `data/watchlist.json` に日次で蓄積し、降格・購入・長期未確認の3理由に応じて理由付きで自動除外する、監査可能な状態テーブルを実装する:

1. **登録（admit）**: 当日ミーティングで `verdict: 強気` となった highlightedStocks 銘柄（ETF除外後）を ticker キー方式で自動登録（addedDate/lastVerdictDate 付き、当日以降の蓄積のみ・過去分の遡及なし）
2. **除外（prune）**: ①verdict 中立/弱気転落 → `downgraded`、②portfolio 保有銘柄化 → `purchased`、③強気再確認が一定期間ない → `expired`、の3トリガーすべてTS側決定論。レコード削除ではなく理由付き記録で履歴追跡可能
3. **防御的ETF二重フィルタ**: admission 内で Phase 27 の純関数を再利用（第2の独立ゲート）

追跡データ供給（Phase 29）・買いタイミング判定（Phase 30）・Daily Report 表示（Phase 31）は本フェーズの範囲外。Requirements: WLST-01, WLST-02, WLST-03, WLST-04, WLST-05。

</domain>

<decisions>
## Implementation Decisions

### 状態テーブルのスキーマ設計
- **D-01: `data/watchlist.json` は ticker キー方式の現在状態テーブル（date キー方式ではない）**。research の4パスすべてが収束した構成。日付キー方式の履歴分析が将来必要になれば別ファイルで担う（urgency-history.json の前例）
- **D-02: removedReason の enum は REQUIREMENTS.md の正準値 `"downgraded" | "purchased" | "expired"` を使用**。research ARCHITECTURE.md 例示の `verdict-downgrade`/`entered-portfolio` は採用しない（要件文書が正）
- **D-03: エントリの必須フィールドは `ticker` / `addedDate` / `lastVerdictDate`、除外時に `removedReason` / `removedDate` を付与**。active なエントリは定義上すべて強気なので verdict フィールドの常時保持は不要（保持するかは Claude 裁量）。日付は既存規約どおり `YYYY-MM-DD` 文字列で `isValidDateKey`（urgency-history.ts）と同一の正規表現検証を再利用
- **D-04: 会社名（name/nameJa）は登録時に取得して optional フィールドとして保存**。取得は D-16 の batch quote() の `longName`/`shortName` を流用（ETF判定と同一コールで社名も得られるため追加API呼び出しゼロ）。取得失敗時は名前なしで登録し、下流表示は ticker にフォールバック（レポートでの「ティッカー＋社名」表示は確立済みのユーザー要件）

### 再追加（re-admission）セマンティクス
- **D-05: 除外済み銘柄が再度強気評価された場合、新規エピソードとして再追加する（addedDate は再追加日）**。その際、**過去の除外記録（いつ・なぜ除外されたか）は破壊しない** — Success Criteria 5「除外・失効後もレコードは履歴として保持され追跡できる」を再追加後も満たすため、除外エピソードを上書き消去する実装は不可
- **D-06: 履歴保持の具体構造（ticker ごとのエピソード配列 vs 現行エントリ＋removalHistory 配列）はプランナー裁量**。ただし「アクティブ銘柄一覧の導出が単純であること」（Phase 29/30 が消費する）と「除外履歴が同一ファイル内で追跡できること」の両立を要件とする

### 時間ベース失効（WLST-04）
- **D-07: 失効基準は `lastVerdictDate`（最終強気確認日）からの経過暦日**。営業日計算は日米の祝日カレンダーが必要になり複雑さに見合わないため暦日を採用（決定論・依存ゼロ）
- **D-08: 失効閾値は 30 暦日（約20営業日）**。research FEATURES が「swing-trader 的な高速回転は本プロジェクトの中長期リストに不適、generous window を推奨」、PITFALLS が「30-60日で50-150銘柄に肥大」と指摘するバランス点。強気で再言及されるたびに lastVerdictDate が更新されるため、失効するのは「1ヶ月間一度も強気再確認されなかった」銘柄のみ
- **D-09: 失効閾値は名前付き定数として watchlist.ts に一箇所定義** — 定数名は `EXPIRY_CALENDAR_DAYS = 30` とする。マジックナンバー分散禁止
- **D-10: ウォッチリストのサイズ（active 件数・除外件数）を CLI 標準出力にログする**。research PITFALLS「size instrumentation from day one」の直接適用。launchd ログから肥大傾向を事後監査可能にする

### 除外トリガーの入力ソース（WLST-02/03）
- **D-11: downgraded 判定は当日 `tmp/meeting-result.json` の highlightedStocks を照合** — ウォッチリスト内 ticker が当日 verdict 中立/弱気で登場したら `downgraded`。当日言及がない銘柄は現状維持（lastVerdictDate 据え置き、失効カウント進行）
- **D-12: purchased 判定は `src/portfolio/holdings.ts` の `PORTFOLIO_HOLDINGS` を正準ソースとする**（`tmp/portfolio.json` ではない）。静的な単一情報源であり、collect-data ステップの成否に依存しない。ticker は完全一致（`.T` サフィックスそのまま、大文字化等の正規化詳細は extract-tickers.ts の既存規約に準拠）
- **D-13: dateKey は `tmp/meeting-result.json` の `date` フィールドから取得**（Phase 25 D-05 の前例踏襲。JST再導出しない）。Step 4 の docs/{date}/・コミットメッセージと必ず一致させる

### パイプライン統合・fail-soft・破損時ポリシー
- **D-14: 純関数モジュール `src/portfolio/watchlist.ts` ＋ fail-soft CLI ラッパー `src/scripts/write-watchlist.ts` の分離構成**。`urgency-history.ts`＋`write-urgency-history.ts` の実証済みテンプレートを踏襲（純関数は I/O 非依存・throw-free、ラッパーのみが readFile/writeFile/mkdir と process.exit を持つ）
- **D-15: 実行位置は invest.md Step 2g（filter-etf-stocks → validate-meeting）完了直後の新ステップ**（research の Step 3-W 相当）。ETF除外済み・バリデーション済みの meeting-result を入力とし、Phase 29 のデータ供給・Phase 30 の判定より前にウォッチリスト状態が確定する順序を構造的に保証する
- **D-16: 専用 STEP マーカーを出力し、終了コード非0でもパイプライン継続** — マーカーは `[STEP:watchlist:OK]` / `[STEP:watchlist:FAIL:<理由>]`（OPS-06 の本フェーズ分担。`[PIPELINE:FAIL]` は絶対に出さない）
- **D-17: 同日再実行は冪等** — ticker キーの merge 構築により同日2回実行しても addedDate は初回値を保持し重複登録が構造的に不可能（Phase 25 の spread merge パターン）。専用の同日ガードファイルは不要
- **D-18: ファイル読み込みの二段フェイル設計** — ①ファイル欠損（ENOENT）→ 空の状態テーブルとして初期化し正常続行（初回実行がこのパス）。ENOENT 判定は `error.code === "ENOENT"` と `error.message.includes("ENOENT")` の両方をチェック（Phase 25 Plan 02 のテストモック規約）。②JSON 破損・スキーマ不整合 → **既存ファイルを上書きせず** `[STEP:watchlist:FAIL:<理由>]` で当日の更新をスキップ（蓄積済み状態の保全を可用性より優先。破損ファイルを空で上書きすると全履歴を失う）
- **D-19: zod は使わない** — watchlist.json は LLM 出力ではなく TS 自己生成ファイルのため、alias 硬化は不要。読み込み時の防御的パースは `loadUrgencyHistory`（report-data-loaders.ts / urgency-rollup 系）の throw しない防御様式に合わせる
- **D-20: Step 4 の `git add docs/ data/` は Phase 25 で既に data/ を含むため、watchlist.json のコミットに invest.md Step 4 の変更は不要**（実装時に既存記述を確認・検証のみ行う）

### ETF防御的二重フィルタ（第2ゲート）
- **D-21: admission 内で Phase 27 の純関数 `filterEtfStocks`（src/portfolio/etf-exclusion.ts）を再利用**。将来 highlightedStocks 以外の経路から候補が入っても ETF が構造的に混入しない独立ゲート（research の「2つの独立した呼び出し点」構成の後者。Phase 27 CONTEXT の deferred 項目を本フェーズで実装）
- **D-22: quoteType lookup は新規登録候補ティッカーのみを対象に batch quote() 1回で実施**。既存登録済み銘柄の再確認は不要（登録時に検証済み）。lookup 失敗銘柄は fail-closed で登録しない（Phase 27 D-01 踏襲）。このコールの応答から D-04 の会社名も同時取得する（1コール2役）
- **D-23: quote() の呼び出しはラッパー側（write-watchlist.ts）で行い、純関数には lookup 結果を引数で渡す**。etf-exclusion.ts の `QuoteTypeLookup` 型をそのまま受け渡しに使い、純関数のネットワーク非依存性（単体テスト容易性）を維持する

### Claude's Discretion
- WatchlistEntry / WatchlistFile の正確な型定義・エピソード構造の実装詳細（D-06 の要件を満たす範囲で）
- CLI ラッパーのログ文言・フォーマット詳細（日本語ログ、console.log=監査ログ / console.error=STEPステータスのチャネル規約踏襲）
- verdict フィールドを active エントリに保持するか（D-03）
- ticker 正規化の詳細（既存 extract-tickers.ts 規約への準拠方法）
- 単体テストのケース構成（admit 新規/既存更新/ETF拒否/lookup失敗、prune 3トリガー各種、再追加、冪等性、境界日数 — 既存テスト規約 urgency-history.test.ts / filter-etf-stocks.test.ts 参照）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.7 リサーチ（設計根拠）
- `.planning/research/SUMMARY.md` — v2.7 全体構成。Phase 2（Watchlist Persistence）の deliverables・ticker-keyed 方式・失効トリガーが「genuine open design decision」である旨の指摘
- `.planning/research/ARCHITECTURE.md` — Pattern 1（ETF除外の2呼び出し点）・Pattern 2（純関数＋fail-soft CLI 分離）・WatchlistEntry スキーマ例・Step 3-W 配置とデータフロー図
- `.planning/research/PITFALLS.md` — Pitfall 2（無制限肥大、除外ポリシーは追記ポリシーと同時設計）・サイズ計測の必要性・「still bullish, never purchased」リンボケースへの明示的決定要求
- `.planning/research/FEATURES.md` — 除外トリガー3種の practitioner 標準・swing-trader 的高速回転の不採用理由（generous window）

### 要件・ロードマップ・前フェーズ決定
- `.planning/REQUIREMENTS.md` — WLST-01〜05 の正式定義（removedReason enum の正準値 downgraded/purchased/expired を含む）
- `.planning/ROADMAP.md` §Phase 28 — Success Criteria 5項目
- `.planning/phases/27-etf-exclusion/27-CONTEXT.md` — D-01（fail-closed）/ D-02（fail-soft）/ D-04（EQUITY allowlist）/ D-05（batch quote）の判断根拠。本フェーズの D-21〜23 はこれらの直接継承

### 変更対象・参照コード
- `.claude/commands/invest.md` — パイプライン定義。Step 2g（本フェーズの挿入点直前）・Step 3f/Step 4（STEP マーカーと `git add docs/ data/` の既存様式）
- `src/portfolio/etf-exclusion.ts` — 再利用する純関数 `filterEtfStocks` と `QuoteTypeLookup` 型（Phase 27 成果物）
- `src/scripts/filter-etf-stocks.ts` — batch quote() 呼び出しと fail-soft CLI の直近実装例（Phase 27 成果物）
- `src/meeting/schemas.ts` / `src/meeting/types.ts` — highlightedStocks の verdict enum（強気/中立/弱気）定義（変更しない、型参照元）
- `src/portfolio/holdings.ts` — `PORTFOLIO_HOLDINGS`（purchased 判定の正準ソース）

### 流用パターン（実装の雛形）
- `src/portfolio/urgency-history.ts` ＋ `src/scripts/write-urgency-history.ts` — 純関数＋fail-soft CLI 分離・isValidDateKey・spread merge 冪等性・ENOENT 二重チェックの実証済みテンプレート
- `src/portfolio/urgency-history.test.ts` / `src/portfolio/etf-exclusion.test.ts` — テストモック規約の参照元

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `filterEtfStocks` / `QuoteTypeLookup`（etf-exclusion.ts）: admission 内の防御的二重フィルタにそのまま再利用（D-21〜23）。meeting-result 非依存の純関数として設計済み（Phase 27 がこの再利用を前提に設計）
- `urgency-history.ts` / `write-urgency-history.ts` ペア: 純関数＋fail-soft CLI・日付検証・冪等 merge の全パターンを流用（D-14, D-17, D-18）
- `PORTFOLIO_HOLDINGS`（holdings.ts）: purchased 判定の入力（D-12）。symbol/name/nameJa 構造は watchlist エントリの社名フィールド設計の参考にもなる
- `new YahooFinance()` インスタンス化規約: filter-etf-stocks.ts / collect-technicals.ts に実証例

### Established Patterns
- 「LLM自己申告を信用せず、TSで決定できるものはTS側決定論」— 本フェーズは admit/prune 全体が純TS（LLM関与ゼロ）でこの方針の完全適用
- fail-closed（銘柄単位）と fail-soft（ステップ単位）の使い分け — Phase 27 D-01/D-02/D-03 の区別を admission にそのまま適用
- イミュータブル構築: readonly 型・spread 構築が規約（状態テーブルの更新も新オブジェクト生成で行う）
- 日本語コメント・日本語ログが既存 CLI スクリプトの慣行

### Integration Points
- invest.md Step 2g 完了直後: `npx tsx src/scripts/write-watchlist.ts` を新ステップとして挿入（D-15）。入力は tmp/meeting-result.json（ETF除外・バリデーション済み）＋ data/watchlist.json（前日状態）＋ PORTFOLIO_HOLDINGS
- data/watchlist.json: urgency-history.json と同じ非公開 data/ 配置。Step 4 の `git add docs/ data/` で自動コミットされる（D-20）
- Phase 29（データ供給）・Phase 30（判定）は本フェーズの「アクティブ銘柄一覧」導出を消費する — D-06 の導出単純性要件はこの下流契約のため

</code_context>

<specifics>
## Specific Ideas

- research SUMMARY/ARCHITECTURE が推奨する「ETF除外の2つの独立した呼び出し点」の後者（watchlist admission 側）を本フェーズで完結させる。Phase 27 の純関数を変更せずそのまま呼ぶこと（変更が必要になった場合は設計逸脱としてフラグする）
- batch quote() 1回で quoteType（ETF判定）と longName/shortName（社名）を同時取得する「1コール2役」設計（D-22）— レート制限リスク（research Pitfall 3）を増やさずに社名要件（レポートでのティッカー＋社名表示）の土台を作る
- 失効閾値30暦日は「製品挙動の決定」であり実装詳細ではない（research が明示的にフラグ）。変更したくなった場合は定数1箇所の変更で済む構造にする（D-09）

</specifics>

<deferred>
## Deferred Ideas

- **アクティブ銘柄数の上限キャップ（サイズベース強制除外）**: 30暦日失効（D-08）とサイズログ（D-10)で肥大は実質的に抑止できる。ログで肥大傾向が観測されたら将来フェーズで検討（research PITFALLS の「monitor first, cap later」路線）
- **日付キー方式の判定履歴ログファイル**: 買いタイミング判定の的中率検証（WLST-F2, Future Requirements）が必要になった時に別ファイルとして追加。watchlist.json への責務混載はしない（research ARCHITECTURE の明示的推奨）
- **watchlist ティッカーへの matchAliases 人手キュレーション**: Phase 29 のニュースマッチングで ticker 完全一致＋社名一致のみで開始し、精度不足が観測されたら追補（research Pattern 4 の指摘）
- **過去レポートからの遡及ブートストラップ**: REQUIREMENTS.md Out of Scope で確定済み（再強気評価で自然に取り込まれる）

</deferred>

---

*Phase: 28-Watchlist Persistence*
*Context gathered: 2026-07-15*
