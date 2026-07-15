# Phase 31: Daily Report Watchlist Section - Research

**Researched:** 2026-07-16
**Domain:** Server-side HTML report rendering (TypeScript, Node.js, no framework — hand-rolled HTML string templates)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**セクション配置と見出し**
- D-01: ウォッチリストセクションは「注目銘柄スコアリングマトリクス」（`scoringSection`）の直後・「WebSearch リサーチ結果」の前に挿入する。`generateDailyReportHtml` 内のセクション連結に新セクション変数を1つ追加する形。
- D-02: セクションは専用の純関数 `formatWatchlistSectionHtml`（命名はプランナー裁量）として実装し、既存セクション関数（`formatHighlightedStocksHtml` 等）と同じ「MeetingResult 等を受け取り HTML 文字列を返す」規律に従う。

**銘柄表示フォーマット**
- D-03: 表示様式は portfolio-report の保有銘柄カード様式（h4 見出し＋散文段落）を流用し、テーブルは使わない。1銘柄 = 1カードブロック。
- D-04: カード見出しは「ティッカー — 会社名」形式。会社名は `data/watchlist.json` のエントリの `nameJa ?? name` から取得し、取得不能時はティッカーのみにフォールバック（ローダーで watchlist.json と join する）。
- D-05: signals（合致シグナル配列）はカード内に列挙表示する（インラインピル or 箇条書き、詳細はプランナー裁量）。
- D-06: as-of タイムスタンプと市場セッション注記をバッジ横に必ず表示する。US=「前日終値時点」/ JP=「寄付き前時点」の基準時点の違いを表示上も区別する。
- D-07: `status: "skipped"` の銘柄は「判定不能（データ不足）」としてグレー系の控えめ表示で描画する。
- D-08: カードのメタ情報としてウォッチリスト登録日（`addedDate`）を小さく表示する。

**バッジ体系と判定変化の視覚表現（UI-10）**
- D-09: バッジは既存の `formatUrgentBadgeHtml` / `formatDecisionChangedBadgeHtml`（generate-portfolio-report.ts）と同じ視覚文法（インライン span・色分け・小型ラベル）で実装する。`todayAction: "buy"` = 緑系の目立つ「今日買うべき」バッジ、`"wait"` = 控えめなニュートラル「待ち」表示。
- D-10: 判定変化バッジは `actionChanged === true` の場合のみ描画し、方向で色を分ける — 待ち→買い = 緑/エメラルド系「シグナル点灯: 待ち → 買い」、買い→待ち = アンバー系「買い → 待ち」。`undefined` と `false` はいずれも変化バッジなし。
- D-11: 変化表示は TS 付与の `previousAction` / `actionChanged` フィールドのみを情報源とする。rationale 文中の変化言及（LLM 自己申告）をパースしない。

**ローダー契約と空・欠損・日付不整合の描画状態**
- D-12: `report-data-loaders.ts` に throw-free の fail-soft ローダーを新設する — `loadWatchlistJudgment(): Promise<WatchlistJudgmentFile | null>`（欠損・破損・形状不整合 → null）と、会社名 join 用のウォッチリスト読込（`loadWatchlist()` 新設 or 既存 `getActiveWatchlistEntries` の防御的流用はプランナー裁量）。`loadUrgencyHistory` / `loadPortfolioAnalysis` の実証済み様式（ENOENT 二重チェック含む）を踏襲する。
- D-13: 日付不整合ガード — `tmp/watchlist-judgment.json` の `date` が当日の meeting-result date と一致しない場合は stale データとして当日データなし扱いにする。
- D-14: 描画は3状態 — ①judgments 1件以上 → フルセクション描画、②ファイル有効かつ judgments 空 → セクション見出し＋「現在ウォッチリスト銘柄はありません」の1行表示、③ローダー null（欠損・破損・日付不整合） → セクション全体を非表示。
- D-15: `generateDailyReportHtml` へのデータ受け渡しは加法的（optional 引数 or デフォルト値付きパラメータ）にし、既存呼び出し・既存テストを壊さない。generate-report.ts 側で既存の `Promise.all` ローダー群に新ローダーを追加し、失敗しても他レポート生成に影響しない構成を維持する（invest.md の変更は不要）。

**テスト方針**
- D-16: セクション描画純関数を単体テストする。必須ケース: 空・1件・複数件、skipped 表示、変化バッジ（待ち→買い / 買い→待ち / undefined 非表示 / false 非表示）、日付不整合 → 非表示、会社名フォールバック。モック規約は既存準拠。

### Claude's Discretion
- セクション見出しの正確な文言・HTML 構造の詳細（カードの CSS、ピル vs 箇条書き）
- バッジの正確な色コード（既存 verdictColor / urgent 赤 / decisionChanged アンバーとの整合を保つ範囲で）
- `formatWatchlistSectionHtml` の配置（generate-daily-report.ts 内 vs 分離モジュール）と正確な関数シグネチャ
- ローダーの正確な形（loadWatchlist 新設 vs watchlist.ts の既存関数の防御的ラップ）
- 単体テストのケース構成の詳細

### Deferred Ideas (OUT OF SCOPE)
- stale「待ち」エントリの視覚的減衰（長期滞留銘柄のグレーアウト等）: D-08 の登録日表示で最小対応。実運用でリスト肥大・視認性低下が観測されたら追加。
- 判定履歴の永続化と的中率検証（`data/watchlist-judgment-history.json`）: WLST-F2（Future Requirements）。
- TS 側表示デバウンス（2日連続同一判定までバッジ切替を抑制）: Phase 30 D-12 の deferred を継続（判定履歴永続化が前提）。
- index.html へのウォッチリスト情報の露出（トップページからの導線強化）: 本フェーズは daily-report.html 内セクションのみ。
- 保有銘柄への買い増しタイミング判定の適用: WLST-F1（Future Requirements）。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-09 | Daily Report にウォッチリストセクションが追加され、各銘柄に「今日買うべき」バッジ（または「待ち」表示）と判定理由・会社名が表示される | §Standard Stack（既存レンダリングパターンの直接再利用）、§Architecture Patterns Pattern 1〜3（カード構造・データ結合・バッジ文法）、§Code Examples |
| UI-10 | 前日からの判定変化（新規買いシグナル点灯・買い→待ち転落）が既存バッジUXと同様の様式で区別表示される | §Architecture Patterns Pattern 3（decisionChanged バッジの直接クローン）、§Common Pitfalls Pitfall 2（undefined/false 区別） |
</phase_requirements>

