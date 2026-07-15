# Phase 31: Daily Report Watchlist Section - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Mode:** --auto（全グレーエリアを推奨オプションで自動確定。根拠は .planning/research/ の v2.7 リサーチ §Phase 5、REQUIREMENTS.md の UI-09/UI-10、および Phase 28/29/30 の確定済み決定・実装成果物）

<domain>
## Phase Boundary

Daily Report（daily-report.html）にウォッチリストセクションを追加し、Phase 30 が生成した `tmp/watchlist-judgment.json` の判定を閲覧者が一目で把握できる形で描画する:

1. **判定表示（UI-09）**: 各銘柄に「今日買うべき」バッジ（または「待ち」表示）・判定理由・会社名を表示
2. **変化表示（UI-10）**: 前日からの判定変化（新規買いシグナル点灯・買い→待ち転落）を既存の urgent/decisionChanged バッジと同様の視覚様式で区別表示
3. **fail-soft 描画**: ウォッチリストが空・1件・複数件のいずれでもレポートが正常に描画され、判定データの欠損・破損・日付不整合が既存 3+1 レポートの生成・デプロイに一切影響しない

判定の生成（Phase 30 完了済み）・ウォッチリストの登録/除外（Phase 28 完了済み）・追跡データ収集（Phase 29 完了済み）は本フェーズの範囲外。パイプライン（invest.md）への新ステップ追加は不要 — 描画は既存 Step 3c（generate-report.ts）の内部で行う。Requirements: UI-09, UI-10。

</domain>

<decisions>
## Implementation Decisions

### セクション配置と見出し
- **D-01: ウォッチリストセクションは「注目銘柄スコアリングマトリクス」（`scoringSection`）の直後・「WebSearch リサーチ結果」の前に挿入する**。強気評価された銘柄（スコアリング）→ その追跡リストの買いタイミング判定、という文脈連続性があり、行動可能な情報を市場文脈（市場概況・セクター）の後・詳細リサーチの前に置く。generate-daily-report.ts の HTML 組み立て（`generateDailyReportHtml` 内のセクション連結）に新セクション変数を1つ追加する形
- **D-02: セクションは専用の純関数 `formatWatchlistSectionHtml`（命名はプランナー裁量）として実装し、既存セクション関数（`formatHighlightedStocksHtml` 等）と同じ「MeetingResult 等を受け取り HTML 文字列を返す」規律に従う**。generate-report.ts の HTML テンプレート直接編集禁止の規約（invest.md 冒頭）に準拠し、テスト可能な関数分離を維持する

### 銘柄表示フォーマット
- **D-03: 表示様式は portfolio-report の保有銘柄カード様式（h4 見出し＋散文段落）を流用し、テーブルは使わない**。判定理由（rationale）は LLM 生成の日本語散文であり、「LLM 生成コンテンツはテーブルではなく箇条書き/段落」の確立済み方針（v2.1 以来）に従う。1銘柄 = 1カードブロック
- **D-04: カード見出しは「ティッカー — 会社名」形式**。会社名は `data/watchlist.json` のエントリ（Phase 28 D-04 で登録時保存済みの `nameJa ?? name`）から取得し、取得不能時はティッカーのみにフォールバック（判定ファイルは ticker のみ保持のため、ローダーで watchlist.json と join する）
- **D-05: signals（合致シグナル配列）はカード内に列挙表示する**（インラインピル or 箇条書き、詳細はプランナー裁量）。Phase 30 D-06 が「Phase 31 の表示が消費できる構造」として設計したフィールドの消費点。confluence ≥2 の判定根拠を閲覧者が検証できる形にする
- **D-06: as-of タイムスタンプと市場セッション注記をバッジ横に必ず表示する**。judgment の `asOf` / `market` フィールド（Phase 30 D-15 が「Phase 31 のデータ契約として欠落させない」と明記した値）を使い、US=「前日終値時点」/ JP=「寄付き前時点」の基準時点の違いを表示上も区別する（research §Phase 5 の UX pitfall「always display as-of timestamp next to badge」への直接対応、TIME-05 の表示側の履行）
- **D-07: `status` が `"skipped"` の銘柄は「判定不能（データ不足）」としてグレー系の控えめ表示で描画する**。「待ち」と「判定不能」を視覚的に区別する（Phase 30 D-20 が構造化した「読めなかった vs 判定不能」の区別を表示まで貫通させる）
- **D-08: カードのメタ情報としてウォッチリスト登録日（`addedDate`）を小さく表示する**。長期滞留エントリの文脈を閲覧者に与える（research の「de-emphasize stale still-waiting entries」への最小対応。視覚的減衰処理そのものは deferred）

