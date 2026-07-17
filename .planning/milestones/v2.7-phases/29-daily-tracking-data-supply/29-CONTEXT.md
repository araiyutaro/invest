# Phase 29: Daily Tracking Data Supply - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** --auto（全グレーエリアを推奨オプションで自動確定。根拠は .planning/research/ の v2.7 リサーチ、REQUIREMENTS.md の TRAC-01〜03 / OPS-06、および Phase 27/28 の確定済み決定・実装成果物）

<domain>
## Phase Boundary

ウォッチリスト（`data/watchlist.json`）のアクティブ銘柄それぞれについて、当日の株価・テクニカル指標・関連ニュースを銘柄単位 fail-soft で収集し、Phase 30 の買いタイミング判定エージェントが消費できる安定した中間ファイルとして供給する:

1. **テクニカル供給（TRAC-01）**: アクティブ銘柄の株価・MA/RSI/出来高等を `collect-technicals` パターン（`TechnicalSnapshot` 形状）流用で日次収集 → `tmp/watchlist-technicals.json`
2. **ニュース供給（TRAC-02）**: `tmp/news.json` の記事プールから `holding-news` パターン（`buildHoldingNewsMap`、ID参照方式）流用のTS側決定論マッチングで銘柄別関連ニュースを抽出 → `tmp/watchlist-news.json`
3. **fail-soft（TRAC-03 / OPS-06）**: 1銘柄の取得失敗（レート制限含む）が他銘柄処理・パイプライン全体を止めない。専用 `[STEP:*]` マーカーを持ち、失敗時も既存4レポートの生成・デプロイが継続する

買いタイミング判定エージェント（Phase 30）・Daily Report 表示（Phase 31）は本フェーズの範囲外。ウォッチリストの登録・除外ロジック（Phase 28 完了済み）には触れない。Requirements: TRAC-01, TRAC-02, TRAC-03, OPS-06。

</domain>

<decisions>
## Implementation Decisions

### パイプライン配置とステップ設計
- **D-01: 実行位置は invest.md Step 2h（ウォッチリスト更新）直後の新ステップ（Step 2i）**。Step 2h でウォッチリスト状態が確定した後・Step 3 のレポート系より前に配置し、Phase 30 の判定ステップが常に当日確定済みのウォッチリストに対する追跡データを参照できる順序を構造的に保証する（research ARCHITECTURE の Step 3-W → 3-W2 相当。決定論的TSインフラを Step 2g〜2i に連続配置）
- **D-02: 単一の fail-soft CLI `src/scripts/collect-watchlist-data.ts` がテクニカルとニュースの両方を収集し、2ファイルを出力する**。1 CLI = 1 STEP マーカーで invest.md の配線を最小化（テクニカル/ニュースでステップを分割しない。ニュースマッチングは純関数でネットワーク非依存のため、分割してもfail-soft上の利得がない）
- **D-03: 専用 STEP マーカーは watchlist-data 名前空間** — マーカーは `[STEP:watchlist-data:OK]` および `[STEP:watchlist-data:FAIL:<短い理由>]`。write-watchlist.ts（Phase 28 Plan 02）と同様にスクリプト自身が stderr へマーカーを出力し、invest.md 側は終了コードに関わらず次ステップへ進む。`[PIPELINE:FAIL]` は絶対に出さない（OPS-06 の本フェーズ分担）
- **D-04: 空ウォッチリスト（アクティブ0件）は正常系** — `[STEP:watchlist-data:OK]` を出し、空のスナップショット/空のニュースマップを持つ有効JSONを両ファイルに書き込む（0件ログ付き）。Phase 30/31 のローダーが常に有効JSONを読める契約を維持する（collect-technicals.ts の「fail-soft: 空スナップショット書き込み」前例踏襲）