## Summary

Phase 31 は純粋なレンダリング統合フェーズであり、新規ライブラリ・新規アーキテクチャパターンを一切必要としない。Phase 30 が確定した `WatchlistJudgment` 型（`ticker` / `todayAction` / `rationale` / `signals` / `asOf` / `market` / `previousAction` / `actionChanged` / `status`）を、既存の `generate-portfolio-report.ts` が実証済みの「バッジ関数＋保有銘柄カード」パターンでそのまま daily-report.html に描画する。実装対象は3ファイルの追加・変更のみ: (1) `report-data-loaders.ts` に `loadWatchlistJudgment()` と `loadWatchlist()`（または既存 `getActiveWatchlistEntries` の防御的ラップ）を新設、(2) `generate-daily-report.ts` に `formatWatchlistSectionHtml` 純関数を追加し `scoringSection` の直後に挿入、(3) `generate-report.ts` の `Promise.all` にローダー呼び出しを追加し `generateDailyReportHtml` への引数を拡張。

すべての判定ロジック（confluence ゲート、変化検出、market/asOf 付与、skipped 記録）は Phase 30 で TS 側決定論として完結済みであり、本フェーズは一切のビジネスロジックを持たない「消費して描画するだけ」の層である。これは v2.5〜v2.6 で確立された「LLM 自己申告を信用せず TS 決定論のみを情報源とする」方針の直接の帰結（D-11）であり、実装上のリスクは低い。

**主なリスクは3点**: (1) `generateDailyReportHtml` の既存3引数呼び出し（テスト・呼び出し元双方）への後方互換性維持、(2) 日付不整合ガード（D-13）を実装し忘れると前日の判定が当日分として誤表示される、(3) `formatUrgentBadgeHtml`/`formatDecisionChangedBadgeHtml` は `generate-portfolio-report.ts` 内の非 export 関数のため、Phase 31 では import ではなく同型の新規関数を `generate-daily-report.ts`（または新設の共有モジュール）に複製する必要がある。

