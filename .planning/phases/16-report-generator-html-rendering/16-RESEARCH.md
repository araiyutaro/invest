# Phase 16: Report Generator (HTML Rendering) - Research

**Researched:** 2026-07-02
**Domain:** ピュア関数によるHTML文字列生成（既存の `generate-portfolio-report.ts` 系パターンの直接踏襲）。新規リスクは「このコードベース初めてのLLM由来 `<a href>` 描画」「Phase 15契約への加法的フィールド追加（既存テストを壊さない設計）」の2点に集約される。
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**記事カードのレイアウト**
- D-01: 見出し自体を元記事リンクにする（`<a href target="_blank">`）。別途「元記事→」リンクは置かない。hrefはTS側でID照合済みの実URLを使い、`escapeHtml()` を通す（Pitfall 2/5）。
- D-02: 公開時刻は絶対時刻JST表示（例: 「7/2 06:30」）。静的HTMLなので相対表示（「3時間前」）は不採用 — アーカイブ閲覧時に嘘になる。レンダリングはピュア関数内で完結（`Date.now()` 不使用、publishedAt文字列から導出）。
- D-03: カード内の情報階層は「1行目: バッジ+見出し / 2行目: ソース・時刻・ティッカーのメタ行 / 3行目: 解説コメント」の新聞的スキャン構成。
- D-04: ティッカーはシンボルのみでなく**会社名を併記**する（例: 「NVDA エヌビディア」）。社名はキュレーションAgentが選定時に出力する — Phase 15契約にオプショナルな社名フィールドを**加法的に追加**（例: tickersを `{symbol, name?}` 構造にするか、並列の `tickerNames` を追加。既存テストを壊さない形は planner/executor 判断）。社名欠落時はシンボルのみ表示にフォールバック。Agentプロンプト側の指示追加はPhase 17スコープだが、契約変更自体はPhase 16で行う。

**市場グループの見せ方**
- D-05: セクション順は固定で 米国株 → 日本株 → グローバル。ポートフォリオ構成（約80%米国）と朝8時の閲覧文脈（米国市場引け後）に合わせる。
- D-06: 記事0件の市場グループも見出しを表示し「本日の該当記事なし」を出す（3セクション常時表示、レイアウト毎日一定）。※キュレーション全体が正常0件（空配列）の場合は「本日は厳選記事なし」の全体グレースフル表示（Phase 15 D-05を踏襲）。
- D-07: グループ内の記事順は importance enum（high→medium→low）の安定ソート（Phase 15 D-06のバッジ階層→配列順ソートを踏襲）。