### 出力ファイル構成（Phase 30 への供給契約）
- **D-05: 出力は2ファイル分離** — `tmp/watchlist-technicals.json`（`{generatedAt, snapshots: TechnicalSnapshot[]}` — 既存 tmp/technicals.json と同一形状）と `tmp/watchlist-news.json`（`HoldingNewsFile` — 既存 tmp/holding-news.json と同じ銘柄キー×ID参照方式）。既存形状の完全流用により、Phase 30 は portfolio-analyst が holding-news を解決するのと同じ手順（tmp/news.json との突き合わせ）をそのまま使える
- **D-06: ニュースは ID 参照方式を維持（記事本文の複製埋め込みはしない）**。幻覚URL防止の最終ガード（`resolvePortfolioHoldingNews` の不明ID drop）と記事プールの単一情報源性を保つ（v2.5 Phase 19 D-05 の設計思想を踏襲）
- **D-07: `TechnicalSnapshot.asOf`（銘柄ごとの最終バー日付）と両ファイルの `generatedAt` をそのまま保持・出力する**。Phase 30 の TIME-05（米国株=前日終値/日本株=寄付き前の as-of 区別・ルックアヘッド防止）は本フェーズが供給する asOf を基盤とするため、データ供給側で欠落させない（形状は既存流用なので追加実装は不要だが、削らないことを契約として明記）

### レート制限対策の実装方式（TRAC-03）
- **D-08: 既存 `collect-technicals.ts` / `fetchTechnicalSnapshots` は変更しない**。`fetchTechnicalSnapshots` は `Promise.all` の無制限並列で、固定小規模セット（Step 2b の moderator-tickers ~10数銘柄）向けの設計。成長するウォッチリストにそのまま適用しない（research Pitfall 3「bounded N 前提の暗黙流用」の明示的回避）。Step 2b の既存挙動に対する回帰リスクをゼロにする
- **D-09: 新CLI側でチャンク化（少数並列＋チャンク間の短い待機）でテクニカルを取得する**。1銘柄分の取得・スナップショット構築ロジック（chart 呼び出し・`buildSnapshot` 等 technicals.ts の純関数群）は再利用し、並列度の制御だけを新規実装する。チャンクサイズ・待機msの具体値は名前付き定数として1箇所定義（Phase 28 D-09 のマジックナンバー分散禁止に準拠）。具体値はプランナー裁量（目安: 並列4〜5、チャンク間200〜500ms — 30日失効で実効上限~30〜50銘柄のリストに対し launchd 時間予算内に収まる範囲）
- **D-10: 銘柄単位 fail-closed ではなく fail-soft（skip）** — 1銘柄の取得失敗はその銘柄をスナップショット欠落として記録し、他銘柄の処理を続行する（既存 fetchTechnicalSnapshot が null を返す挙動と同型）。失敗銘柄は `⚠ 取得失敗: <tickers>` 様式で標準出力にログし launchd ログから監査可能にする（Phase 28 D-10 のサイズ計測と同趣旨）

### 同日キャッシュ（重複取得の回避）
- **D-11: Step 2b が出力した `tmp/technicals.json` を同日キャッシュとして再利用する** — アクティブ銘柄のうち tmp/technicals.json に既にスナップショットが存在する銘柄は再取得せずコピーし、欠落銘柄のみ新規取得する（research Pitfall 3「Cache same-day repeated lookups」の直接適用。当日 admit された銘柄は Step 2b で取得済みのことが多く、重複 chart 呼び出しを構造的に削減）
- **D-12: キャッシュ読込は fail-soft** — tmp/technicals.json が欠損・破損・形状不整合の場合は警告ログのみで全銘柄を新規取得にフォールバックする（キャッシュはあくまで最適化であり、正しさの依存点にしない）