**Primary recommendation:** `generate-daily-report.ts` に `formatWatchlistSectionHtml(judgmentFile: WatchlistJudgmentFile | null, watchlist: WatchlistFile, meetingDate: string): string` を新設し、`generatePortfolioReportHtml` のバッジ関数・カード構造をコピー&アダプトする。`generateDailyReportHtml` のシグネチャに `watchlistJudgment: WatchlistJudgmentFile | null = null, watchlist: WatchlistFile = {}` の2つの optional 引数（デフォルト値付き）を追加し、既存の3引数・4引数呼び出しの後方互換性を保つ。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ウォッチリスト判定データの読込（fail-soft） | API/Backend（Node.js CLI レイヤー） | — | `report-data-loaders.ts` は tmp/*.json・data/*.json をファイルシステムから読む純粋な I/O 層。Web サーバーではなくバッチスクリプト内の関数 |
| 日付不整合検証（stale ガード） | API/Backend | — | ローダー内で判定データの `date` フィールドと meeting-result の `date` を比較する決定論的ロジック。表示層に不整合データを渡さない構造的防御 |
| セクション HTML 生成（バッジ・カード・as-of表示） | API/Backend（静的 HTML 生成） | — | このプロジェクトに「Browser/Client」層は存在しない — レポートはビルド時に完全な静的 HTML として生成され GitHub Pages に配置される。すべての描画ロジックは Node.js 側の文字列テンプレート関数 |
| 会社名 join（watchlist.json との結合） | API/Backend | Database/Storage（data/watchlist.json 読取） | ローダーが `data/watchlist.json`（ファイルベース永続化）から `nameJa`/`name`/`addedDate` を取得し、判定データとメモリ内 join する |
| バッジ色・視覚文法の一貫性 | API/Backend（CSS-in-JS 文字列テンプレート） | — | `report-utils.ts` の `generateBaseStyles`/`verdictColor` と同一の埋め込み `<style>` パターンを踏襲。外部 CSS ファイル・フロントエンドフレームワークは存在しない |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.4.3 [VERIFIED: npm registry] | 既存 `report-data-loaders.ts` の `loadPortfolioAnalysis` 等が使う検証ライブラリ。ただし本フェーズの新ローダーは Phase 30 のフォーマットとして既に zod 検証済みの `tmp/watchlist-judgment.json` を読むだけなので、`loadHoldingNews`/`loadUrgencyHistory` 同様 zod を使わず型アサーションのみで良い | プロジェクト全体の既存標準。新規インストール不要（package.json に既存） |

**本フェーズは新規パッケージのインストールを一切必要としない。** すべてのビルディングブロック（`node:fs/promises`, TypeScript の型システム, 既存の `report-utils.ts`/`generate-portfolio-report.ts` パターン）はプロジェクトに既存。

### Supporting
本フェーズに supporting ライブラリの新規追加なし。

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 型アサーションのみの防御的読込（loadHoldingNews方式） | zod スキーマでの再検証（loadPortfolioAnalysis方式） | `tmp/watchlist-judgment.json` は Phase 30 の CLI が自身のロジックで既に zod 検証・確定済みの自社生成物であり、`loadUrgencyHistory`/`loadHoldingNews` と同じ「自社TS生成物は型アサーションで十分、外部由来ではない」区分に該当する。過剰な二重検証は複雑性を増すだけで実益は薄い |

## Installation

新規パッケージインストールは不要。既存の `npm install` 済み依存関係のみで実装可能。

## Package Legitimacy Audit

該当なし — 本フェーズは新規外部パッケージを一切導入しない。既存の zod（package.json 既存依存）以外に依存を追加しないため、Package Legitimacy Gate の対象パッケージが存在しない。

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
[Step 3-J: 判定エージェント実行 (Phase 30, 既に完了)]
        |
        v
tmp/watchlist-judgment.json  (WatchlistJudgmentFile: date, generatedAt, judgments[])
data/watchlist.json          (WatchlistFile: ticker -> WatchlistEntry, 会社名・addedDate)
        |
        | [Step 3c: generate-report.ts main()]
        v
  Promise.all([...既存ローダー群, loadWatchlistJudgment(), loadWatchlist()])
        |
        |  loadWatchlistJudgment():
        |    readFile → JSON.parse → 形状検証
        |    → date !== meetingResult.date の場合 null（D-13 stale ガード）
        |    → 欠損/破損の場合 null
        |
        |  loadWatchlist():
        |    readFile data/watchlist.json → JSON.parse
        |    → 欠損/破損の場合 {}
        v
  generateDailyReportHtml(meetingResult, webSearchResults, reevalResults, marketData,
                            watchlistJudgment, watchlist)
        |
        v
  formatWatchlistSectionHtml(watchlistJudgment, watchlist)
        |
        +-- watchlistJudgment === null        → "" (セクション非表示, D-14 状態③)
        +-- judgments.length === 0            → 見出し + 空メッセージ (D-14 状態②)
        +-- judgments.length > 0              → カード群を描画 (D-14 状態①)
                |
                +-- 各 judgment に対し watchlist[ticker] を join → 会社名/addedDate 解決
                +-- todayAction バッジ（buy=緑強調 / wait=控えめ）
                +-- actionChanged バッジ（true の時のみ、方向で色分け）
                +-- status === "skipped" の場合はグレー「判定不能」表示に分岐
        |
        v
  <section> を scoringSection の直後・webSearchSection の直前に文字列連結（D-01）
        |
        v
  docs/{date}/daily-report.html  (静的HTML、GitHub Pagesにデプロイ)
```

### Recommended Project Structure

新規ファイルは不要。既存3ファイルの変更のみ:

```
src/scripts/
├── generate-daily-report.ts     # 変更: formatWatchlistSectionHtml() 追加 + セクション挿入
├── generate-report.ts           # 変更: Promise.all にローダー2件追加、引数受け渡し拡張
├── report-data-loaders.ts       # 変更: loadWatchlistJudgment() + loadWatchlist() 追加
└── report-data-loaders.test.ts  # 変更: 新ローダーのテストケース追加

src/meeting/types.ts              # 変更なし（WatchlistJudgment/WatchlistJudgmentFile は Phase 30 で確定済み）
src/portfolio/watchlist.ts        # 変更なし（WatchlistFile/WatchlistEntry を read-only 参照するのみ）
```

### Pattern 1: fail-soft ローダー（既存 loadUrgencyHistory 型の直接複製）

**What:** 自社TS生成物の JSON を throw せず読み込み、欠損・破損・形状不整合時はデフォルト値にフォールバックする防御的ローダー。
**When to use:** `tmp/watchlist-judgment.json` と `data/watchlist.json` の両方の読込。
**Example:**
```typescript
// Source: src/scripts/report-data-loaders.ts の loadUrgencyHistory (既存コード, 直接参照)
// 適用形: loadWatchlistJudgment 相当
export async function loadWatchlistJudgment(
  meetingResultDate: string,
): Promise<WatchlistJudgmentFile | null> {
  try {
    const raw = await readFile(join(TMP_DIR, "watchlist-judgment.json"), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("Watchlist judgment load failed (unexpected root shape) — falling back to null");
      return null;
    }
    const file = parsed as WatchlistJudgmentFile;
    if (!Array.isArray(file.judgments) || typeof file.date !== "string") {
      console.warn("Watchlist judgment load failed (missing judgments/date) — falling back to null");
      return null;
    }
    // D-13: 日付不整合ガード — 前日ファイル残留（Phase 30 D-22の帰結）を当日分として誤表示しない
    if (file.date !== meetingResultDate) {
      console.warn(
        `Watchlist judgment date mismatch (file=${file.date}, meeting=${meetingResultDate}) — treating as stale, falling back to null`,
      );
      return null;
    }
    return file;
  } catch (error) {
    console.warn("Watchlist judgment load failed (expected on first run / fail-soft):", error instanceof Error ? error.message : error);
    return null;
  }
}
```

### Pattern 2: バッジ視覚文法の複製（generate-portfolio-report.ts の formatUrgentBadgeHtml 型）

**What:** インライン `<span>` による小型ラベルバッジ。真偽値または enum の状態に応じて表示/非表示・色を切り替える純関数。
**When to use:** `todayAction`（buy/wait の強度差表示, D-09）と `actionChanged`（変化バッジ, D-10）。
**Example:**
```typescript
// Source: src/scripts/generate-portfolio-report.ts (既存コード, 直接参照, D-09/D-10 の雛形)
// generate-portfolio-report.ts の formatUrgentBadgeHtml/formatDecisionChangedBadgeHtml は
// export されていない同一ファイル内関数のため、generate-daily-report.ts では import できない。
// 同型のロジックを新規関数として複製する（コピー&アダプト、共有モジュール化はプランナー裁量）。

function formatTodayActionBadgeHtml(todayAction: "buy" | "wait"): string {
  if (todayAction === "buy") {
    return `<span style="display:inline-block;background:#10b981;color:#0f0f1a;font-size:0.8rem;font-weight:bold;padding:0.2rem 0.6rem;margin-left:0.5rem;border-radius:999px;">今日買うべき</span>`;
  }
  // D-09: wait は「バッジではなくラベル程度の強度差」— 目立たせない控えめなインラインテキスト
  return `<span style="color:#9ca3af;font-size:0.8rem;margin-left:0.5rem;">待ち</span>`;
}

// D-10: actionChanged !== true の早期return は formatDecisionChangedBadgeHtml と同一規律
// (undefined/false どちらも非表示、truthy チェック禁止)
function formatActionChangedBadgeHtml(
  actionChanged: boolean | undefined,
  previousAction: "buy" | "wait" | undefined,
  todayAction: "buy" | "wait",
): string {
  if (actionChanged !== true) return "";
  const isNewSignal = previousAction === "wait" && todayAction === "buy";
  const color = isNewSignal ? "#10b981" : "#f59e0b"; // 緑=新規シグナル点灯 / アンバー=買い→待ち転落
  const textColor = isNewSignal ? "#0f0f1a" : "#1a1a28";
  const label = isNewSignal
    ? "シグナル点灯: 待ち → 買い"
    : "買い → 待ち";
  return ` <span style="display:inline-block;background:${color};color:${textColor};font-size:0.75rem;font-weight:bold;padding:0.15rem 0.5rem;margin-left:0.5rem;border-radius:999px;">${label}</span>`;
}
```

### Pattern 3: 保有銘柄カード構造の複製（1銘柄=1ブロック、h4見出し+散文）

**What:** テーブルではなく `<div class="agent-card">` + `<h4>` + `<p>` の散文カード。
**When to use:** ウォッチリスト銘柄1件ごとの描画（D-03）。
**Example:**
```typescript
// Source: src/scripts/generate-portfolio-report.ts formatHoldingEvaluationsHtml (既存コード, D-03 の雛形)
function formatWatchlistJudgmentCardHtml(
  judgment: WatchlistJudgment,
  entry: WatchlistEntry | undefined,
): string {
  // D-04: ティッカー — 会社名。取得不能時はティッカーのみにフォールバック
  const companyName = entry?.nameJa ?? entry?.name;
  const heading = companyName
    ? `${escapeHtml(judgment.ticker)} — ${escapeHtml(companyName)}`
    : escapeHtml(judgment.ticker);

  // D-07: status: "skipped" はグレー系の控えめ表示（「待ち」とは視覚的に区別）
  if (judgment.status === "skipped") {
    return `<div class="agent-card" style="border-left-color:#4b5563;opacity:0.7;">
      <h4>${heading} <span style="color:#6b7280;font-size:0.8rem;">判定不能（データ不足）</span></h4>
    </div>`;
  }

  const actionBadge = formatTodayActionBadgeHtml(judgment.todayAction);
  const changedBadge = formatActionChangedBadgeHtml(judgment.actionChanged, judgment.previousAction, judgment.todayAction);
  // D-06: as-of / market を常にバッジ横に表示（US=前日終値時点 / JP=寄付き前時点）
  const sessionLabel = judgment.market === "JP" ? "寄付き前時点" : "前日終値時点";
  const asOfHtml = judgment.asOf
    ? `<span style="color:#888;font-size:0.75rem;margin-left:0.5rem;">(${escapeHtml(judgment.asOf)} ${sessionLabel})</span>`
    : "";
  // D-05: signals はインラインピル or 箇条書き（ここではピル例）
  const signalsHtml = judgment.signals.length > 0
    ? `<div style="margin-top:0.4rem;">${judgment.signals.map((s) => `<span class="ticker-pill">${escapeHtml(s)}</span>`).join("")}</div>`
    : "";
  // D-08: addedDate を小さく表示
  const addedDateHtml = entry?.addedDate
    ? `<p style="color:#666;font-size:0.75rem;margin-top:0.3rem;">登録日: ${escapeHtml(entry.addedDate)}</p>`
    : "";

  return `<div class="agent-card">
    <h4>${heading}${actionBadge}${changedBadge}${asOfHtml}</h4>
    <p>${escapeHtml(judgment.rationale)}</p>
    ${signalsHtml}
    ${addedDateHtml}
  </div>`;
}
```

### Pattern 4: 3状態フォールバック描画（週次ロールアップ Phase 26 前例の踏襲）

**What:** データソース不在（null）/ 有効だが空 / 有効かつ要素ありの3分岐を、いずれもエラーにせず描画する。
**When to use:** セクション全体のトップレベル分岐（D-14）。
**Example:**
```typescript
// Source: src/scripts/generate-portfolio-report.ts formatWeeklyUrgencyRollupHtml (既存コード, D-14 の直接前例)
export function formatWatchlistSectionHtml(
  judgmentFile: WatchlistJudgmentFile | null,
  watchlist: WatchlistFile,
): string {
  // D-14 状態③: ローダー null（欠損・破損・日付不整合）→ セクション全体を非表示
  if (judgmentFile === null) return "";

  const heading = `<hr>\n    <h2>ウォッチリスト 買いタイミング判定</h2>`;

  // D-14 状態②: ファイル有効かつ judgments 空（アクティブ0件の正常系）
  if (judgmentFile.judgments.length === 0) {
    return `${heading}
    <p style="color: #888; font-size: 0.9rem;">現在ウォッチリスト銘柄はありません</p>`;
  }

  // D-14 状態①: judgments 1件以上 → フルセクション描画
  const cards = judgmentFile.judgments
    .map((j) => formatWatchlistJudgmentCardHtml(j, watchlist[j.ticker]))
    .join("\n");

  return `${heading}
    <p style="color: #888; font-size: 0.9rem; margin-bottom: 1rem;">ウォッチリスト銘柄の本日の買いタイミング判定です。</p>
    ${cards}`;
}
```

### Anti-Patterns to Avoid
- **rationale 文字列から変化を判定する:** LLM 自己申告テキストのパースは信頼できない（D-11 が明示的に禁止）。`actionChanged`/`previousAction` フィールドのみを情報源とする。
- **`judgmentFile.judgments.length === 0` と `judgmentFile === null` を同じ分岐で扱う:** 「アクティブ0件（正常）」と「ファイル欠損・stale（異常/データなし）」は意味が異なり、UI上も別メッセージにする必要がある（D-14）。
- **`actionChanged` を truthy チェックする（`if (actionChanged)`）:** `undefined`（比較不能）と `false`（変化なし）を区別できなくなる。必ず `!== true` の早期 return を使う（既存 `formatDecisionChangedBadgeHtml` と同一規律）。
- **`generateDailyReportHtml` の既存引数を必須化する:** 新規引数を optional にしないと、既存の3引数呼び出し（`generate-report.test.ts` の複数テスト、後方互換テスト Test 35）が壊れる。デフォルト値付きパラメータで加法的に追加する（D-15）。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| バッジの視覚文法（色・形・強度） | 新しいバッジ CSS システム | `generate-portfolio-report.ts` の `formatUrgentBadgeHtml`/`formatDecisionChangedBadgeHtml` と同一のインライン span パターンをコピー | D-09 の明示要求。視覚的一貫性を保つため独自デザインは禁止 |
| HTML エスケープ | 独自の文字列サニタイズ | `report-utils.ts` の `escapeHtml` | プロジェクト全体の唯一の XSS 対策関数。全動的文字列（ticker/rationale/nameJa/signals）に必須適用 |
| ベーススタイル（フォント・背景・カード） | 新規 `<style>` ブロック | `generateDailyReportHtml` が既に呼んでいる `generateBaseStyles("#3b82f6")` を再利用 | Daily Report のアクセントカラーは既に確定済み。新セクションは既存 `.agent-card` クラスを再利用するだけで統一感が保たれる |
| 日付整合性チェック | 独自の日付パーサー | 単純な文字列等値比較 `file.date !== meetingResultDate`（Phase 25/28 の isValidDateKey パターンに倣うなら形式検証も追加可） | D-13 は「当日と一致しない場合は stale」という単純な決定論的ルール。複雑な暦計算は不要（`calendarDaysBetween` 等は watchlist.ts の失効ロジック専用で本フェーズには無関係） |

**Key insight:** このフェーズはゼロから設計すべき要素が実質的に存在しない。すべてのUIパターン（バッジ、カード、3状態フォールバック、fail-softローダー）はこのコードベース内に直近1〜2フェーズ以内の実装済み前例（Phase 22/26/28/29/30）を持つ。実装の主な作業は「コピー＆パラメータ調整」であり新規デザイン判断ではない。

## Common Pitfalls

### Pitfall 1: `generateDailyReportHtml` の後方互換性破壊
**What goes wrong:** 新規引数を必須パラメータとして追加すると、既存の `generate-report.test.ts` Test 35（「marketData 省略時（3引数呼び出し）でも HTML が正常に生成される」）や `generateHtml`（generate-report.ts 内のラッパー関数、3引数のみ）が型エラー・実行時エラーになる。
**Why it happens:** TypeScript の関数シグネチャ変更は呼び出し元すべてに波及する。`generateHtml` は `generateDailyReportHtml` を内部で呼んでいるため、後方互換を壊すとこのラッパーも連鎖的に壊れる。
**How to avoid:** 新規引数は末尾に追加し、デフォルト値を必ず設定する（`watchlistJudgment: WatchlistJudgmentFile | null = null, watchlist: WatchlistFile = {}`）。既存の `marketData` 引数のデフォルト値パターン（`= { sectors: [], vixHistory: [] }`）をそのまま踏襲する。
**Warning signs:** `npm run test` で generate-report.test.ts の Test 1/7/8/35 が失敗する、または `generateHtml`（generate-report.ts:84-91）の呼び出しで型エラーが出る。

### Pitfall 2: undefined/false の区別崩壊（actionChanged の truthy チェック）
**What goes wrong:** `if (judgment.actionChanged)` のような truthy チェックを使うと、`actionChanged === false`（前日比較した結果「変化なし」）と `actionChanged === undefined`（前日データが存在せず比較不能）が同じ「バッジ非表示」の結果になり一見問題ないように見えるが、将来デバッグ時に「変化なし」と「比較不能」が区別できないログ・アサーションになりバグの温床になる。
**Why it happens:** JavaScript の truthy/falsy 判定は `undefined` と `false` を同一視する。Phase 22/30 で確立された「TS 側決定論フィールドの undefined/false 区別」という設計意図（新規銘柄の初日に誤って「変化あり/なし」を主張しない）が、表示層の雑な条件分岐で無効化されてしまう。
**How to avoid:** 既存の `formatDecisionChangedBadgeHtml` と同一の `if (decisionChanged !== true) return "";` パターンを厳密にコピーする。テストケースで `actionChanged: undefined` と `actionChanged: false` の両方を個別に検証する（D-16 が要求する必須ケース）。
**Warning signs:** テストで `actionChanged: false` の場合と `actionChanged` プロパティ自体が存在しない場合を分けて検証していない。

### Pitfall 3: 前日残留ファイルの誤表示（stale date ガード漏れ）
**What goes wrong:** Phase 30 D-22 により `tmp/watchlist-judgment.json` はクリーンアップ対象外（前日退避の入力源として必須のため意図的にクリーンアップから除外されている）。したがって Step 3-J が何らかの理由で失敗した日、このファイルには**前日の判定**が残留し得る。日付検証を実装し忘れると、前日の「今日買うべき」判定が当日の判定として誤表示され、実際には失敗して更新されていないデータを閲覧者が「本日の判定」として誤認する。
**Why it happens:** Phase 30 の設計は意図的にこのファイルをクリーンアップ対象外にした（前日退避の仕組みが依存するため）。表示側がこの残留リスクを認識せずに「ファイルが存在すれば当日データ」と誤って仮定すると、ルックアヘッド防止（TIME-05）の思想が表示層で崩れる。
**How to avoid:** `loadWatchlistJudgment` 内で `file.date !== meetingResultDate` を必ずチェックし、不一致なら `null` を返す（D-13）。呼び出し側（`generate-report.ts`）は `meetingResult.date` を明示的にローダーへ渡す。
**Warning signs:** テストで「判定ファイルの date が前日、meeting-result の date が当日」というケースを検証していない。

### Pitfall 4: バッジ関数の export 忘れによる import エラー（またはコピー漏れによる視覚不一致）
**What goes wrong:** `formatUrgentBadgeHtml`/`formatDecisionChangedBadgeHtml` は `generate-portfolio-report.ts` 内で `export` されていない（モジュールプライベート関数）。これを import しようとするとビルドエラーになる。逆に、視覚文法を「似せて書く」だけでコピーすると、色コード（`#10b981`/`#f59e0b`/`#ef4444`）やパディング・border-radius の微妙な差異が生まれ、レポート間で視覚的一貫性が崩れる。
**Why it happens:** 既存コードは「バッジ関数を共有モジュール化する」というリファクタリングを一度も経ていない（各レポートファイル内で完結する設計がこれまでの規律）。
**How to avoid:** ソースコードを直接参照し、色コード・padding・border-radius の値を一字一句コピーする（本 RESEARCH.md の Pattern 2 に転記済みの値を使う）。共有モジュール化（`report-utils.ts` へのバッジ関数移設）はプランナーの裁量だが、必須ではない — D-09 は「同じ視覚文法」を要求しているのであって「同じ関数の再利用」は要求していない。
**Warning signs:** レポートを並べて見た際にバッジの緑・アンバーの色味やサイズが微妙に異なる。

### Pitfall 5: watchlist.json の join キー不一致
**What goes wrong:** `WatchlistJudgment.ticker` と `WatchlistFile` のキー（`normalizeHoldingSymbol` で正規化済み）が表記揺れ（大文字小文字・空白）で一致せず、`watchlist[judgment.ticker]` が `undefined` になり会社名が常にフォールバック（ティッカーのみ）表示になる。
**Why it happens:** Phase 30 の `WatchlistJudgment.ticker` が判定エージェントの入力データ（`data/watchlist.json` のキーそのもの、またはテクニカルスナップショットのティッカー）からどう伝播しているか、正規化の有無を確認せずに直接 `Record` lookup すると Pitfall 2（generate-portfolio-report.ts の既知パターン）と同種の問題が再発する。
**How to avoid:** join 時に `normalizeHoldingSymbol(judgment.ticker)` を明示的に適用してから `watchlist[normalizedTicker]` を引く（`generate-portfolio-report.ts` の `resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)]` と同型パターン）。`normalizeHoldingSymbol` は `src/portfolio/holding-news.ts` からインポート可能（export 済み）。
**Warning signs:** テストで意図的に大文字小文字を変えたティッカーを使い、会社名が正しく解決されるか検証していない。

## Code Examples

Verified patterns from direct codebase inspection (no external library docs needed — all patterns are internal):

### fail-soft ローダーの完全な形（既存 loadUrgencyHistory、直接参照可能）
```typescript
// Source: src/scripts/report-data-loaders.ts:143-159 (verified — read directly)
export async function loadUrgencyHistory(): Promise<UrgencyHistoryFile> {
  try {
    const raw = await readFile(join(DATA_DIR, "urgency-history.json"), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("Urgency history load failed (unexpected root shape) — falling back to {}");
      return {};
    }
    return parsed as UrgencyHistoryFile;
  } catch (error) {
    console.warn("Urgency history load failed (expected on first run / fail-soft, HIST-03):", error instanceof Error ? error.message : error);
    return {};
  }
}
```

### generateDailyReportHtml の既存セクション組立パターン（挿入点の直接参照）
```typescript
// Source: src/scripts/generate-daily-report.ts:239-280 (verified — read directly)
const sectorSection = formatSectorRecommendationsHtml(result);
const scoringSection = formatHighlightedStocksHtml(result);
// D-01 の挿入点: ここに watchlistSection を追加
const webSearchSection = formatWebSearchHtml(webSearchResults);
// ...
return `<!DOCTYPE html>
...
    ${sectorSection}
    ${scoringSection}
    ${/* watchlistSection をここに挿入 */""}
    ${webSearchSection}
    ...`;
```