### バッジ体系と判定変化の視覚表現（UI-10）
- **D-09: バッジは既存の `formatUrgentBadgeHtml` / `formatDecisionChangedBadgeHtml`（generate-portfolio-report.ts）と同じ視覚文法（インライン span・色分け・小型ラベル）で実装する**。`todayAction: "buy"` = 緑系の目立つ「今日買うべき」バッジ、`"wait"` = 控えめなニュートラル「待ち」表示（バッジではなくラベル程度の強度差をつける — 買いシグナルだけが目に飛び込む情報設計）
- **D-10: 判定変化バッジは `actionChanged === true` の場合のみ描画し、方向で色を分ける** — 待ち→買い（新規買いシグナル点灯）= 緑/エメラルド系「シグナル点灯: 待ち → 買い」、買い→待ち（転落）= アンバー系「買い → 待ち」（decisionChanged バッジと同系色）。`undefined`（前日比較不能）と `false`（変化なし）はいずれも変化バッジなし（Phase 22/30 の undefined/false 区別を表示でも尊重し、初日や新規銘柄に誤って「変化」を表示しない）
- **D-11: 変化表示は TS 付与の `previousAction` / `actionChanged` フィールドのみを情報源とする**。rationale 文中の変化言及（LLM 自己申告）をパースしない（「LLM 自己申告を信用しない」確立方針の表示層への適用）

### ローダー契約と空・欠損・日付不整合の描画状態
- **D-12: `report-data-loaders.ts` に throw-free の fail-soft ローダーを新設する** — `loadWatchlistJudgment(): Promise<WatchlistJudgmentFile | null>`（欠損・破損・形状不整合 → null）と、会社名 join 用のウォッチリスト読込（`loadWatchlist()` 新設 or 既存 `getActiveWatchlistEntries` の防御的流用はプランナー裁量）。`loadUrgencyHistory` / `loadPortfolioAnalysis` の実証済み様式（ENOENT 二重チェック含む）を踏襲する
- **D-13: 日付不整合ガード** — `tmp/watchlist-judgment.json` はクリーンアップ対象外（Phase 30 D-22 の前日退避設計の帰結）のため、Step 3-J が失敗した日には前日のファイルが残留し得る。judgment ファイルの `date` が当日の meeting-result date と一致しない場合は stale データとして**当日データなし扱い**にする（前日の判定を当日の判定として誤表示しない — TIME-05 のルックアヘッド防止思想の表示側適用）
- **D-14: 描画は3状態** — ①judgments 1件以上 → フルセクション描画、②ファイル有効かつ judgments 空（アクティブ0件の正常系、Phase 30 D-19 の契約） → セクション見出し＋「現在ウォッチリスト銘柄はありません」の1行表示（機能が動作している可視確認）、③ローダー null（欠損・破損・日付不整合） → セクション全体を非表示（誤解を招く情報を出さない）。Phase 26 の週次ロールアップ3段階空状態の前例踏襲
- **D-15: `generateDailyReportHtml` へのデータ受け渡しは加法的（optional 引数 or デフォルト値付きパラメータ）にし、既存呼び出し・既存テストを壊さない**。generate-report.ts 側で既存の `Promise.all` ローダー群に新ローダーを追加し、失敗しても他レポート生成に影響しない構成を維持する（invest.md の変更は不要 — Step 3-J は既に Step 3c より前に配置済み）