### ニュースマッチングの入力構成（Pattern 4 適用詳細）
- **D-13: `buildHoldingNewsMap`（holding-news.ts）を無改変で流用する**。アクティブなウォッチリスト銘柄を `PortfolioHolding` 形状（`{symbol, name, nameJa, sector}`）にマップして渡すのみで、マッチング関数側の変更はしない（research Pattern 4。変更が必要になった場合は設計逸脱としてフラグする）
- **D-14: 形状マップには Phase 28 が保存した社名を使う** — `symbol` = `WatchlistEntry.ticker`（normalizeHoldingSymbol 済み）、`name` = `entry.name ?? entry.ticker`、`nameJa` = `entry.nameJa`（undefined 可）、`sector` = `""`（マッチングロジック未使用）。Phase 28 D-04 の「batch quote() で社名を登録時取得」がここで結実し、research が想定した「ticker が name を兼ねる」プレースホルダより高精度の社名マッチが初日から効く
- **D-15: `matchAliases` の人手キュレーションは行わない** — ticker 完全一致＋社名一致のみで開始（Phase 28 CONTEXT の deferred 決定を維持。精度不足が観測されたら将来追補）
- **D-16: 1銘柄あたりの記事供給上限は holding-news.ts の既存定数 `MAX_ARTICLES_PER_HOLDING`（5件）をそのまま継承**。ウォッチリスト専用の別上限は設けない（buildHoldingNewsMap 無改変流用の帰結）

### 欠損データ表現と下流契約（fail-soft 粒度）
- **D-17: テクニカル欠落は snapshots 配列からの omit で表現する**（既存 technicals.json と同じ契約 — null 埋めやプレースホルダは入れない）。Phase 30 の判定エージェントは「スナップショット欠落銘柄 = データ不足として判定スキップ/保留」を実装する（本フェーズはその契約を CONTEXT/計画に明記して引き継ぐ）
- **D-18: ニュースマップは全アクティブ銘柄のキーを必ず持つ**（マッチ0件は空配列 — buildHoldingNewsMap の D-08 保証をそのまま享受）。「キーがない」と「マッチ0件」の曖昧さを構造的に排除する
- **D-19: 入力の watchlist.json 読込は read-only・防御的** — `getActiveWatchlistEntries`（Phase 28 の安定シグネチャ）でアクティブ銘柄を導出する。watchlist.json が欠損（ENOENT）の場合は空ウォッチリストとして D-04 の正常系（初回実行・登録0件の日はこのパス）。JSON 破損・形状不整合の場合は `[STEP:watchlist-data:FAIL:<理由>]` を出しつつ空の有効JSON2ファイルを書いて終了する（Phase 30 が常に有効JSONを読める契約を破損時も守る。watchlist.json 自体には一切書き込まない）
- **D-20: tmp/news.json の読込失敗はニュース側のみの欠落に留める** — 記事プールが読めない場合、ニュースマップは全銘柄空配列で出力し、テクニカル収集は継続する（片系の失敗が他系を道連れにしない部分 fail-soft）

### テスト方針
- **D-21: 純関数部分（watchlist→PortfolioHolding 形状マップ、キャッシュ突き合わせ、チャンク分割）を単体テストする**。ネットワークモックは既存規約（プレーン Error シミュレート — urgency-history.test.ts / filter-etf-stocks.test.ts / collect-technicals.test.ts 参照）。Success Criteria 3 の「1銘柄失敗が全体を止めないことのテスト確認」を必須ケースに含める

### Claude's Discretion
- 純関数モジュールの配置（`src/portfolio/watchlist-data.ts` 等の新モジュール vs 既存モジュールへの追加）と正確な関数シグネチャ — D-13/D-14 の要件を満たす範囲で
- チャンクサイズ・チャンク間待機msの具体値と定数名（D-09 の目安の範囲内）
- technicals.ts から1銘柄取得ロジックを再利用する具体手段（`fetchTechnicalSnapshot` の export 追加 vs チャンク版ヘルパーの追加。既存 `fetchTechnicalSnapshots` の挙動を変えないことが唯一の制約）
- CLI のログ文言・フォーマット詳細（日本語ログ、console.log=監査ログ / console.error=STEPステータスのチャネル規約踏襲）
- 単体テストのケース構成の詳細

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.7 リサーチ（設計根拠）
- `.planning/research/SUMMARY.md` §Phase 3 — 本フェーズの deliverables（watchlist-technicals.json / watchlist-news.json）・「batching/staggering/fail-soft-per-ticker を最初から設計に含める（後付け禁止）」の明示指示
- `.planning/research/ARCHITECTURE.md` — Pattern 4（既存マッチャーの新ティッカー集合への一般化、無改変流用のコード例）・Step 3-W2 のデータフロー図・Structure Rationale
- `.planning/research/PITFALLS.md` — Pitfall 3（レート制限: バッチ化・スタガー・同日キャッシュ・per-ticker fail-soft の4点セット。bounded N 前提の暗黙流用への警告と警戒サイン）

