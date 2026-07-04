# Phase 24: Digest-Meeting Cross-Reference - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

ニュースダイジェスト（news-digest.html）の各キュレーション記事に、その記事が「当日ミーティング（tmp/meeting-result.json）でどう議論されたか」を示す視覚的な関連注記を付与する。マッチングは holding-news.ts と同じ TS 側決定論方式（ティッカー一致優先 + テーマキーワード照合、LLM 追加呼び出しなし・幻覚URLなし）で行い、fail-soft（クロスリファレンス処理が失敗しても既存4レポートの生成・デプロイは継続、専用 STEP マーカーで可視化）とする。当日ミーティングで議論されていない記事は注記なしで通常表示する。

**このフェーズに含まれないもの（scope外）:**
- LLM ベースの関連注記生成（決定論マッチングのみ）
- ミーティングデータ側の変更（meeting-result.json のスキーマ・生成フローは触らない、読み取り専用）
- 緊急度履歴（Phase 25/26 の担当）
- news-digest 以外のレポート（daily/portfolio/meeting-minutes）への注記付与

</domain>

<decisions>
## Implementation Decisions

### 照合ソースと優先順位（Match signal & priority）
- **D-01:** マッチは2系統。**(1) ティッカー一致（優先）**: `CuratedArticle.tickers` を、ミーティングで議論されたティッカー集合と照合する。**(2) テーマキーワード照合（フォールバック）**: 記事の `title` にセクター名等のテーマ語が含まれるかを照合する。holding-news.ts の「ticker一致 > 社名一致」設計思想を踏襲する。
- **D-02:** ティッカー一致のソースは `meeting-result.json` の `highlightedStocks[].ticker`（10銘柄前後、`verdict`/`averageScore`/`summary` を保持しリッチな表示に使える）を第一とし、加えて `roundSummary.scoredTickers`（全スコア対象ティッカー）をマッチ専用の補助集合として使う。`highlightedStocks` に含まれる場合は verdict を注記に使える利点がある。
- **D-03:** テーマキーワード照合のソースは `sectorRecommendations[].sector`（セクター名）を第一とする。照合対象は記事の **title のみ**（holding-news.ts の title-only 照合 = filter.ts のタイトルのみ照合パターンを踏襲、commentary は評価しない）。大小文字区別なし（`includes`、toLowerCase）。
- **D-04:** ティッカー一致がある記事はテーマ照合を評価しない（ticker一致で確定。holding-news.ts の `matchArticlesForHolding` の early-continue 踏襲）。ティッカー不一致の場合のみテーマ照合にフォールバックする。

### 注記の内容（Annotation content）
- **D-05:** ティッカー一致の注記は「銘柄シンボル + verdict（強気/中立/弱気）」を表示する（例: `NVDA 強気`）。verdict は一致した `highlightedStocks[].verdict` から決定論的に取得。`scoredTickers` のみ一致（highlightedStocks 非該当）の場合は verdict なしでシンボルのみ表示する。
- **D-06:** テーマ一致の注記はマッチしたセクター名を表示する（例: `半導体`）。
- **D-07:** 注記テキストは meeting-result.json のフィールド値から決定論的に導出し、LLM 生成の散文は一切含めない（幻覚防止・再現性）。文言のプレフィックス（例: 「🗣 ミーティング言及:」「🗣 関連テーマ:」）は固定文字列とする。

### 視覚的マーカーの配置とスタイル（Visual placement）
- **D-08:** 注記は各記事カード（`.news-card`）内で、既存の `news-meta` 行（ソース・時刻・ティッカーピル）の**下**に独立した注記行/チップとして追加する。h4 の importance バッジや見出しリンクは変更しない（既存レイアウトへの加法的変更）。
- **D-09:** スタイルは既存の `.ticker-pill`（report-utils.ts）を踏襲したチップ表現に、ミーティング用のアクセント色を付ける。`escapeHtml` を必ず通す。一致0件の記事には注記行を一切描画しない（Success Criteria #4: 注記なしで通常表示、レイアウト崩れなし）。

### 複数一致時のキャップ（Multi-match cap）
- **D-10:** 1記事が複数ティッカー/テーマに一致する場合、ティッカー一致を先頭に最大2件、テーマ一致は最大1件でキャップする（holding-news.ts の `MAX_ARTICLES_PER_HOLDING` / rank-and-cap と同じ「上限超過時は確実性の高いticker一致を優先して残す」思想）。順序は決定論的（ティッカー→テーマ、各内は元順序の安定順）。