## State of the Art

このプロジェクトに「古いアプローチ→新しいアプローチ」の技術的移行は存在しない。バッジ+カードパターンは Phase 20（UI-05/06 ニュースカード）→ Phase 22（urgent/decisionChangedバッジ）→ Phase 26（週次ロールアップ3状態）→ Phase 30（判定データ契約）と一貫して同一パターンで進化してきており、Phase 31 はその延長線上の最新かつ最後の適用例である。

**Deprecated/outdated:** 該当なし。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `data/watchlist.json` のキーは `WatchlistJudgment.ticker` と同じ正規化規約（`normalizeHoldingSymbol`）で書かれている | Common Pitfalls Pitfall 5 | Phase 28/30 の実装コードで両方とも `normalizeHoldingSymbol` を通しているため、コード上は確認済み（`[VERIFIED: codebase]` に近いが、Phase 30 の実際の判定エージェント出力ファイルを実行時に見ていないため念のため ASSUMED とする）。誤りの場合、会社名が解決できず全銘柄がティッカーのみ表示になる（機能は壊れないが UX 劣化） |
| A2 | セクション見出し文言「ウォッチリスト 買いタイミング判定」はプランナー裁量で確定される想定の一例であり、確定ではない | Architecture Patterns Pattern 4 | CONTEXT.md が「セクション見出しの正確な文言」を Claude's Discretion と明記しているため、この見出し文言自体はプランナーが変更してよい。異なる文言を選んでも Success Criteria には影響しない |