**バッジ・タグ・アクセント色**
- D-08: 重要度バッジの配色: High=赤(#ef4444) / Medium=アンバー(#f59e0b) / Low=グレー(#6b7280)。既存 `decisionColor()` と同系パレット。
- D-09: ティッカー+会社名タグはプレーンテキストのピル形タグ（リンクなし）。外部リンクは見出しに集約し誤タップを防ぐ。
- D-10: news-digest のアクセントカラーはパープル #8b5cf6。`report-utils.ts` の `ACCENT_VARIANTS` に light/lighter バリアントを追加する（既存3色: 青・アンバー・緑と重複しない）。

**ナビとフォールバック表示**
- D-11: ページ内ナビゲーションは追加しない。既存3レポートと同じくindex.html経由のみ（UI-03の「同じナビゲーション」= 現状と同一の構造、の解釈で確定）。4レポート間ナビバーの新設は不採用。
- D-12: `NewsCuration` が null（キュレーション失敗）の場合も、既存テーマ付きの完全なHTMLページを生成し、本文に「本日のニュースキュレーションは生成できませんでした」を表示する。`generate-portfolio-report.ts` の null フォールバックと同パターン。空文字列返却・ファイル非生成方式は不採用。
- D-13: ページタイトルは既存慣例に合わせ英語「News Digest - YYYY-MM-DD」、ヘッダー内に日本語副題「AI厳選ニュースダイジェスト」を添える。

### Claude's Discretion
- グループ見出しの件数表示の有無、リード文（CURA-09「今日の市場を動かすもの」）ブロックの具体的な配置・装飾 — 既存レポートのセクションスタイルと整合させる形で判断（リード文はページ冒頭付近であること自体は要件）
- カード/メタ行の具体的なCSSクラス設計・フォントサイズ・レスポンシブブレークポイント（既存 `generateBaseStyles` の枠内で）
- テストfixtureの具体設計（正常系・null・空配列・0件グループ・社名欠落ティッカーをカバーすること）
- 社名フィールドの契約上の正確な形状（`{symbol, name?}` vs 並列配列）— 既存スキーマテストを壊さない加法的変更であること

### Deferred Ideas (OUT OF SCOPE)
- 既存3レポート（daily-report / meeting-minutes / portfolio-report）でもティッカーに会社名を併記する改善 — ユーザーの一般要望だが既存レポートの変更はPhase 16スコープ外。将来フェーズ / v2.5+ バックログ候補。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CURA-03 | 各記事に見出し・ソース名・公開時刻・元記事へのリンクが表示される | `CuratedArticle`実データ（title/source/publishedAt/url、Phase 15で解決済み）をそのまま描画。href生成の安全パターン（Common Pitfalls, Code Examples） |
| CURA-04 | 各記事に日本語の「なぜ重要か」解説コメント（1〜2文）が表示される | `article.commentary`（Phase 15でdrop-if-empty保証済み）を`escapeHtml()`経由で描画するだけ。追加ロジック不要 |
| CURA-06 | 各グループ内で記事が重要度順に配列される | `sortByImportance()`（安定ソート、Code Examples）— Phase 15契約の配列順はAgentの選定順のままであり、重要度順ソートはPhase 16の責務であることを確認済み |
| CURA-07 | 各記事に重要度バッジ（High/Medium/Low）が表示される（重要度順配列と同一のスコアから導出） | `article.importance` enumから`IMPORTANCE_ORDER`マップでソートキー・バッジ色を同一ソースから導出（Code Examples） |
| CURA-08 | 各記事に関連ティッカータグが表示される | `article.tickers`（Phase 15で pool ticker + Agent tickers 重複排除済み）をピル表示。会社名併記（D-04）は契約への加法的フィールド追加が必要（Common Pitfalls, Code Examples） |
| CURA-09 | ページ冒頭に「今日の市場を動かすもの」リード文が表示される | `article.leadIn`（Phase 15で既に契約化済み、空文字許容）をページ冒頭に描画 |
| UI-03 | news-digest.html が既存3レポートと同じダークテーマ・モバイル対応・ナビゲーションを備える | `generateBaseStyles()`再利用 + `ACCENT_VARIANTS`へパープル追加（Architecture Patterns）。ナビはD-11によりindex.html経由のみと確定、in-page nav実装なしを確認済み |
</phase_requirements>

## Summary

Phase 15が既に `NewsCuration`/`CuratedArticle` 型・`newsCurationSchema`系（`validateRawNewsCuration` + `resolveNewsCuration`）を実装・マージ済みであることをコードベース直接確認した（`git log`で15-01/15-02完了、`src/meeting/types.ts`/`schemas.ts`に反映済み）。Phase 16はこの確定済み契約を入力とする純粋なレンダリング作業であり、新規npmパッケージは一切不要、新規フォルダも不要。手本となる `generate-portfolio-report.ts`（132行）は「アクセントカラー付きスタイル生成 → null フォールバック分岐 → セクション別 format*Html 関数群 → トップレベル export 関数」という明確な構造を持ち、Phase 16はこれをそのまま踏襲すればよい。

技術的な核心は2点。(1) **フォールバック分岐が2値ではなく3値になる**: `curation === null`（キュレーションAgent自体が失敗）、`curation.articles.length === 0`（Agentは成功したが0件選定、Phase 15 D-05により正常な契約）、`curation.articles.length > 0`（通常描画、ただし記事0件の市場グループは個別に「本日の該当記事なし」を出す）。この3値分岐を正しく実装しないと、D-06の「0件市場グループでも見出し表示」という一定レイアウトの体験が壊れる。(2) **ティッカー会社名の契約拡張（D-04）は既存Phase 15テストを壊してはならない**。実際に `src/meeting/schemas.test.ts` を読んだ結果、`tickers: ["AAPL"]`（プレーン文字列配列）を前提にしたアサーションが複数箇所（fixture定義、`toEqual(["AAPL"])`等）に存在することを確認した。したがって `tickers` フィールドの型自体を `{symbol, name?}[]` に変更する案は既存テストを直接壊す。安全な設計は `tickers: ReadonlyArray<string>` を変更せず、並列の追加フィールド（例: `tickerNames?: Readonly<Record<string,string>>`、symbol→会社名の任意マップ）を新設し、zodスキーマ側も `.optional().default({})` で加法的に追加することである。これは `resolveNewsCuration` の passthrough+デフォルト補完パターン（D-09踏襲）とも自然に整合する。

もう一つの新規リスクは「このコードベース初めてのLLM由来コンテンツに基づく `<a href>` 描画」である。既存3レポートは`keyArticles`を含め一切hrefを描画しない（`escapeHtml(title)`/`escapeHtml(summary)`のプレーンテキストのみ）。news-digestの見出しリンクはPhase 15のID解決により hrefはTS側の`tmp/news.json`プール由来（LLM非エコー）であることが既に保証されているため、Pitfall 2（幻覚URL）はPhase 15で構造的に解決済み。Phase 16が新たに担うのは「hrefも含めた全補間箇所への`escapeHtml()`適用」と「target="_blank"を使う際の`rel="noopener noreferrer"`付与（reverse tabnabbing対策、既存コードベースに前例なし・業界標準プラクティス）」である。

**Primary recommendation:** `generate-news-digest.ts` を `generatePortfolioReportHtml` と同一の構造（アクセントカラー`generateBaseStyles("#8b5cf6")` → null分岐 → 空配列分岐 → 市場別3セクション常時生成 → 各セクション内 importance安定ソート）で実装し、`report-utils.ts`のACCENT_VARIANTSにパープル（#8b5cf6 / light #a78bfa / lighter #c4b5fd、Tailwind violet-500/400/300のデフォルト値と一致 [CITED: tailwindcss.com/docs/colors]）を追加する。ティッカー会社名は `meeting/types.ts`/`schemas.ts` に加法的フィールド（`tickerNames`案を推奨）を追加し、Phase 15の既存テストが1件も壊れないことをテスト実行で確認する。

## Architectural Responsibility Map

このプロジェクトはブラウザ側JSを持たない静的サイト生成パイプライン（Node/TSバッチスクリプト → GitHub Pages配信）のため、標準的な4層（Browser/SSR/API/CDN）ではなく、実態に即したプロジェクト固有の層で整理する。

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTML文字列生成（記事カード・グルーピング・バッジ） | Static Site Generator（Node/TSピュア関数、`generate-news-digest.ts`） | — | 既存3レポートと同じ層。I/Oなし、`(NewsCuration \| null) => string` |
| 共有スタイル・エスケープ | Static Site Generator（`report-utils.ts`共有ユーティリティ） | — | 4レポート共通の横断的関心事、変更は加法的（ACCENT_VARIANTS追加のみ） |
| ティッカー会社名フィールドの契約 | Data Contract（`meeting/types.ts`/`schemas.ts`） | Static Site Generator（レンダラー側のフォールバック表示ロジック） | 契約はPhase 16で完結させる（CONTEXT.md明記）が、実際のAgent出力・値の充填はPhase 17スコープ |
| 生成物の配信 | CDN/Static（GitHub Pages `docs/{date}/news-digest.html`） | — | 書き出し・デプロイ配線はPhase 17スコープ外（本フェーズは文字列を返すのみ） |
| パイプライン統合・fail-soft分離 | — | Pipeline Orchestration（`generate-report.ts`, Phase 17） | 本フェーズのスコープ外。ただし関数シグネチャ（`(NewsCuration \| null) => string`）はPhase 17の呼び出し契約を先取りして確定する |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5.9.3 [VERIFIED: package.json] | 型付きピュア関数の実装 | プロジェクト全体で唯一の言語。新規導入なし |
| zod | ^4.3.6（実インストール4.3.6, node_modules確認済み）[VERIFIED: `node -e "require('./node_modules/zod/package.json').version"` 実行結果] | `CuratedArticle`/`NewsCuration`契約バリデーション拡張（ticker名フィールド追加） | Phase 15で既に採用済み、`z.record(z.string(), z.string())`が動作することをローカル実行で確認済み（two-arg形式必須、zod v4の破壊的変更点） |
| vitest | ^4.0.18 [VERIFIED: `npx vitest --version`実行結果] | `generate-news-digest.test.ts`のTDD | プロジェクト唯一のテストランナー、config不要（デフォルト動作） |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| （なし） | — | — | 本フェーズは新規パッケージ0件。既存 `report-utils.ts`（escapeHtml, generateBaseStyles）を再利用するのみ |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ネイティブテンプレートリテラルによる文字列生成 | Handlebars/EJS等のテンプレートエンジン | 既存3レポート全てがネイティブテンプレートリテラルのみで実装済み（依存追加なし）。research/SUMMARY.mdでも新規テンプレートエンジン導入は明示的に却下されている。採用しない |
| `tickerNames?: Record<string,string>`（加法的フィールド） | `tickers`フィールド自体を`{symbol, name?}[]`に変更 | 後者は`schemas.test.ts`の既存アサーション（`tickers: ["AAPL"]`形式のfixtureと`toEqual(["AAPL"])`アサーション）を直接壊す。前者はゼロ破壊的変更 |

**Installation:**
```bash
# 新規インストール不要。既存 node_modules をそのまま使用
```

**Version verification:** 上記の通り、zod/vitestともに実際にコマンド実行して確認済み（`npm view`ではなくローカルインストール状態を直接検証 — 新規パッケージ追加がないフェーズのため`npm view`によるレジストリ確認は該当なし）。

## Package Legitimacy Audit

このフェーズは新規外部パッケージを一切インストールしない（既存 `zod`/`vitest`/`typescript` の再利用のみ）。Package Legitimacy Gateの対象パッケージなし。

**Packages removed due to slopcheck [SLOP] verdict:** none（対象パッケージなし）
**Packages flagged as suspicious [SUS]:** none（対象パッケージなし）

## Architecture Patterns

### System Architecture Diagram

```
tmp/news.json ──(Phase 15, 既存)──▶ [News Curation Agent] ──▶ tmp/news-curation.json
                                                                       │
                                                    (Phase 17スコープ・本フェーズ対象外)
                                                                       │
                                                                       ▼
                                          validateRawNewsCuration() + resolveNewsCuration()
                                          (Phase 15で実装済み・本フェーズは呼び出し側)
                                                                       │
                                                                       ▼
                                                        NewsCuration | null
                                                                       │
                              ┌────────────────────────────────────────┴───────────────────────┐
                              │                  generateNewsDigestHtml() 【本フェーズの実装対象】 │
                              │                                                                  │
                              │  分岐1: curation === null                                        │
                              │    → 完全なHTMLシェル + 「生成できませんでした」(D-12)             │
                              │                                                                  │
                              │  分岐2: curation.articles.length === 0                           │
                              │    → 完全なHTMLシェル + 「本日は厳選記事なし」(D-06後半)           │
                              │                                                                  │
                              │  分岐3: curation.articles.length > 0                             │
                              │    → leadIn描画(CURA-09)                                          │
                              │    → groupByMarket() [us→japan→global固定順, D-05]               │
                              │    → 各グループ: sortByImportance() [高→中→低安定ソート, D-07]     │
                              │    → 0件グループも見出し+「本日の該当記事なし」を出す(D-06前半)     │
                              │    → 各記事: バッジ+見出しリンク+メタ行+コメント+ティッカー         │
                              │      (CURA-03/04/06/07/08, D-01〜D-04)                            │
                              └──────────────────────────────────┬───────────────────────────────┘
                                                                   │
                                                                   ▼
                                                        HTML文字列（戻り値のみ、I/Oなし）
                                                                   │
                                                    (Phase 17スコープ: writeFile → docs/{date}/news-digest.html)
```

### Recommended Project Structure

```
src/
├── meeting/
│   ├── types.ts             # MODIFIED: CuratedArticleにtickerNames?フィールド追加（加法的）
│   └── schemas.ts           # MODIFIED: curatedArticleRawSchemaにtickerNames追加、resolveNewsCurationで透過
├── scripts/
│   ├── generate-news-digest.ts       # NEW: generateNewsDigestHtml(curation: NewsCuration | null): string
│   ├── generate-news-digest.test.ts  # NEW: fixtureはtest内インラインオブジェクト（Phase 15の慣例踏襲）
│   └── report-utils.ts               # MODIFIED: ACCENT_VARIANTSに"#8b5cf6"エントリ追加
```

新規フォルダは不要。`generate-report.ts`（オーケストレーション統合）と`docs/{date}/news-digest.html`への書き出しはPhase 17スコープであり、本フェーズは変更しない。

### Pattern 1: 3値フォールバック分岐（null / 空配列 / 通常）

**What:** `generatePortfolioReportHtml`の2値分岐（`portfolioAnalysis === null` / 通常）を、Phase 15契約が持つ「null」と「正常0件」の意味論的区別（Phase 15 D-05）に合わせて3値に拡張する。
**When to use:** `generateNewsDigestHtml`の最上位分岐として必須。
**Example:**
```typescript
// Source: generate-portfolio-report.ts の null 分岐パターンを拡張（本フェーズの推奨実装）
export function generateNewsDigestHtml(curation: NewsCuration | null): string {
  const styles = generateBaseStyles("#8b5cf6");
  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  if (curation === null) {
    return renderShell(styles, timestamp, /* date */ "unknown",
      `<div class="agent-card"><p>本日のニュースキュレーションは生成できませんでした。</p></div>`);
  }

  if (curation.articles.length === 0) {
    return renderShell(styles, timestamp, curation.date,
      `<div class="agent-card"><p>本日は厳選記事なし</p></div>`);
  }

  const bodyHtml = formatLeadInHtml(curation.leadIn) + formatMarketGroupsHtml(curation.articles);
  return renderShell(styles, timestamp, curation.date, bodyHtml);
}
```
※ `curation === null`時は`date`がないため、タイトルには`escapeHtml(result.date)`相当の値が存在しない点に注意 — `generatePortfolioReportHtml`は`MeetingResult`の`result.date`を別引数で受け取っているが、`NewsCuration | null`単独では null 時に日付情報がない。Phase 17呼び出し側が`meetingResult.date`のような外部日付を渡せるようシグネチャを`(curation: NewsCuration | null, date: string)`にするか検討が必要（Open Questions参照）。

### Pattern 2: 市場別グルーピング + 重要度安定ソート（固定順・0件グループも表示）

**What:** Architecture Pattern 3（v2.4全体研究）の「LLM側分類・TS側描画のみ」をそのまま踏襲。市場のenum値（`us`/`japan`/`global`）は英語小文字だが、表示ラベルは日本語（米国株/日本株/グローバル）にマッピングする。
**When to use:** CURA-06/CURA-07の実装。
**Example:**
```typescript
// Source: ARCHITECTURE.md Pattern 3 のコード例を本プロジェクトの実際のenum値（us/japan/global）に合わせて調整
const MARKET_ORDER: ReadonlyArray<{ value: CuratedArticle["market"]; label: string }> = [
  { value: "us", label: "米国株" },
  { value: "japan", label: "日本株" },
  { value: "global", label: "グローバル" },
]; // D-05: 固定順

const IMPORTANCE_ORDER: Record<CuratedArticle["importance"], number> = { high: 0, medium: 1, low: 2 };

function sortByImportance(articles: ReadonlyArray<CuratedArticle>): CuratedArticle[] {
  // Array.prototype.sort は ES2019 以降 安定ソートが仕様保証される（V8/Node全バージョンで安全）
  return [...articles].sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance]);
}

function formatMarketGroupsHtml(articles: ReadonlyArray<CuratedArticle>): string {
  return MARKET_ORDER.map(({ value, label }) => {
    const groupArticles = sortByImportance(articles.filter((a) => a.market === value));
    const bodyHtml = groupArticles.length === 0
      ? `<p class="agent-card">本日の該当記事なし</p>` // D-06: 0件でも見出しは常時表示
      : groupArticles.map(formatArticleCardHtml).join("\n");
    return `<h2>${escapeHtml(label)}</h2>\n${bodyHtml}`;
  }).join("\n");
}
```

### Pattern 3: 安全なhref描画（escapeHtml + target="_blank" + rel="noopener noreferrer"）

**What:** Phase 15でhrefは既にLLM非エコー（`resolveNewsCuration`がプールから解決済み）なのでPitfall 2（幻覚URL）は解消済みだが、Pitfall 5（HTML injection）はレンダリング側の責務として残る。加えて`target="_blank"`使用時は`rel="noopener noreferrer"`が業界標準のセキュリティプラクティス（reverse tabnabbing対策）。
**When to use:** CURA-03の見出しリンク実装（D-01）。
**Example:**
```typescript
// Source: report-utils.ts escapeHtml() 再利用 + D-01（見出し自体がリンク）+ 業界標準セキュリティプラクティス [ASSUMED: 既存コードベースに target="_blank" の前例なし、一般的Webセキュリティ慣行からの提案]
function formatArticleCardHtml(a: CuratedArticle): string {
  const badge = importanceBadgeHtml(a.importance);
  const timeJst = formatPublishedAtJst(a.publishedAt); // D-02: Date.now()不使用、a.publishedAt文字列から導出
  const tickersHtml = a.tickers.map((symbol) => {
    const name = a.tickerNames?.[symbol]; // D-04: 社名欠落時はシンボルのみにフォールバック
    const label = name ? `${symbol} ${name}` : symbol;
    return `<span class="ticker-pill">${escapeHtml(label)}</span>`;
  }).join("");

  return `<div class="agent-card news-card">
    <h4>${badge} <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a></h4>
    <p class="news-meta">${escapeHtml(a.source)} ・ ${escapeHtml(timeJst)} ・ ${tickersHtml}</p>
    <p>${escapeHtml(a.commentary)}</p>
  </div>`;
}
```

### Pattern 4: JST絶対時刻フォーマット（Date.now()不使用）

**What:** `publishedAt`はJSON往復後は必ずstring（Phase 15コメント確認済み）。`new Date(isoString)`でパースし、`Date.now()`は一切使わない。
**When to use:** D-02実装。
**Example:**
```typescript
// Source: 既存3レポートの new Date().toLocaleString("ja-JP", {timeZone:"Asia/Tokyo"}) パターンをpublishedAt文字列に適用し、
// ローカル実行で "7/2 15:30" 形式の出力を確認済み [VERIFIED: node -e 実行結果]
function formatPublishedAtJst(publishedAtIso: string): string {
  const d = new Date(publishedAtIso); // Date.now() は使わない — 静的HTML再生成時に値がズレるため(D-02)
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
```

### Anti-Patterns to Avoid

- **`tickers`フィールドの型を破壊的に変更する（`string[]` → `{symbol,name?}[]`）:** `src/meeting/schemas.test.ts`の既存フィクスチャ（`tickers: ["AAPL"]`）と複数のアサーション（`toEqual(["AAPL"])`, `toEqual(["AAPL","MSFT"])`）を直接破壊する。加法的フィールド（`tickerNames`）を追加すること。
- **`Date.now()`や実行時刻に依存した相対時刻表示:** D-02で明示的に不採用。静的HTMLは何日後に開いても同じ内容を表示すべき（アーカイブ整合性）。
- **重要度でグループそのものを再ソートする（記事順とグループ順を混同する）:** グループの並び順（米国株→日本株→グローバル）はD-05で固定。ソート対象は各グループ**内**の記事のみ（D-07）。
- **hrefにLLM出力の生文字列を直接使う:** Phase 15で既に`resolveNewsCuration`がプール解決済みだが、レンダラー側で誤って`raw`（バリデーション前）オブジェクトを参照するとPitfall 2が再発する。必ず`CuratedArticle`（Phase 15の解決済み型）のみを入力に使う。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTMLエスケープ | 独自の`escapeHtml`実装や正規表現置換の再実装 | `report-utils.ts`の`escapeHtml()`をそのままimport | 既存4レポート全てで使われている唯一のエスケープ実装。href属性も含め全補間箇所で使用実績あり |
| ダークテーマCSS・レスポンシブ | news-digest専用の新規CSSファイル/`<style>`ブロック | `generateBaseStyles(accentColor)` | 既存3レポートと完全に同一のビジュアルアイデンティティを要求するUI-03の直接の実現手段。モバイル対応（768pxブレークポイント、44pxタップターゲット）も既に実装済み |
| 安定ソート | カスタムの安定ソートアルゴリズム | ネイティブ`Array.prototype.sort()` | ES2019以降、V8/Nodeで安定ソートが仕様保証されている。カスタム実装は不要かつバグの温床 |
| 市場enum→日本語ラベル変換 | switch文の重複実装を各所に書く | `MARKET_ORDER`の単一定義済みマッピング配列 | DRY。ラベル変更が1箇所で完結する |

**Key insight:** このフェーズはほぼ全てのビルディングブロックが既存コードベースに存在する。新規実装が必要なのは「市場別グルーピング」「重要度バッジのenum→色マッピング」「JST絶対時刻フォーマット」「ティッカー会社名フォールバック表示」の4つのみで、いずれも20〜30行程度の純関数で完結する規模感（既存`generatePortfolioReportHtml`が132行全体であることからの類推）。

## Common Pitfalls

### Pitfall 1: `tickers`フィールドの破壊的変更によるPhase 15回帰

**What goes wrong:** D-04の「会社名併記」要求を素直に実装しようとすると、`tickers: string[]` を `tickers: {symbol: string; name?: string}[]` に変えたくなる。これは`src/meeting/schemas.test.ts`の既存アサーション（fixtureの`tickers: ["AAPL"]`、および`resolveNewsCuration`の「ticker マージ」テストの`toEqual(["AAPL","MSFT"])`）を直接破壊する。
**Why it happens:** 「会社名付きティッカー」という要求を型レベルで素直に表現すると構造変更が自然に見えるため。
**How to avoid:** `tickers: ReadonlyArray<string>`は変更せず、`tickerNames?: Readonly<Record<string,string>>`（symbol→会社名の任意マップ）を`CuratedArticle`に追加する。zodスキーマも`curatedArticleRawSchema`に`tickerNames: z.record(z.string(), z.string()).optional().default({})`を追加するのみ（`z.record`は2引数形式が必須、ローカル実行で動作確認済み）。`resolveNewsCuration`は`tickerNames`をそのまま透過する（プール側に会社名情報はないため合成は不要、Agent出力をそのまま通す）。
**Warning signs:** `npx vitest run src/meeting/schemas.test.ts`実行で既存テストが失敗する。

### Pitfall 2: null時とarticles=0件時のUI文言・分岐を混同する

**What goes wrong:** `curation === null`（Agentが完全に失敗した日）と`curation.articles.length === 0`（Agentは成功したが選定0件だった日、Phase 15 D-05で明示的に有効な契約）を同一のフォールバック文言・分岐で扱ってしまうと、障害調査時に「Agentが動いたのか動かなかったのか」が区別できなくなる（Phase 15の設計意図そのものを無意味化する）。
**Why it happens:** `generatePortfolioReportHtml`の既存パターンは2値分岐（null／通常）のみで、3値分岐の前例がコードベースに存在しない。
**How to avoid:** D-12の文言（「本日のニュースキュレーションは生成できませんでした」）はnull専用、D-06後半の文言（「本日は厳選記事なし」）は空配列専用として明確に分ける。テストで両ケースを別々にアサートする。
**Warning signs:** テストfixtureが「null」と「空配列」の両方を用意していない、またはHTML内の文言アサーションが一方しか検証していない。

### Pitfall 3: HTML injection — 見出しリンクのhref属性エスケープ漏れ（v2.4全体研究 Pitfall 5）

**What goes wrong:** 既存3レポートは`<a href>`を一度もLLM由来データで描画したことがない（`keyArticles`は`escapeHtml(title)`のプレーンテキストのみ）。news-digestの見出しリンクは本コードベース初の「LLM由来コンテンツに基づく`<a href>`描画」であり、href属性へのescapeHtml適用漏れがそのままXSSベクタになる（URLに含まれる`&`のエスケープ漏れ、または`"`によるベア属性エスケープ）。
**Why it happens:** タイトル・コメントのエスケープは慣れたパターンだが、href属性自体へのエスケープは新しい適用箇所であり見落としやすい。
**How to avoid:** `<a href="${escapeHtml(a.url)}">`のように、hrefも他の補間箇所と全く同じ規律で`escapeHtml()`を通す。Phase 15によりhrefの値自体はTS側解決済み（LLM非エコー）なので幻覚URLの心配はないが、エスケープは別問題として必須。
**Warning signs:** コードレビューで`generate-news-digest.ts`が`escapeHtml`をimportしていない、または`<a href="${...}">`が生文字列補間になっている。

### Pitfall 4: `target="_blank"`のtabnabbing対策漏れ

**What goes wrong:** `target="_blank"`のみで`rel="noopener noreferrer"`を付けないと、リンク先ページが`window.opener`経由で元ページ（news-digest.html）を操作できる（reverse tabnabbing）。既存コードベースに`target="_blank"`の前例が一つもないため、この対策が「既存パターンのコピー」では自動的に得られない。
**Why it happens:** 既存3レポートは外部リンクを一切持たないため、このセキュリティパターンを踏襲する既存コード片が存在しない。
**How to avoid:** `<a href="..." target="_blank" rel="noopener noreferrer">`を常にセットで使う。[ASSUMED: 一般的Webセキュリティ慣行、このプロジェクト固有の先例なし]
**Warning signs:** `target="_blank"`が単独で存在する箇所。

## Code Examples

Verified patterns from official sources / 既存コードベース直接確認済みパターン:

### アクセントカラー追加（report-utils.ts への加法的変更）
```typescript
// Source: report-utils.ts 実ファイル確認 + Tailwind CSS公式カラーパレット [CITED: tailwindcss.com/docs/colors]
const ACCENT_VARIANTS: Record<string, { light: string; lighter: string }> = {
  "#3b82f6": { light: "#60a5fa", lighter: "#93c5fd" },
  "#f59e0b": { light: "#fbbf24", lighter: "#fcd34d" },
  "#10b981": { light: "#34d399", lighter: "#6ee7b7" },
  "#8b5cf6": { light: "#a78bfa", lighter: "#c4b5fd" }, // NEW: news-digest用パープル(D-10)
};
```

### 重要度バッジの色（D-08準拠、decisionColor()と同系パレット）
```typescript
// Source: generate-portfolio-report.ts の decisionColor() パターンを踏襲
function importanceColor(importance: CuratedArticle["importance"]): string {
  switch (importance) {
    case "high": return "#ef4444";
    case "medium": return "#f59e0b";
    case "low": return "#6b7280";
  }
}

function importanceBadgeHtml(importance: CuratedArticle["importance"]): string {
  const labels: Record<CuratedArticle["importance"], string> = { high: "High", medium: "Medium", low: "Low" };
  return `<span style="color:${importanceColor(importance)};font-weight:bold;">${labels[importance]}</span>`;
}
```

### 加法的スキーマ変更（schemas.ts — 既存テストへの非破壊確認済み設計）
```typescript
// Source: 既存 curatedArticleRawSchema（Phase 15実装済み）への加法的差分のみ
const curatedArticleRawSchema = z
  .object({
    id: z.string().min(1),
    market: z.enum(["us", "japan", "global"]),
    importance: z.enum(["high", "medium", "low"]),
    commentary: z.string().optional().default(""),
    tickers: z.array(z.string()).optional().default([]),
    tickerNames: z.record(z.string(), z.string()).optional().default({}), // NEW (D-04, 加法的)
  })
  .passthrough();
// resolveNewsCuration() の CuratedArticle 組み立て箇所に tickerNames: item.tickerNames を追加するのみ。
// pool側に会社名情報はないため、mergeロジックの変更は不要（tickersのSet結合ロジックはそのまま）。
```

## State of the Art

このフェーズに「新旧アプローチの交代」に該当する事項はない（新規ドメインの初回実装であり、既存パターンの直接踏襲）。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `tickerNames?: Readonly<Record<string,string>>`が「加法的フィールド追加」としてD-04を満たす最適設計である（`{symbol,name?}[]`への変更ではなく） | Standard Stack, Common Pitfalls, Code Examples | 低リスク。CONTEXT.mdのClaude's Discretionで明示的にこの判断はplanner/executorに委ねられている。ただし本RESEARCH.mdの推奨と異なる設計をplannerが選ぶ場合、既存`schemas.test.ts`への影響を必ず再検証すること |
| A2 | `target="_blank"`使用時は`rel="noopener noreferrer"`を付与すべき | Architecture Patterns Pattern 3, Common Pitfalls Pitfall 4 | 低リスク（一般的Webセキュリティ慣行、追加コストなし）。ただしCONTEXT.mdのD-01には明記されていないため、plannerが省略する可能性がある |
| A3 | null時（`curation === null`）にも`date`を伴う完全なHTMLシェルを返すため、`generateNewsDigestHtml`のシグネチャに`date: string`引数を別途追加すべき | Architecture Patterns Pattern 1（脚注）, Open Questions | 中リスク。`generatePortfolioReportHtml(result: MeetingResult, portfolioAnalysis: PortfolioAnalysis | null)`は既に`MeetingResult`から日付を取得しているため前例と整合するが、`NewsCuration`単独設計だと未解決。Phase 17呼び出し規約にも影響するため、Phase 16内で確定させる必要がある |

**If this table is empty:** N/A — 上記3件が存在する。

## Open Questions (RESOLVED)

1. **RESOLVED: `generateNewsDigestHtml`のシグネチャに日付引数を追加すべきか** — 16-02-PLAN.mdで `generateNewsDigestHtml(curation: NewsCuration | null, date: string): string` を採用済み
   - What we know: `curation === null`時、`NewsCuration`型に`date`フィールドが存在しないため、HTMLシェルのタイトル（「News Digest - YYYY-MM-DD」, D-13）に使う日付情報がない。`generatePortfolioReportHtml`は`MeetingResult`という別の入力から日付を取得している。
   - What's unclear: news-digest.tsが`MeetingResult`全体を受け取るべきか（他レポートとの整合性重視）、それとも`date: string`単独の第2引数を追加すべきか（疎結合重視、Phase 17のnullフォールバック呼び出し規約とも整合しやすい）。
   - Recommendation: `generateNewsDigestHtml(curation: NewsCuration | null, date: string): string`という疎結合シグネチャを推奨。Phase 17側は既に`meetingResult.date`を保持しているため呼び出し側での引き渡しコストはゼロ。plannerがタスク分解時にこのシグネチャをテストの最初のケースとして明示すること。

2. **RESOLVED: `tickerNames`が空オブジェクト（Agent未対応時）の場合の表示** — 低リスク確定。16-02-PLAN.mdのテストfixtureに「tickerNames完全欠落」ケースを含めることで対応
   - What we know: Phase 17（Agentプロンプト改修）が完了するまで、`tickerNames`は実運用データとして常に空のまま届く可能性が高い（Phase 15で書かれた`resolveNewsCuration`は`item.tickerNames`をそのまま透過するのみで、生成はしない）。
   - What's unclear: 会社名が一切ない状態（全記事がシンボルのみ表示）でもD-09（ピル形タグ）のレイアウトとして違和感がないか。
   - Recommendation: テストfixtureに「tickerNames完全欠落」ケースを必ず含め、シンボルのみのレンダリングがD-09のレイアウト要件を満たすことを確認する。ビジュアル上の問題ではない（低リスク）ため、ブロッカーにはしない。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 実行ランタイム | ✓ | v24.3.0 [VERIFIED: `node --version`] | — |
| tsx | スクリプト直接実行（開発時） | ✓ | v4.21.0 [VERIFIED: `npx tsx --version`] | — |
| vitest | TDD | ✓ | v4.0.18 [VERIFIED: `npx vitest --version`実行 + `report-utils.test.ts`実行成功] | — |
| zod | スキーマ拡張 | ✓ | 4.3.6（インストール済み）[VERIFIED: node_modules直接確認 + `z.record(z.string(), z.string())`のローカル動作確認] | — |

**Missing dependencies with no fallback:** なし
**Missing dependencies with fallback:** なし（本フェーズは既存環境のみで完結する）

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | none — package.json の `"test": "vitest run"` によるデフォルト設定 |
| Quick run command | `npx vitest run src/scripts/generate-news-digest.test.ts` |
| Full suite command | `npm test`（`vitest run`、リポジトリ全体） |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CURA-03 | 見出し・ソース・時刻・元記事hrefが表示される（href/title/source/publishedAtがescapeHtml経由で描画される） | unit | `npx vitest run src/scripts/generate-news-digest.test.ts -t "見出し"` | ❌ Wave 0（新規ファイル） |
| CURA-04 | 日本語解説コメントが表示される | unit | `npx vitest run src/scripts/generate-news-digest.test.ts -t "解説コメント"` | ❌ Wave 0 |
| CURA-06 | グループ内が重要度順（high→medium→low）に配列される | unit | `npx vitest run src/scripts/generate-news-digest.test.ts -t "重要度順"` | ❌ Wave 0 |
| CURA-07 | High/Medium/Lowバッジが重要度と同一ソースから導出される | unit | `npx vitest run src/scripts/generate-news-digest.test.ts -t "バッジ"` | ❌ Wave 0 |
| CURA-08 | ティッカータグ（会社名フォールバック込み）が表示される | unit | `npx vitest run src/scripts/generate-news-digest.test.ts -t "ティッカー"` | ❌ Wave 0 |
| CURA-09 | リード文がページ冒頭付近に表示される | unit | `npx vitest run src/scripts/generate-news-digest.test.ts -t "リード文"` | ❌ Wave 0 |
| UI-03 | ダークテーマCSS・モバイル対応・null/空配列フォールバックが機能する | unit | `npx vitest run src/scripts/generate-news-digest.test.ts -t "フォールバック"` | ❌ Wave 0 |
| (回帰) | `tickerNames`加法的スキーマ変更がPhase 15既存テストを壊さない | unit（既存） | `npx vitest run src/meeting/schemas.test.ts` | ✓ 既存ファイル（新規アサーション追加のみ） |

### Sampling Rate
- **Per task commit:** `npx vitest run src/scripts/generate-news-digest.test.ts src/meeting/schemas.test.ts`
- **Per wave merge:** `npm test`（全体）
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/scripts/generate-news-digest.test.ts` — CURA-03/04/06/07/08/09, UI-03の全カバレッジ（正常系・null・空配列・0件グループ・社名欠落ティッカーの5ケース、CONTEXT.md Claude's Discretion欄で明記されたカバレッジ要件）
- [ ] Framework install: 不要（vitest既存導入済み）

*(既存の`src/meeting/schemas.test.ts`は新規アサーション追加のみで、フレームワークギャップはなし)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 単一ユーザー静的サイト、認証機構なし（プロジェクト既存方針） |
| V3 Session Management | no | 該当なし |
| V4 Access Control | no | 該当なし |
| V5 Input Validation | yes | `escapeHtml()`による全補間箇所のサニタイズ（title/source/commentary/url/tickerName全て）、zodによる契約構造検証（Phase 15で実装済み、本フェーズは`tickerNames`追加分のみ） |
| V6 Cryptography | no | 該当なし |

### Known Threat Patterns for {静的HTML生成 + LLM由来コンテンツ}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS（LLM生成コメント/タイトルに`<script>`等が混入し、そのままGitHub Pagesにデプロイされる） | Tampering | `escapeHtml()`を全補間箇所（href属性含む）に適用。Phase 15で`title`/`source`/`url`はプール由来（LLM非エコー）だが、`commentary`/`tickerNames`の値はLLM由来のため要エスケープ |
| Reverse Tabnabbing（`target="_blank"`のみでリンク先が`window.opener`を操作） | Tampering / Spoofing | `rel="noopener noreferrer"`を`target="_blank"`と常にセットで使用（Pitfall 4） |
| `javascript:`/`data:` スキームURL混入（Phase 15プール由来だが、RSS/Finnhubフィード自体にスキーム検証なし — v2.4 PITFALLS.md Pitfall 5で既に指摘済み） | Tampering | 防御的多層化として、レンダリング直前に`a.url.startsWith("http://") \|\| a.url.startsWith("https://")`のスキーム検証を追加し、非http(s)の場合はリンクなしのプレーンテキスト表示にフォールバックすることを推奨（Phase 15スコープでは未実装、Phase 16のレンダラー側で追加するのが最終防衛線として妥当） |

## Sources

### Primary (HIGH confidence)
- 直接コードベース確認: `/Users/arai/invest/src/meeting/types.ts`, `/Users/arai/invest/src/meeting/schemas.ts`, `/Users/arai/invest/src/meeting/schemas.test.ts`（Phase 15実装済みの実ファイル、`git log`でマージ済みを確認）
- `/Users/arai/invest/src/scripts/generate-portfolio-report.ts`, `/Users/arai/invest/src/scripts/report-utils.ts`, `/Users/arai/invest/src/scripts/report-utils.test.ts`, `/Users/arai/invest/src/scripts/report-data-loaders.ts`, `/Users/arai/invest/src/scripts/generate-report.ts` — レンダラー・共有ユーティリティ・オーケストレーションの実装パターン直接確認
- `/Users/arai/invest/src/scripts/update-index.ts` — `report-links`クラスがindex.html専用でありレポート個別HTMLにはページ内ナビが存在しないことの直接確認（D-11の裏付け）
- `/Users/arai/invest/.planning/codebase/CONVENTIONS.md` — 命名・型・イミュータビリティ規約
- ローカル実行検証: `node --version`（v24.3.0）, `npx tsx --version`（v4.21.0）, `npx vitest --version`（v4.0.18）, `node -e "require('zod').z.record(...)"`（two-arg形式動作確認）, `node -e "new Date(...).toLocaleString(...)"`（JST絶対時刻フォーマット出力確認）, `npx vitest run src/scripts/report-utils.test.ts`（既存テストのpass確認）

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md`, `.planning/research/PITFALLS.md`, `.planning/research/ARCHITECTURE.md`（v2.4全体研究、2026-07-02付、HIGH confidence記載だが本フェーズでは一部を直接コード確認により再検証・具体化したためMEDIUMに区分）
- `.planning/phases/15-curation-contract-schema/15-CONTEXT.md`, `15-RESEARCH.md` — 上流契約の決定根拠

### Tertiary (LOW confidence)
- Tailwind CSSカラーパレット（violet-300/400/500）— WebSearch経由で複数の第三者サイトが同一値を報告しているためCITEDに格上げ（tailwindcss.com公式ドキュメントも情報源として含まれる）

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 新規パッケージなし、既存バージョンは全てローカル実行で直接検証済み
- Architecture: HIGH — 既存`generate-portfolio-report.ts`の直接読解に基づく、3値フォールバック分岐という新規要素も既存パターンの自然な拡張
- Pitfalls: HIGH — v2.4全体PITFALLS.mdの該当箇所（Pitfall 5）＋本フェーズ固有の新規発見（tickers破壊的変更リスク、target="_blank"対策）を直接コードベース確認により具体化
- ティッカー会社名の契約設計（`tickerNames`案）: MEDIUM — 加法的である必要性は既存テストの直接確認により確定（HIGH）だが、具体的なフィールド形状自体はCONTEXT.mdでClaude's Discretionと明記されており、plannerによる別設計の余地が残る

**Research date:** 2026-07-02
**Valid until:** 2026-08-01（30日、安定したコードベース内の追加実装であり破壊的変化のリスクは低い）

---
*Phase: 16-Report Generator (HTML Rendering)*
*Research completed: 2026-07-02*