### 統合ポイント・型・fail-soft 隔離（Integration & fail-soft）
- **D-11:** マッチングは新規の純関数モジュール `src/meeting/digest-crossref.ts` に実装する（holding-news.ts のファイル配置・純関数・副作用なし・throwしない設計を踏襲）。入力は `NewsCuration`（または `CuratedArticle[]`）と `MeetingResult`、出力は記事ID→注記の決定論的マップ（例: `Record<articleId, DigestCrossRef>`）。
- **D-12:** レンダラー `generateNewsDigestHtml` には注記マップを**任意（オプショナル）引数**として追加する（加法的、未指定時は現行の0注記描画と完全に同一）。`formatArticleCardHtml` が記事IDで注記を引いて描画する。
- **D-13:** クロスリファレンス計算は `write-news-digest.ts` の中で行うが、**既存の digest 生成 try/catch とは独立した専用 try/catch で隔離**する。クロスリファレンス例外時は空注記にフォールバックし、digest 本体は正常に（注記なしで）生成・書き出しされる（Success Criteria #3: crossref 例外が digest/既存3レポートをブロックしない）。crossref 失敗が digest の null フォールバック（「生成できませんでした」）を誤発火させてはならない。
- **D-14:** crossref の成否は**専用の STEP マーカー**で可視化する（例: `[STEP:digest-crossref:OK]` / `[STEP:digest-crossref:FAIL:...]`）。既存の `[STEP:news-digest:*]` とは別系統。`[PIPELINE:FAIL]` は絶対に出力しない（OPS-04 と同方針）。マーカーの発出主体（write-news-digest.ts 内 vs invest.md Step 3e）は planner が既存パターンに合わせて決定してよいが、crossref 専用であることは固定。

### シンボル正規化（Symbol normalization）
- **D-15:** ティッカー比較は holding-news.ts の `normalizeHoldingSymbol`（trim + toUpperCase のみ、内部文字は変えない）と同方式で正規化してから照合する。米国ティッカー（大文字）と日本株（`8522.T` 等）の表記揺れを構造的に吸収する。既存関数の再利用 or 同一実装を planner が判断。

### Claude's Discretion
- STEP マーカーの発出箇所（スクリプト内 stderr か invest.md 側 echo か）は既存の news-digest / portfolio-research のパターンに合わせて planner が選択してよい。
- 注記の具体的な絵文字/プレフィックス文言・チップの正確な CSS 色値は、既存 news-digest のパープルアクセント（#8b5cf6）系との調和を保つ範囲で planner/実装時に確定してよい。
- テーマキーワード照合を `sectorRecommendations[].sector` 以外（`weeklyEvents[].event` 等）にも広げるかは、誤マッチ（過剰注記）のノイズを増やさない範囲で planner が判断してよい。デフォルトはセクター名のみ（保守的）。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 設計テンプレート（最重要 — この設計思想を踏襲する）
- `src/portfolio/holding-news.ts` — TS側決定論マッチングの基準実装。ticker一致優先、title-only 社名照合、rank-and-cap（上限時 ticker 優先）、`normalizeHoldingSymbol`、fail-soft（throwしない・全キー保持）、副作用なし純関数。**Phase 24 の digest-crossref.ts はこの設計を写像する。**
- `src/portfolio/holding-news.test.ts` — 上記のテスト設計の参考（純関数テストパターン）

### データ形状（入力）
- `src/meeting/types.ts` — `CuratedArticle`（`id`/`title`/`tickers`/`commentary`/`market`/`importance`）, `NewsCuration`, `MeetingResult`（`highlightedStocks[].ticker`+`verdict`, `sectorRecommendations[].sector`, `roundSummary.scoredTickers`, `weeklyEvents`, `riskWarnings`）の型定義
- `src/meeting/schemas.ts` — `resolveNewsCuration` / `validateRawNewsCuration` / `NewsArticlePoolEntry`。curation の解決と検証
- `tmp/meeting-result.json` — 当日ミーティング統合結果の実データ（Step 2 で生成、Step 3e 時点で必ず存在）