**If this table is empty:** N/A — 上記2件のみで、いずれも低リスク（実装詳細レベルのプランナー裁量事項）。

## Open Questions

1. **バッジ関数を共有モジュール化するか、コピーするか**
   - What we know: D-09/D-10 は「同じ視覚文法」を要求しているのみで、コード共有までは要求していない。`formatUrgentBadgeHtml`/`formatDecisionChangedBadgeHtml` は現在 export されていない。
   - What's unclear: プランナーが `report-utils.ts` へのバッジ関数移設（リファクタリング）を計画に含めるか、それとも `generate-daily-report.ts` 内に複製するか。
   - Recommendation: 本フェーズのスコープ最小化のため、複製（コピー&アダプト）を推奨。共有モジュール化は「LLM生成コンテンツはテーブルではなく段落」のような確立方針ではなく、任意のリファクタリングであり、既存2ファイルへの副作用（他テストの破壊リスク）を避けるべき。

2. **`loadWatchlist()` を新設するか、`getActiveWatchlistEntries` を防御的にラップするか**
   - What we know: `src/portfolio/watchlist.ts` の `getActiveWatchlistEntries(watchlist: WatchlistFile)` は純関数でファイル I/O を持たない。`report-data-loaders.ts` は I/O を担う層。
   - What's unclear: 会社名 join には非アクティブ（除外済み）銘柄の会社名は不要（アクティブなウォッチリスト銘柄のみが Phase 30 の判定対象）だが、`WatchlistFile` オブジェクト全体をロードして `Record<ticker, WatchlistEntry>` のまま `formatWatchlistSectionHtml` に渡す方がシンプルか、`getActiveWatchlistEntries` でフィルタしてから渡す方がシンプルか。
   - Recommendation: `report-data-loaders.ts` に `loadWatchlist(): Promise<WatchlistFile>`（fail-soft, 欠損/破損時は `{}`）を新設し、`WatchlistFile` オブジェクトのままセクション関数へ渡す。フィルタリングは不要 — `formatWatchlistSectionHtml` は `judgmentFile.judgments`（既にアクティブ銘柄のみ）をループの起点にし、`watchlist[ticker]` を lookup するだけなので非アクティブエントリの混入リスクがない。