### 要件・ロードマップ・前フェーズ決定
- `.planning/REQUIREMENTS.md` — TRAC-01/02/03・OPS-06 の正式定義
- `.planning/ROADMAP.md` §Phase 29 — Success Criteria 4項目
- `.planning/phases/28-watchlist-persistence/28-CONTEXT.md` — D-04（社名の登録時保存 → 本フェーズ D-14 が消費）・D-06（アクティブ銘柄導出の単純性は Phase 29/30 の下流契約）・deferred「matchAliases 人手キュレーション」（本フェーズ D-15 で維持）
- `.planning/phases/28-watchlist-persistence/28-PATTERNS.md` — Phase 28 実装時のパターンマップ（存在すれば参照）

### 変更対象・参照コード
- `.claude/commands/invest.md` — パイプライン定義。Step 2h（本フェーズの挿入点直前、write-watchlist.ts の STEP マーカー様式の手本）・Step 2b（collect-technicals 呼び出しの既存様式）・Step 3.0（tmp クリーンアップ規約）
- `src/portfolio/watchlist.ts` — `getActiveWatchlistEntries` / `isActive` / `WatchlistEntry`（Phase 28 成果物。本フェーズが消費する安定シグネチャ、変更しない）
- `src/portfolio/holding-news.ts` — `buildHoldingNewsMap` / `normalizeHoldingSymbol` / `HoldingNewsFile` / `MAX_ARTICLES_PER_HOLDING`（無改変流用、D-13）
- `src/portfolio/holdings.ts` — `PortfolioHolding` 型（形状マップの目標型、D-14）
- `src/data/technicals.ts` — `TechnicalSnapshot` 型・`buildSnapshot`・`fetchTechnicalSnapshots`（既存挙動を変えない制約対象、D-08/D-09）
- `src/scripts/collect-technicals.ts` — 既存 CLI（変更しない。出力形状・fail-soft 空書き込み・ログ様式の手本）
- `src/scripts/collect-data.ts` — `buildHoldingNewsMap` の既存呼び出し例（tmp/holding-news.json 生成箇所）