### テスト方針
- **D-16: セクション描画純関数を単体テストする**。必須ケース: 空・1件・複数件（Success Criteria 3）、skipped 表示、変化バッジ（待ち→買い / 買い→待ち / undefined 非表示 / false 非表示）、日付不整合 → 非表示、会社名フォールバック。モック規約は既存準拠（プレーン Error シミュレート — report-data-loaders.test.ts / generate-report.test.ts 参照）

### Claude's Discretion
- セクション見出しの正確な文言・HTML 構造の詳細（カードの CSS、ピル vs 箇条書き）
- バッジの正確な色コード（既存 verdictColor / urgent 赤 / decisionChanged アンバーとの整合を保つ範囲で）
- `formatWatchlistSectionHtml` の配置（generate-daily-report.ts 内 vs 分離モジュール）と正確な関数シグネチャ
- ローダーの正確な形（loadWatchlist 新設 vs watchlist.ts の既存関数の防御的ラップ）
- 単体テストのケース構成の詳細

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.7 リサーチ（設計根拠）
- `.planning/research/SUMMARY.md` §Phase 5 — 本フェーズの deliverables（generate-daily-report.ts 新セクション＋report-data-loaders.ts の fail-soft ローダー）と UX pitfalls（as-of 常時表示・変化理由の説明・空/1件/複数件状態・stale 待ちエントリの扱い）
- `.planning/research/FEATURES.md` — バッジ＋理由表示 UX の practitioner 基準（存在すれば該当節）
- `.planning/research/ARCHITECTURE.md` — Step 3-J → Step 3c のデータフロー（tmp/watchlist-judgment.json が描画入力）

### 要件・ロードマップ・前フェーズ決定
- `.planning/REQUIREMENTS.md` — UI-09 / UI-10 の正式定義
- `.planning/ROADMAP.md` §Phase 31 — Success Criteria 3項目
- `.planning/phases/30-buy-timing-judgment-agent/30-CONTEXT.md` — D-06（signals は Phase 31 の表示が消費）・D-15（asOf/market はデータ契約）・D-19（空リスト正常系）・D-20（skipped 記録の下流契約）・D-22（judgment ファイルはクリーンアップ対象外 → 本フェーズ D-13 の残留リスクの根拠）
- `.planning/phases/28-watchlist-persistence/28-CONTEXT.md` — D-04（社名の登録時保存 → 本フェーズ D-04 が消費）
- `.planning/phases/30-buy-timing-judgment-agent/30-PATTERNS.md` / `.planning/phases/29-daily-tracking-data-supply/29-PATTERNS.md` — 前フェーズ実装時のパターンマップ（存在すれば参照）

### 変更対象・参照コード
- `src/scripts/generate-daily-report.ts` — 本フェーズの主要変更対象。セクション純関数群と `generateDailyReportHtml` の組み立て順序（D-01 の挿入点 = `scoringSection` 直後）
- `src/scripts/generate-report.ts` — オーケストレーター。`Promise.all` ローダー群への新ローダー追加と `generateDailyReportHtml` への受け渡し（D-15）
- `src/scripts/report-data-loaders.ts` — fail-soft ローダーの追加先。`loadUrgencyHistory` / `loadPortfolioAnalysis` が throw-free 様式の直接の雛形（D-12）
- `src/scripts/generate-portfolio-report.ts` — `formatUrgentBadgeHtml` / `formatDecisionChangedBadgeHtml`（D-09/D-10 のバッジ視覚文法の直接の雛形）・保有銘柄カード様式（D-03 の雛形）
- `src/meeting/types.ts` — `WatchlistJudgment` / `WatchlistJudgmentFile` 型（描画入力の正準形状。asOf/market/previousAction/actionChanged/status の意味は各フィールドの JSDoc 参照）
- `src/portfolio/watchlist.ts` — `WatchlistFile` / `WatchlistEntry`（name/nameJa/addedDate の取得元、変更しない）
- `src/scripts/report-utils.ts` — `escapeHtml` / `verdictColor` / `generateBaseStyles` 等の共有ユーティリティ