## Environment Availability

該当なし — 本フェーズは外部サービス・CLIツール・ランタイム依存を一切追加しない。既存の Node.js/TypeScript/vitest 環境のみで完結する。

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 全スクリプト実行 | ✓ | v24.3.0 | — |
| vitest | テスト実行 | ✓ | package.json 既存（`npm run test` = `vitest run`） | — |
| zod | 型検証（新ローダーでは不使用、既存パターン踏襲） | ✓ | 4.4.3 | 型アサーションのみで十分（loadHoldingNews 方式） |

**Missing dependencies with no fallback:** なし
**Missing dependencies with fallback:** なし

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest（package.json 既存、バージョン確認は `npm ls vitest` 参照） |
| Config file | none — `vitest.config.*` は存在しない（デフォルト設定で `npm run test` = `vitest run`） |
| Quick run command | `npm run test -- report-data-loaders.test.ts` または `npm run test -- generate-report.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-09 | judgments 1件以上でバッジ・理由・会社名がHTMLに含まれる | unit | `npm run test -- generate-report.test.ts` | ✅（既存ファイルに追加） |
| UI-09 | judgments 空でも正常描画（見出し＋空メッセージ） | unit | `npm run test -- generate-report.test.ts` | ✅ |
| UI-09 | judgmentFile null（欠損・破損・stale）でセクション非表示 | unit | `npm run test -- generate-report.test.ts` | ✅ |
| UI-09 | 会社名フォールバック（watchlist.json にエントリなし → ticker のみ） | unit | `npm run test -- generate-report.test.ts` | ✅ |
| UI-09 | status: "skipped" 銘柄がグレー「判定不能」表示 | unit | `npm run test -- generate-report.test.ts` | ✅ |
| UI-10 | actionChanged: true（待ち→買い）で緑バッジ | unit | `npm run test -- generate-report.test.ts` | ✅ |
| UI-10 | actionChanged: true（買い→待ち）でアンバーバッジ | unit | `npm run test -- generate-report.test.ts` | ✅ |
| UI-10 | actionChanged: undefined / false でバッジ非表示（区別） | unit | `npm run test -- generate-report.test.ts` | ✅ |
| — | loadWatchlistJudgment: 正常読込・ENOENT・破損・stale date の4分岐 | unit | `npm run test -- report-data-loaders.test.ts` | ✅（既存ファイルに追加） |
| — | loadWatchlist: 正常読込・ENOENT・破損の3分岐 | unit | `npm run test -- report-data-loaders.test.ts` | ✅ |
| — | generateDailyReportHtml 既存3引数呼び出しの後方互換性維持 | unit | `npm run test -- generate-report.test.ts` | ✅（既存 Test 35 が既にカバー、新規引数追加後も green を維持する必要あり） |

### Sampling Rate
- **Per task commit:** `npm run test -- report-data-loaders.test.ts generate-report.test.ts`
- **Per wave merge:** `npm run test`（フルスイート）
- **Phase gate:** フルスイート green を `/gsd-verify-work` 前に確認

### Wave 0 Gaps
None — 既存テストファイル（`report-data-loaders.test.ts`, `generate-report.test.ts`）が両方存在し、既存の fixture/mock 規約（`vi.mock("node:fs/promises")`, `vi.spyOn(console, "warn"/"error")`）がそのまま新規テストケースに適用可能。新規テストファイルの作成は不要（既存ファイルへのテストケース追加のみ）。

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | レポートは静的HTML生成、認証機構なし（GitHub Pages 公開） |
| V3 Session Management | no | セッション概念なし |
| V4 Access Control | no | アクセス制御なし（既存レポートと同一の公開設定） |
| V5 Input Validation | yes | judgment データは Phase 30 の zod スキーマで既に検証済みだが、本フェーズのローダーでも形状の防御的チェック（`Array.isArray(file.judgments)`, `typeof file.date === "string"`）を行う（既存 `loadUrgencyHistory` の CR-02 パターン踏襲） |
| V6 Cryptography | no | 暗号処理なし |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS（LLM生成 rationale/signals/ティッカー文字列への任意HTML混入） | Tampering | `escapeHtml`（`report-utils.ts`）を rationale・signals・ticker・nameJa・addedDate・asOf の全動的文字列に適用する。既存の `formatHoldingEvaluationsHtml`/`formatWeeklyUrgencyRollupHtml` と同一規律（v2.6 WR-03 で明示的にコメントされている「他の全ての動的文字列と同様、日付も escapeHtml を通す」という defense-in-depth 方針を踏襲） |
| Prototype pollution（JSON.parse された `data/watchlist.json` のキーが `__proto__` 等） | Tampering | `watchlist[ticker]` の lookup は plain object の property access であり、Phase 27 の `quoteTypeByTicker` 同様 `ReadonlyMap` 化するか、`Object.prototype.hasOwnProperty.call` を使う防御は本フェーズでは必須ではない（読み取り専用 lookup であり書き込みは発生しないため実害は限定的）が、CR-02 と同型の「root shape 検証」（`typeof parsed !== "object" \|\| Array.isArray(parsed)`）は `loadWatchlist()` にも適用する |
| SSRF / 外部リクエスト | Spoofing | 該当なし — 本フェーズはファイルシステム読込のみで外部ネットワークリクエストを一切行わない |

## Sources

### Primary (HIGH confidence)
- `src/scripts/generate-daily-report.ts` — 直接読込。セクション構成・関数シグネチャ・挿入点を確認 [VERIFIED: codebase read]
- `src/scripts/generate-report.ts` — 直接読込。Promise.all ローダー構成・main() の組立順序を確認 [VERIFIED: codebase read]
- `src/scripts/report-data-loaders.ts` — 直接読込。fail-soft ローダーパターン（loadUrgencyHistory/loadPortfolioAnalysis/loadHoldingNews）を確認 [VERIFIED: codebase read]
- `src/scripts/generate-portfolio-report.ts` — 直接読込。バッジ関数（formatUrgentBadgeHtml/formatDecisionChangedBadgeHtml）・カード構造・3状態フォールバック（formatWeeklyUrgencyRollupHtml）を確認 [VERIFIED: codebase read]
- `src/scripts/report-utils.ts` — 直接読込。escapeHtml/verdictColor/generateBaseStyles/ACCENT_VARIANTS の実装を確認 [VERIFIED: codebase read]
- `src/meeting/types.ts` — 直接読込。WatchlistJudgment/WatchlistJudgmentFile の正確な型定義（Phase 30確定済み）を確認 [VERIFIED: codebase read]
- `src/portfolio/watchlist.ts` — 直接読込。WatchlistFile/WatchlistEntry/getActiveWatchlistEntries を確認 [VERIFIED: codebase read]
- `src/scripts/report-data-loaders.test.ts` / `src/scripts/generate-report.test.ts` — 直接読込。テストモック規約（vi.mock, vi.spyOn console.warn/error, fixture builder）を確認 [VERIFIED: codebase read]
- `.planning/phases/30-buy-timing-judgment-agent/30-CONTEXT.md` / `.planning/phases/30-buy-timing-judgment-agent/30-PATTERNS.md` — Phase 30 の確定決定事項（asOf/market/previousAction/actionChanged/status の意味論）を確認
- `.planning/phases/28-watchlist-persistence/28-CONTEXT.md` / `28-PATTERNS.md` — WatchlistEntry の name/nameJa/addedDate 契約を確認
- `.planning/REQUIREMENTS.md` — UI-09/UI-10 正式定義
- `package.json` — zod バージョン 4.4.3 [VERIFIED: npm registry via `npm view zod version`]

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` §Phase 5 — 「direct reuse of the existing urgent/decisionChanged badge+rationale rendering pattern and loadUrgencyHistory() loader contract」という研究時点の結論を再確認。本 RESEARCH.md はこの結論をコード直接検証で裏付けた

### Tertiary (LOW confidence)
なし — 本フェーズは外部ライブラリ・外部API・外部ドキュメント参照を必要としないため、Web検索は実施していない（すべて内部コードベース検証で完結）。

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 新規パッケージなし、既存 package.json の zod バージョンのみ npm view で確認
- Architecture: HIGH — 全パターンを対象ファイルの直接読込（Read tool）で検証済み、外部推測なし
- Pitfalls: HIGH — 全5件のPitfallは既存コードの実際のコメント（Pitfall 2/5/7 等の既存参照）とPhase 30 CONTEXT.mdの明示的設計意図から導出、外部一般論の当てはめではない

**Research date:** 2026-07-16
**Valid until:** 本フェーズの依存関係（Phase 30 完了済み・確定型）が変わらない限り有効期限なし。ただし generate-daily-report.ts / generate-portfolio-report.ts が他フェーズ計画中に変更される場合は再確認が必要（30日を目安）。
</content>