### 流用パターン（実装の雛形）
- `src/scripts/write-watchlist.ts` — fail-soft CLI・stderr STEP マーカー出力の直近実装例（Phase 28 成果物）
- `src/portfolio/urgency-history.ts` ＋ `src/scripts/write-urgency-history.ts` — 純関数＋fail-soft CLI 分離・ENOENT 二重チェックの実証済みテンプレート
- `src/scripts/collect-technicals.test.ts` / `src/portfolio/holding-news.test.ts` / `src/portfolio/watchlist.test.ts` — テストモック規約の参照元

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getActiveWatchlistEntries`（watchlist.ts）: アクティブ銘柄導出の Phase 28 確定シグネチャ。本フェーズの入力起点（D-19）
- `buildHoldingNewsMap` / `resolvePortfolioHoldingNews`（holding-news.ts）: `PortfolioHolding` 形状に対して既に一般化済み — 呼び出し側で形状マップするだけで無改変流用可能（D-13/D-14、research Pattern 4 が実コードで検証済み）
- `TechnicalSnapshot` / `buildSnapshot` / chart 取得ロジック（technicals.ts）: MA20/50/200・RSI14・出来高比・52週高安・asOf をすべて内包。TRAC-01 の指標要件を追加実装なしで満たす
- `WatchlistEntry.name` / `nameJa`（Phase 28 D-04 で登録時保存済み）: ニュース社名マッチの入力として即利用可能
- collect-technicals.ts の fatal 時空スナップショット書き込みパターン: D-04/D-19 の「破損時も有効JSONを書く」契約の雛形

### Established Patterns
- 「LLM自己申告を信用せず、TSで決定できるものはTS側決定論」— 本フェーズはデータ供給全体が純TS（LLM関与ゼロ）でこの方針の完全適用
- fail-soft の2粒度: 銘柄単位（skip＋ログ）とステップ単位（STEP:FAIL でもパイプライン継続）— Phase 27 D-03 の区別を踏襲
- tmp/*.json ハンドオフ境界: TS↔Claude の受け渡しはすべてファイル経由。ID参照方式で記事本体の複製を避ける（v2.5 Phase 19）
- イミュータブル構築・readonly 型・日本語コメント/ログが既存規約

### Integration Points
- invest.md Step 2h 完了直後: `npx tsx src/scripts/collect-watchlist-data.ts` を新 Step 2i として挿入（D-01）。入力は data/watchlist.json（Step 2h で当日更新済み）＋ tmp/news.json（Step 1 生成）＋ tmp/technicals.json（Step 2b 生成、同日キャッシュ）
- 出力 tmp/watchlist-technicals.json / tmp/watchlist-news.json: Phase 30 の判定エージェントプロンプト注入と Phase 31 のレポート描画が消費する下流契約（D-05〜D-07、D-17/D-18）
- tmp/ 出力は日次揮発（Step 3.0 のクリーンアップ規約とは独立。Step 2i 時点で自ファイルを上書き生成するため残留混入なし — プランナーは Step 3.0 の rm 対象に含めるか要確認）

</code_context>

<specifics>
## Specific Ideas

- research Pitfall 3 の4点セット（バッチ化・スタガー・同日キャッシュ・per-ticker fail-soft）を D-09/D-11/D-10 で全点採用する。「開発時は3〜5銘柄で見えず、本番で数週間後に顕在化する」性質のため、最初の実装に含める（後日リトロフィット禁止が research の明示指示）
- Phase 28 の「1コール2役」設計（batch quote() で quoteType と社名を同時取得）の投資回収点が本フェーズの D-14 — 保存済み社名により、research が想定したプレースホルダ（ticker が name を兼ねる）より高精度なニュースマッチが初日から動く
- 警戒サイン（research Pitfall 3）をログで観測可能にする: ウォッチリスト銘柄の取得失敗ログ（D-10）とステップ実行時間は launchd ログから事後監査できる形式にする

</specifics>

<deferred>
## Deferred Ideas

- **watchlist ティッカーへの matchAliases 人手キュレーション**: ticker 完全一致＋社名一致で開始し、マッチ精度不足が観測されたら追補（Phase 28 CONTEXT から継続。D-15）
- **判定LLM呼び出しのバッチ化（5〜8銘柄/コール）**: アクティブ30銘柄超で検討するトリガーポイント（research ARCHITECTURE）。Phase 30 の管轄
- **Finnhub 銘柄別カンパニーニュースのウォッチリスト適用**: 現状は tmp/news.json 既存プールからの抽出のみ（TRAC-02 の文言どおり）。ウォッチリスト銘柄専用の追加ニュース取得は API 予算を消費するため、プール抽出の精度不足が観測されたら将来フェーズで検討
- **アクティブ銘柄数の上限キャップ**: Phase 28 deferred の継続（monitor first, cap later）。本フェーズの取得失敗ログ・実行時間ログが観測データを供給する

</deferred>

---

*Phase: 29-Daily Tracking Data Supply*
*Context gathered: 2026-07-15*