### 流用パターン（実装の雛形）
- `src/scripts/generate-portfolio-report.ts` の週次緊急ロールアップ描画（Phase 26 成果物） — 3段階空状態・fail-soft ローダー消費の直近実装例（D-14）
- `src/scripts/report-data-loaders.test.ts` / `src/scripts/generate-report.test.ts` — テストモック規約の参照元

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `formatUrgentBadgeHtml` / `formatDecisionChangedBadgeHtml`（generate-portfolio-report.ts）: インライン span バッジの視覚文法 — 本フェーズのバッジ実装はこの形の複製で足りる（D-09/D-10）
- `loadUrgencyHistory` 等（report-data-loaders.ts）: throw-free・null/空フォールバックの fail-soft ローダー雛形（D-12）
- `WatchlistJudgment` 型（types.ts）: todayAction/rationale/signals/asOf/market/previousAction/actionChanged/status — 描画に必要な全フィールドが Phase 30 で契約済み・TS 決定論付与済み。本フェーズは表示のみで判定ロジックを一切持たない
- `WatchlistEntry.name` / `nameJa` / `addedDate`（watchlist.ts、Phase 28 D-04）: 会社名表示・登録日メタ表示の入力（D-04/D-08）
- 既存セクション関数群（generate-daily-report.ts）: 「純関数がHTML文字列を返す」規律とセクション連結の挿入点

### Established Patterns
- 「LLM 生成散文はテーブルではなくカード/箇条書き」（v2.1 以来のレポート方針）— rationale 表示は段落、signals は列挙（D-03/D-05）
- 「LLM 自己申告を信用せず TS 決定論フィールドのみを情報源とする」— 変化バッジは actionChanged のみ参照（D-11)
- undefined と false の区別（Phase 22/30）— 変化バッジの非表示条件に貫通（D-10）
- fail-soft 描画: ローダー失敗がレポート生成全体を止めない（Phase 26 ロールアップ・Phase 20 保有ニュースの前例）

### Integration Points
- `generate-report.ts` の `Promise.all` ローダー群: `loadWatchlistJudgment()`＋watchlist 読込を追加（D-15）。invest.md の変更は不要（Step 3-J → Step 3c の順序は Phase 30 で確立済み）
- `generateDailyReportHtml` のセクション組み立て: `scoringSection` と `webSearchSection` の間に新セクションを挿入（D-01）
- 入力ファイル: `tmp/watchlist-judgment.json`（Phase 30 出力・当日 date 検証必須 D-13）＋ `data/watchlist.json`（会社名・登録日 join 用、read-only）

</code_context>

<specifics>
## Specific Ideas

- research §Phase 5 の UX pitfalls 4点への対応を明示的に割り付ける: as-of 常時表示（D-06）・変化の区別表示（D-10）・空/1件/複数件状態（D-14）・stale 待ちエントリ（D-08 で最小対応、視覚的減衰は deferred）
- 「買いシグナルだけが目に飛び込む」情報設計 — buy バッジは目立たせ、wait は控えめに（バッジ強度の非対称、D-09）。閲覧者の一目把握（Phase Goal）を バッジ強度差で実現する
- 判定は decision-support であり執行指示ではない（Phase 30 の契約）— セクション内に目標価格・損切りライン等の数値は存在しないし、表示側で創作しない

</specifics>

<deferred>
## Deferred Ideas

- **stale「待ち」エントリの視覚的減衰（長期滞留銘柄のグレーアウト等）**: D-08 の登録日表示で最小対応。実運用でリスト肥大・視認性低下が観測されたら追加（research §Phase 5 UX pitfall の完全対応）
- **判定履歴の永続化と的中率検証（`data/watchlist-judgment-history.json`）**: WLST-F2（Future Requirements）。Phase 30 CONTEXT から継続
- **TS 側表示デバウンス（2日連続同一判定までバッジ切替を抑制）**: Phase 30 D-12 の deferred を継続（判定履歴永続化が前提）
- **index.html へのウォッチリスト情報の露出（トップページからの導線強化）**: 本フェーズは daily-report.html 内セクションのみ。必要になれば将来フェーズで検討
- **保有銘柄への買い増しタイミング判定の適用**: WLST-F1（Future Requirements）

</deferred>

---

*Phase: 31-Daily Report Watchlist Section*
*Context gathered: 2026-07-16*