### レンダラー・統合ポイント
- `src/scripts/generate-news-digest.ts` — `generateNewsDigestHtml` / `formatArticleCardHtml` / `formatMarketGroupsHtml`。注記マップを任意引数で受ける形に拡張する対象
- `src/scripts/write-news-digest.ts` — パイプライン統合ポイント。meeting-result.json/news-curation.json/news.json 読み込み、fail-soft try/catch、exit code シグナルの既存パターン
- `src/scripts/report-utils.ts` §.ticker-pill / .news-card / .news-meta（L194-216）— 注記チップのスタイル基盤

### パイプライン・要件
- `.claude/commands/invest.md` §Step 3e（L1985-2021）— news-digest 生成ステップ。STEP マーカー規約・fail-soft・`[PIPELINE:FAIL]` 禁止方針。crossref STEP マーカーの追加先候補
- `.planning/ROADMAP.md` §Phase 24 — Goal と Success Criteria 4項目
- `.planning/REQUIREMENTS.md` §XREP-01 / XREP-02 — 要件と Out of Scope（LLMベース注記生成の除外）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `normalizeHoldingSymbol`（holding-news.ts）: シンボル正規化の単一情報源。ティッカー照合前の正準化に再利用可能
- `matchArticlesForHolding` / `resolveNameMatchType` / `titleIncludesAny`（holding-news.ts）: title-only 照合・early-continue・matchType 判定のロジックパターンを digest-crossref に写像
- `rankAndCapHoldingArticles`（holding-news.ts）: 「ticker優先で上限キャップ」の並べ替え+slice パターン（D-10 の実装参考）
- `escapeHtml` / `generateBaseStyles`（report-utils.ts）: 注記 HTML の安全なエスケープ・パープルアクセントスタイル
- `.ticker-pill` CSS（report-utils.ts）: 注記チップの視覚基盤

### Established Patterns
- **決定論マッチング + ID参照**: v2.5（Phase 19/20）で確立。LLM を通さず TS 側で照合し、記事本体は ID で参照する
- **fail-soft + 専用 STEP マーカー**: news-digest（Step 3e）は exit code で OK/FAIL を分離し、`[PIPELINE:FAIL]` を出さず既存3レポートをブロックしない。crossref も同方針で新マーカーを追加
- **加法的レンダラー拡張**: generate-news-digest.ts は curation=null / 0件 / 通常 の3分岐を持つ純関数。注記は任意引数で加法的に足し、0注記時は現行と完全同一の出力を保つ
- **純関数モジュール + .test.ts 併置**: src/meeting/, src/portfolio/ ともに実装と単体テストを併置

### Integration Points
- **Step 3e（write-news-digest.ts）**: meeting-result.json は既に `date` 取得のため読み込み済み。ここで全内容を読んで digest-crossref に渡し、注記マップを generateNewsDigestHtml に供給する
- **パイプライン順序**: Step 2（meeting-result.json 生成）→ Step 3e（news-digest 生成）。ミーティング完了後にダイジェスト注記を付与する順序依存は既に満たされている（新たな順序変更は不要）
- **generateNewsDigestHtml → formatArticleCardHtml**: 記事IDで注記を引いてカードに描画

</code_context>

<specifics>
## Specific Ideas

- 注記の表示イメージ: ティッカー一致 →「🗣 ミーティング言及: NVDA 強気」、テーマ一致 →「🗣 関連テーマ: 半導体」のような固定プレフィックス + 決定論的フィールド値のチップ（正確な絵文字・色は実装時に確定）
- holding-news.ts の各設計判断（D-01〜D-10 の記法）をそのまま Phase 24 のマッチングロジックの設計判断のベースラインとして流用する

</specifics>

<deferred>
## Deferred Ideas

- テーマ照合の対象を `weeklyEvents[].event` や `riskWarnings[].description` にも拡張 — 過剰注記のノイズが問題になった場合に検討（デフォルトはセクター名のみの保守的照合）
- ミーティング未議論の記事に「議論なし」等の明示ラベルを出す案 — Success Criteria #4 は「注記なしで通常表示」なので現時点では不要、必要になれば将来
- 緊急度履歴・週次ロールアップ — Phase 25/26 の担当（本フェーズ scope 外）

None beyond the above — discussion stayed within phase scope.

</deferred>

---

*Phase: 24-Digest-Meeting Cross-Reference*
*Context gathered: 2026-07-04*
