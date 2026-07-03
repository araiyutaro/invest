# Phase 20: Holding-Card News Display - Research

**Researched:** 2026-07-03
**Domain:** 既存 TypeScript レポート生成パイプラインへの ID 参照ニュース解決・レンダリング機能追加（新規依存なし）
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**注:** ユーザーは本フェーズの実装判断を全面的に Claude に委任した（「全部おまかせします」）。以下は Claude が既存パターン・前フェーズ決定・リサーチ文書に基づいて確定した推奨決定。

#### カード内レイアウト
- **D-01:** ニュースは各カードの rationale（+ riskNote）の下に**常時表示のコンパクトリスト**として組み込む。折りたたみ（`<details>`）は不採用 — 最大5件なら常時表示で一覧性が高く、印刷・スクリーンショットでも情報が失われない
- **D-02:** サブセクションは小さな見出し（例:「関連ニュース」）+ 箇条書きリスト。**テーブルは不採用**（LLM生成の長文と相性が悪い既存知見を踏襲。ここは決定論的データだが、モバイル表示と統一感のためリストを維持）
- **D-03:** リンクはダークテーマ用の**明示的な淡色指定**（#93c5fd / visited #c4b5fd — 過去フィードバックの踏襲）。`target="_blank" rel="noopener noreferrer"` で外部遷移

#### 表示件数と並び順
- **D-04:** `holding-news.json` の全エントリ（最大5件）を**そのまま全件表示**。別の絞り込みは行わない — Phase 19 D-09 の透明性原則「カードに見えているニュース = portfolio-analyst の判断に使われたニュース」を厳密に維持する
- **D-05:** 並び順は holding-news.json の**供給順を踏襲**（ticker一致優先 → 優先度スコア降順。Phase 19 D-10 の順序）。公開日時での並べ替えは行わない — 確実性の高いマッチが常に上位に見える

#### 各ニュースのメタ情報
- **D-06:** 各項目は **見出し（リンク）・ソース名・公開日時（JST、簡潔表示）** を表示。優先度スコアは内部値のため非表示
- **D-07:** **社名一致・エイリアス一致の記事にのみ**控えめなグレーのバッジ（例:「社名一致」）を付与。ticker一致は無印（デフォルト）。Phase 19 の deferred「社名フォールバックの実測誤マッチ監査」をレポート上で目視可能にする、ノイズ最小の設計

#### 空状態・欠損時の表現
- **D-08:** 0件銘柄も「関連ニュース」見出しは出し、その下にミュートグレーの1行「本日の関連ニュースなし」を表示。**セクション自体の省略は不採用** — 「ニュースがない」と「機能が壊れている」を閲覧者が区別できるようにする（PITFALLS.md の推奨に従う）
- **D-09:** `tmp/holding-news.json` が欠損・パース失敗の場合は**全銘柄0件と同じ扱い**でレポート生成を継続（fail-soft、console.error でログ）。レポート生成を throw で止めない
- **D-10:** ID照合で `tmp/news.json` に存在しないIDは**そのエントリのみスキップ**（ログ出力）。解決できたものだけ描画 — 幻覚URL防止の最終ガード。加えて、リゾルバーは記事IDがその銘柄のマッチ済みサブセットに属することを前提とし、銘柄間のID混入を検証テストでカバーする（PITFALLS.md 検証チェックリスト項目）

### Claude's Discretion
- リゾルバー関数の配置と命名（リサーチ SUMMARY.md は `resolvePortfolioHoldingNews()` を示唆。v2.4 の `resolveNewsCuration` パターン踏襲が自然）
- 「関連ニュース」見出しの正確な文言・フォントサイズ・余白等のスタイル詳細
- 公開日時のフォーマット（相対 or 絶対。既存レポートの表記と統一）
- generate-report.ts / report-data-loaders.ts への読み込み処理の組み込み方（既存の loadPortfolioAnalysis パターン踏襲が自然）
- ユニットテストの構成（既存の generate-report.test.ts / holding-news.test.ts の流儀に従う）

### Deferred Ideas (OUT OF SCOPE)
- 緊急度フラグ付きカードの視覚的強調・前日比較の変化バッジ（UI-07）— Phase 22
- ニュース・リサーチ内容への rationale の明示的言及（PORT-03）— Phase 22
- 「ニュースなし銘柄のカードの視覚的デエンファシス」（PITFALLS.md 提案）— Phase 22 の変化バッジ設計と合わせて検討する方が一貫する。本フェーズは空状態の明示のみ
- 社名フォールバックの実測誤マッチ率の集計監査 — D-07 のバッジで目視は可能になる。定量集計はマイルストーン監査時
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-05 | 各保有銘柄カードに判断根拠となった関連ニュース（見出し・ソース名・元記事リンク）を表示。リンクはID参照方式（TS側でtmp/news.jsonと照合解決）で幻覚URLを構造的に防止し、銘柄あたり3〜5件に上限を設ける | `resolvePortfolioHoldingNews()` 設計（Architecture Patterns / Code Examples）、`HoldingNewsFile` は既にPhase 19で1銘柄あたり最大5件にキャップ済み（D-04で追加の絞り込み不要）、`resolveNewsCuration` のID照合前例の転用 |
| UI-06 | 関連ニュースが0件の保有銘柄も通常のカードとして正常に描画される（エラー・空セクション崩れなし） | 空状態レンダリング設計（`formatHoldingNewsSectionHtml` の0件分岐）、fail-soft ローダー設計（D-09）、Common Pitfalls #1/#2、Validation Architecture の空状態テストケース |
</phase_requirements>

## Summary

本フェーズは Phase 19 が `tmp/holding-news.json`（銘柄ごとの記事ID + マッチメタ情報、最大5件/銘柄）として既に確定・出力しているデータを、`tmp/news.json` の記事プールと照合解決し、`generate-portfolio-report.ts` の保有銘柄カードにレンダリングする「消費側」の実装である。新規ライブラリ・新規外部依存は一切不要であり、v2.4 news-digest 機能で実証済みの ID 参照解決パターン（`resolveNewsCuration` in `src/meeting/schemas.ts`）を、キー軸を「記事ID群」から「銘柄シンボル」に変えて再利用する形になる。決定的な違いは、news-curation.json が LLM 生成物（zod の raw スキーマ検証必須）であるのに対し、holding-news.json と news.json はいずれも本プロジェクトの TS コードが自ら書き出した内部データであり、`write-news-digest.ts` が `tmp/news.json` を読む際に採用している「シンプルな型アサーション + try/catch」パターンがそのまま踏襲できる点にある。

実装は3つの独立した層に分解できる: (1) `src/portfolio/holding-news.ts` への `resolvePortfolioHoldingNews()` 純粋関数追加（HoldingNewsFile + 記事プール → 銘柄別解決済みニュース配列。ID未検出はログしてスキップ、既存の `HoldingNewsEntry`/`HoldingNewsMatchType` 型をそのまま再利用）、(2) `report-data-loaders.ts` への `loadHoldingNews()` / `loadNewsPool()` の追加（`loadPortfolioAnalysis()` と同じ fail-soft try/catch シェイプだが、LLM出力ではないため zod は不要）、(3) `generate-portfolio-report.ts` の `formatHoldingEvaluationsHtml()` 拡張とレンダリング用ヘルパー追加（既存 `generate-news-digest.ts` の `safeHref`/日時フォーマットロジックを report-utils.ts に汎化・再利用）。`generatePortfolioReportHtml()` のシグネチャ変更は、`generate-daily-report.ts` が `marketData` 引数を追加した際に採用した「デフォルト値付き追加引数で後方互換を保つ」パターン（Test 35 で検証済み）を踏襲することで、既存テストを壊さずに進められる。

**Primary recommendation:** `resolvePortfolioHoldingNews()` は `src/portfolio/holding-news.ts` に配置し（型の凝集性を優先、news-digest の schemas.ts 配置とは異なる判断だが根拠は Architecture Patterns 参照）、`generatePortfolioReportHtml` の第3引数に `resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> = {}` をデフォルト値付きで追加し、`formatHoldingEvaluationsHtml` 内で銘柄ごとに `resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)] ?? []` を参照して常時「関連ニュース」見出し + リストまたは空状態文言を描画する（キー正規化については Open Questions Q2 RESOLVED を参照）。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| holding-news.json ↔ news.json のID照合解決 | Backend (TS, ビルド時静的生成スクリプト) | — | 幻覚URL防止の根幹。LLM(portfolio-analyst)や描画層を一切信用せず、決定論的なTSコードのみが記事本体を確定させる（news-curator/resolveNewsCurationと同一の設計原理） |
| 保有銘柄カードHTML生成（ニュースサブセクション含む） | Backend (TS, 静的HTML生成: generate-portfolio-report.ts) | — | このプロジェクトはSSR/CSRを持たない「日次バッチが静的HTMLをdocs/へ書き出す」構成。動的ブラウザ側処理は一切ない |
| tmp/*.json ファイル読み込み・fail-soft処理 | Backend (report-data-loaders.ts) | — | 既存の全ローダーがこの層に集約されており、一貫性のため踏襲 |
| リンク先の実URL確定 | Backend (TS resolver) | Static HTML (レンダー時にhrefへ埋め込み) | URLはブラウザ側では一切生成されない。TSが確定した文字列をエスケープしてHTML属性に埋め込むのみ |
| ダークテーマの配色・レイアウト | CDN/Static (生成済みHTML内の`<style>`、docs/経由でGitHub Pages配信) | — | ビルド時にgenerateBaseStyles()でCSSが埋め込まれ、以降は静的配信のみ |

## Standard Stack

### Core

本フェーズは既存スタックの拡張のみで完結し、新規ライブラリ・新規パッケージのインストールは一切発生しない。

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.3.6（インストール済み） | 既存スキーマ検証基盤。本フェーズでは**新規スキーマ追加は不要**（holding-news.json/news.jsonは自社TS生成物のため） | 既にproject全体の唯一の検証ライブラリ。新規追加なし |
| vitest | ^4.0.18（インストール済み） | 既存テストフレームワーク。本フェーズのユニット・統合テストもこれを使う | 既存206テストが全てvitest、追加インストール不要 |
| Node.js組み込み `node:fs/promises` | Node標準 | tmp/holding-news.json / tmp/news.json の読み込み | 既存の全ローダーが同じAPIを使用 |

### Supporting

なし。既存の `escapeHtml` / `generateBaseStyles` / `calculatePriorityScore` / `assignArticleIds` を再利用するのみで、新規サポートライブラリは不要。

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| holding-news.json/news.jsonの型アサーション読み込み（write-news-digest.ts前例踏襲） | zod raw schema + passthrough（news-curationと同じ厳格検証） | LLM出力ではなく自社TS生成物であるため過剰検証。Pitfall 8（フィールド名invention）はLLM出力にのみ該当し、本フェーズのデータには当てはまらない。ただし将来Phase 19のholding-news.ts出力形状が変わった場合の回帰検知力は型アサーションの方が弱い点は認識しておく |
| `<details>`折りたたみでニュースを隠す | 常時表示リスト（D-01で確定） | ユーザー決定により不採用。折りたたみは印刷・スクリーンショット時に情報欠落するため |

**Installation:**
```bash
# 本フェーズでのインストールコマンドはなし（既存依存のみ使用）
```

**Version verification:** 新規パッケージなしのため `npm view` 等によるバージョン確認は不要。既存の `package.json` に記載の zod ^4.3.6 / vitest ^4.0.18 がそのまま使われることを `package.json` から確認済み `[VERIFIED: package.json]`。

## Package Legitimacy Audit

> 本フェーズは外部パッケージを一切インストールしないため、Package Legitimacy Gate は対象外。

**Packages removed due to slopcheck [SLOP] verdict:** none（対象パッケージなし）
**Packages flagged as suspicious [SUS]:** none（対象パッケージなし）

## Architecture Patterns

### System Architecture Diagram

```
[collect-data.ts] (Phase 19, 変更なし)
   │  news.json (記事プール, id: n01..)
   │  holding-news.json (銘柄別 {id, matchType, score}[], 全12銘柄キー保証)
   ▼
[report-data-loaders.ts] ── NEW: loadNewsPool() / loadHoldingNews()
   │  fail-soft: 読込/パース失敗時 → newsPool=[] / holdingNews={} (D-09)
   ▼
[holding-news.ts] ── NEW: resolvePortfolioHoldingNews(holdingNews, newsPool)
   │  1. holdingNews の各 symbol キーをループ
   │  2. 各 {id, matchType} を newsPool から Map<id,article> でO(1)照合
   │  3. 見つからないIDは console.warn + スキップ（D-10 幻覚防止の最終ガード）
   │  4. 見つかった記事から {id, title, source, url, publishedAt, matchType} を合成
   │     （score は破棄 — D-06 内部値のため非表示）
   │  5. 結果キーは normalizeHoldingSymbol(symbol) で正規化（Q2 RESOLVED）
   ▼  Record<normalizedSymbol, ResolvedHoldingNewsItem[]>
[generate-report.ts:101 Promise.all] ── EXTEND: 2ファイル追加読込 + resolve呼び出し
   ▼
[generate-portfolio-report.ts]
   │  generatePortfolioReportHtml(result, portfolioAnalysis, resolvedHoldingNews = {})
   │  formatHoldingEvaluationsHtml(holdings, resolvedHoldingNews)
   │    各 holding について resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)] ?? [] を取得
   │    ├─ 0件 → 「関連ニュース」見出し + ミュートグレー「本日の関連ニュースなし」(D-08)
   │    └─ 1-5件 → 「関連ニュース」見出し + <ul> (見出しリンク/ソース/JST日時/社名一致バッジ) (D-01,D-02,D-06,D-07)
   ▼
docs/YYYY-MM-DD/portfolio-report.html （静的HTML、GitHub Pagesへ配信）
```

**入力データの流れが追跡可能な理由:** カードに見えるニュース ID は必ず (a) Phase 19 の holding-news.json に銘柄別に列挙され、(b) resolvePortfolioHoldingNews が news.json プールに存在するIDのみ解決し、(c) 存在しないIDは描画前に破棄される。この3段の透明なチェーンにより「カードに見えているニュース = portfolio-analystの判断に使われたニュース」（Phase 19 D-09）が構造的に保証される。

### Recommended Project Structure

```
src/
├── portfolio/
│   ├── holding-news.ts        # 既存(Phase 19) + NEW: resolvePortfolioHoldingNews(), normalizeHoldingSymbol(), ResolvedHoldingNewsItem型
│   ├── holding-news.test.ts   # 既存 + NEW: resolver向けdescribeブロック追加
│   └── holdings.ts            # 変更なし（PORTFOLIO_HOLDINGS）
├── data/news/
│   └── article-id.ts          # 変更なし（NewsArticleWithId型は本フェーズでは直接使わない。プール読込はNewsArticlePoolEntry形状で十分）
├── meeting/
│   └── schemas.ts             # 変更なし（NewsArticlePoolEntry型を読込側でimport再利用するのみ、新規スキーマ追加なし）
└── scripts/
    ├── report-data-loaders.ts # EXTEND: loadNewsPool(), loadHoldingNews() 追加
    ├── report-utils.ts        # EXTEND: safeHref()・formatPublishedAtJst() をgenerate-news-digest.tsから汎化・移設（Don't Hand-Roll参照）
    ├── generate-news-digest.ts # MODIFY: 移設したヘルパーをimportに変更（挙動不変）
    ├── generate-portfolio-report.ts # MODIFY: formatHoldingEvaluationsHtml拡張 + generatePortfolioReportHtml第3引数追加
    ├── generate-report.ts     # MODIFY: Promise.allにloadNewsPool/loadHoldingNews追加、resolve呼び出し
    └── generate-report.test.ts # EXTEND: Portfolio Report describeブロックに UI-05/UI-06 テスト追加
```

### Pattern 1: ID参照解決（Deterministic Attachment, LLM自己申告を信用しない）

**What:** LLM/エージェントの成果物には記事IDのみを含ませ、URL・見出し・ソース名は必ずTS側が信頼できるプールから解決する。
**When to use:** 幻覚URLのリスクがある箇所全て（本フェーズはさらに一段安全: holding-news.json自体もLLMではなくTSコード(collect-data.ts)が生成しているため、二重に安全）。
**Example:**
```typescript
// Source: src/meeting/schemas.ts resolveNewsCuration (v2.4 news-digest, 稼働中の前例)
export function resolveNewsCuration(
  raw: RawNewsCuration,
  pool: ReadonlyArray<NewsArticlePoolEntry>,
  date: string,
  generatedAt: string,
): NewsCuration {
  const poolById = new Map(pool.map((a) => [a.id, a]));
  // ... 未知IDは console.warn + drop、重複IDも drop
}
```
本フェーズはこのパターンを保有銘柄軸（symbol）にそのまま適用する:
```typescript
// NEW: src/portfolio/holding-news.ts
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";

export interface ResolvedHoldingNewsItem {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly url: string;
  readonly publishedAt: string; // JSON往復後は必ずstring (Pitfall 3と同じ注意)
  readonly matchType: HoldingNewsMatchType;
}

/** 銘柄シンボル正規化の単一情報源（Q2 RESOLVED）。リゾルバーのキー生成と参照側が同一関数を共有し表記揺れによるキー不一致を排除する。 */
export function normalizeHoldingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * holding-news.json（銘柄別ID参照）を news.json プールと照合し、
 * 描画に必要な全フィールドを解決する。存在しないIDはそのエントリのみdropし、
 * console.warnでログする（D-10）。いかなる入力でもthrowしない。
 * 結果マップのキーは normalizeHoldingSymbol で正規化する（Q2 RESOLVED）。
 */
export function resolvePortfolioHoldingNews(
  holdingNews: HoldingNewsFile,
  pool: ReadonlyArray<NewsArticlePoolEntry>,
): Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> {
  const poolById = new Map(pool.map((a) => [a.id, a]));
  const result: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> = {};

  for (const [symbol, entries] of Object.entries(holdingNews)) {
    const resolved: ResolvedHoldingNewsItem[] = [];
    for (const entry of entries) {
      const article = poolById.get(entry.id);
      if (!article) {
        console.warn(`[holding-news] 不明な記事IDをdrop: ${entry.id} (symbol=${symbol})`);
        continue;
      }
      resolved.push({
        id: entry.id,
        title: article.title,
        source: article.source,
        url: article.url,
        publishedAt: article.publishedAt,
        matchType: entry.matchType,
      });
    }
    result[normalizeHoldingSymbol(symbol)] = resolved;
  }
  return result;
}
```

**なぜ `schemas.ts` ではなく `holding-news.ts` に置くか:** `resolveNewsCuration` が schemas.ts にあるのは、raw（LLM出力）のzod検証と解決処理が1ファイルで密結合しているため。本フェーズのholding-news.jsonは自社TS生成物でzod raw検証が不要なため、その密結合の理由が存在しない。一方 `HoldingNewsFile`/`HoldingNewsEntry`/`HoldingNewsMatchType` という関連型は既に holding-news.ts に定義済みであり、解決関数もこのドメインモジュールに置くほうが型の凝集性が高い。→ Open Questions Q1 で RESOLVED（holding-news.ts 配置に確定）。

### Pattern 2: fail-softローダー（自社生成JSON向け・zodなし簡易版）

**What:** LLM生成物ではない自社生成tmp/*.jsonの読込は、write-news-digest.tsのnews.json読込と同じ「型アサーション＋try/catch」で十分。
**When to use:** 書き込み元が同一コードベースのTSであり、フィールド名invention（Pitfall 8）のリスクがない場合。
**Example:**
```typescript
// Source: src/scripts/write-news-digest.ts:23-24 (既存・稼働中)
const poolRaw = await readFile(join(TMP_DIR, "news.json"), "utf-8");
const pool = JSON.parse(poolRaw) as ReadonlyArray<NewsArticlePoolEntry>;
```
本フェーズの report-data-loaders.ts への追加はこの前例をそのまま踏襲する:
```typescript
// NEW: src/scripts/report-data-loaders.ts
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";
import type { HoldingNewsFile } from "../portfolio/holding-news.js";

export async function loadNewsPool(): Promise<ReadonlyArray<NewsArticlePoolEntry>> {
  try {
    const raw = await readFile(join(TMP_DIR, "news.json"), "utf-8");
    return JSON.parse(raw) as ReadonlyArray<NewsArticlePoolEntry>;
  } catch (error) {
    console.error("News pool load failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

export async function loadHoldingNews(): Promise<HoldingNewsFile> {
  try {
    const raw = await readFile(join(TMP_DIR, "holding-news.json"), "utf-8");
    return JSON.parse(raw) as HoldingNewsFile;
  } catch (error) {
    console.error("Holding news load failed:", error instanceof Error ? error.message : error);
    return {}; // D-09: 欠損/パース失敗は全銘柄0件と同じ扱い
  }
}
```

### Pattern 3: 後方互換な引数追加（既存テストを壊さないシグネチャ拡張）

**What:** 関数シグネチャにデフォルト値付きの新規引数を追加し、既存の少数引数呼び出しをそのまま動かす。
**When to use:** 既存テストスイートが古いシグネチャで多数呼び出している関数を拡張する場合。
**Example:**
```typescript
// Source: src/scripts/generate-daily-report.ts のmarketData引数追加（Test 35で検証済みの前例）
export function generateDailyReportHtml(
  result: MeetingResult,
  webSearchResults: ReadonlyArray<WebSearchResult>,
  reevalResults: ReadonlyArray<ReevaluationOutput>,
  marketData: MarketData = { sectors: [], vixHistory: [] }, // 3引数呼び出しでも動く
): string { /* ... */ }
```
本フェーズは `generatePortfolioReportHtml` に同じパターンを適用する:
```typescript
export function generatePortfolioReportHtml(
  result: MeetingResult,
  portfolioAnalysis: PortfolioAnalysis | null,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> = {},
): string { /* ... */ }
```
これにより `generate-report.test.ts` の既存 Test 25-32（2引数呼び出し）は変更なしでパスし続ける。

### Anti-Patterns to Avoid
- **`formatHoldingEvaluationsHtml`内で直接`tmp/news.json`を読む:** レンダリング層とデータ読込層を混在させない。既存の全レポート生成関数は「データは引数で受け取り、副作用（ファイルI/O）を持たない」設計原則を守っている。
- **`resolvedHoldingNews`未指定時にセクションごと省略:** D-08で明示的に禁止。デフォルト値`{}`でも「関連ニュースなし」の空状態は必ず描画されなければならない。
- **`holding-news.json`のscoreフィールドをHTMLに埋め込む:** D-06で「優先度スコアは内部値のため非表示」と明記。ResolvedHoldingNewsItem型にscoreを含めないことで構造的に防止する。
- **safeHrefを経由しない生URL埋め込み:** news-digestで既に`javascript:`/`data:`スキーム対策として`safeHref`が実装済み。本フェーズも同じ関数を再利用し、独自のURL検証ロジックを再実装しない。
- **参照側で生の h.symbol をキーにする:** resolvedHoldingNews のキーは normalizeHoldingSymbol 済みのため、参照側も必ず normalizeHoldingSymbol(h.symbol) で引き当てる（Q2 RESOLVED）。生キー参照は表記揺れ時のサイレント0件を招く。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| ID→記事本体の解決（幻覚URL防止） | 独自のMap照合ロジックを一から書く | `resolveNewsCuration`の設計をそのまま`resolvePortfolioHoldingNews`に転用（Map<id,article>によるO(1)照合、未知IDはconsole.warn+drop） | 既に本番運用中のパターン。バグの温床になりやすい「重複ID処理」「未知ID処理」の判断が既に検証済み |
| 非http(s)スキームURLの防御（javascript:等） | 新規の正規表現/バリデーション | `generate-news-digest.ts`の`safeHref()`をreport-utils.tsへ移設して再利用 | reverse tabnabbing対策(T-16-02-03)は既に一度実装・検証済みのセキュリティロジック。重複実装はロジック不一致のリスクを生む |
| JST日時の簡潔フォーマット | 新規のDate整形関数 | `generate-news-digest.ts`の`formatPublishedAtJst()`をreport-utils.tsへ移設して再利用 | 既存レポート全体で日時表記を統一する（D-06 Claude's Discretion「既存レポートの表記と統一」に合致） |
| HTMLエスケープ | 独自のエスケープ関数 | 既存の`escapeHtml`（report-utils.ts） | プロジェクト全体で統一済みのXSS対策関数 |
| 優先度スコア計算 | 新規のスコアリングロジック | 既存の`calculatePriorityScore`（filter.ts）— ただしPhase 19で既に適用済みのため、本フェーズでは呼び出し不要（holding-news.json生成時に既に確定済み） | 二重計算・二重ソートは表示順の不整合を招く（D-05: 供給順をそのまま踏襲、再ソート禁止） |

**Key insight:** 本フェーズで「新規に作るべきロジック」は実質2つ（`resolvePortfolioHoldingNews`のID解決ループ + `normalizeHoldingSymbol` の軽量正規化）のみであり、それ以外は全て既存の稼働中コードの再利用・汎化で完結する。これは v2.5 リサーチ SUMMARY.md が結論づけた「この機能の全パーツに直接の稼働前例が存在する」という評価の具体的な現れである。

## Common Pitfalls

### Pitfall 1: 空状態を「セクション省略」で表現してしまう
**What goes wrong:** JS開発でありがちな `if (items.length === 0) return "";` を「関連ニュース」セクション全体に適用すると、日本株小型株カードだけニュースセクションがなくなり、レイアウトが不揃いになる、または「機能が壊れている」ように見える。
**Why it happens:** `formatRebalanceActionsHtml`や`formatNewCandidatesHtml`など、既存コードには「0件ならセクションごと空文字列を返す」パターンが複数存在し（`generate-portfolio-report.ts`内）、コピー元として誤って踏襲しやすい。
**How to avoid:** ニュースサブセクションだけは例外的に「見出しは常に描画 + 0件時は本文をミュートグレーの1行に差し替え」という2分岐にする（`generate-news-digest.ts`の`formatMarketGroupsHtml`が採用している「0件でも見出しは表示」パターンと同型 — この前例が既にコードベース内に存在する点は本フェーズにとって強い追い風）。
**Warning signs:** 日本株保有銘柄（8522.T, 5885.T, 5576.T, 7711.T）のカードだけ「関連ニュース」の文字列自体がHTMLに出現しない。

### Pitfall 2: `holding.symbol`と`resolvedHoldingNews`のキーの不一致
**What goes wrong:** `PortfolioAnalysis.holdings[].symbol`（例: "8522.T"）と`HoldingNewsFile`のキー（Phase 19で`PORTFOLIO_HOLDINGS`の`symbol`から生成、同じく"8522.T"）は本来同一のはずだが、portfolio-analystがLLM出力でsymbol表記を微妙に変える可能性（例: "8522" と "8522.T"の不一致、前後空白、大小文字）はゼロではない。
**Why it happens:** `HoldingEvaluation.symbol`はLLM(`portfolio-analyst`)が出力するフィールドであり、`portfolioAnalysisSchema`のpassthrough/transform層で正規化されていない（実コード確認済み: `rawHoldingSchema.symbol` は `z.string()` のみ、transform も `symbol: raw.symbol` で無変換 — schemas.ts:151,166）。
**How to avoid:** **Q2 RESOLVED の決定を適用する** — `normalizeHoldingSymbol(symbol)`（trim + toUpperCase）をリゾルバーのキー生成と参照側（`resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)] ?? []`）の**両方**に適用し、同一正規化でキー一致を構造的に保証する。`?? []`はキー不在時にD-08の空状態表示へ安全に合流するための最終フォールバック。
**Warning signs:** ライブラン時に、Finnhubの`ticker`一致が確認できているはずの銘柄（例:MRNA）のカードで「本日の関連ニュースなし」が表示される。

### Pitfall 3: `NewsArticleWithId`の`publishedAt`型の嘘（Date型 vs 実行時string）
**What goes wrong:** `NewsArticleWithId`は`RawNewsArticle`を継承し`publishedAt: Date`と型定義されているが、`tmp/news.json`をJSON経由で読み込んだ実行時の値は必ず`string`である。もし本フェーズのプール読込型に`NewsArticleWithId`を誤って使うと、`article.publishedAt.toLocaleString(...)`のようなDateメソッド呼び出しが実行時に`TypeError`を起こす。
**Why it happens:** `schemas.ts`は既にこの問題を認識して`NewsArticlePoolEntry`という「JSON往復後の実形状」を表す別インターフェース（`publishedAt: string`）を用意しているが、`article-id.ts`の`NewsArticleWithId`はそれを知らない（本来collect-data.tsのメモリ内処理用の型であり、JSON読込後の型として想定されていない）。
**How to avoid:** プール読込・解決関数の型は必ず`NewsArticlePoolEntry`（`schemas.ts`からimport）を使う。`NewsArticleWithId`は使わない。
**Warning signs:** `tsc --noEmit`は検出できない（構造的部分型のため）。実行時に日時フォーマット処理でクラッシュするか、`"Invalid Date"`文字列が描画される。

### Pitfall 4: `generatePortfolioReportHtml`のnullフォールバック分岐の整合性確認漏れ
**What goes wrong:** `portfolioAnalysis === null`の分岐（agent失敗時）では`holdingEvaluationsHtml`自体が生成されないため、ニュース関連の変更を加えてもこの分岐は影響を受けないはずだが、実装時に誤って`resolvedHoldingNews`を必須引数にしてしまうと、この分岐を呼び出す既存コード（`generate-report.ts`）でもニュース解決を待つ必要が生じ、依存関係が不必要に複雑化する。
**How to avoid:** `resolvedHoldingNews`はデフォルト値`{}`を持つ第3引数とし、`portfolioAnalysis === null`分岐では単に無視される（holdingsが存在しないためニュースを描画する対象自体がない）ことを確認するテストを1件追加する。
**Warning signs:** `generate-report.test.ts` Test 31（nullフォールバック）が3引数化後も無変更でパスすること。

### Pitfall 5: 銘柄間のID混入（cross-holding ID leakage）の未検証
**What goes wrong:** Phase 19 CONTEXT.md D-10で明示された懸念: 「リゾルバーは記事IDがその銘柄のマッチ済みサブセットに属することを前提とし、銘柄間のID混入を検証テストでカバーする」。実装ミスにより、もし`resolvePortfolioHoldingNews`が誤って「プール全体をticker一致で再フィルタする」ような実装になっていた場合（holdingNewsの構造を無視して独自にticker照合をやり直す誤り）、Phase 19が既に確定した「銘柄ごとの厳選済みサブセット」を無視し、意図しない記事が別銘柄のカードに漏れ出す可能性がある。
**Why it happens:** 「銘柄ごとにticker一致の記事を探す」という直感的な実装と「holdingNewsに列挙されたIDだけを解決する」という正しい実装が、テストなしでは見分けがつかない（同じ結果を返す入力データが用意されやすい）。
**How to avoid:** 実装は必ず`Object.entries(holdingNews)`のようにholdingNews側のキー・エントリを起点にループし、プール側から独立に再フィルタしないこと。テストでは「プールに記事Xが存在するが、holdingNewsではHII銘柄の下にのみ記事Xが列挙されている」という状況を作り、MRNA銘柄の解決結果に記事Xが含まれないことを明示的にアサートする。
**Warning signs:** レビュー時に`resolvePortfolioHoldingNews`の実装が`pool.filter(a => a.ticker === symbol)`のようなプール再フィルタを行っている場合は要注意（Phase 19のロジックを重複実装している兆候）。

## Code Examples

### 保有銘柄カードへのニュースサブセクション描画（推奨実装イメージ）
```typescript
// Source: 既存の generate-news-digest.ts の formatArticleCardHtml / formatMarketGroupsHtml パターンを
// 保有銘柄カードのコンテキストに適合させた設計案
import { escapeHtml, safeHref, formatPublishedAtJst } from "./report-utils.js"; // safeHref/formatPublishedAtJstは本フェーズでgenerate-news-digest.tsから移設
import { normalizeHoldingSymbol } from "../portfolio/holding-news.js";
import type { ResolvedHoldingNewsItem } from "../portfolio/holding-news.js";

function formatHoldingNewsItemHtml(item: ResolvedHoldingNewsItem): string {
  const href = safeHref(item.url);
  const titleHtml = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>`
    : escapeHtml(item.title);
  // D-07: name/alias一致にのみ控えめなグレーバッジ。ticker一致は無印
  const badge = item.matchType !== "ticker"
    ? ` <span style="color:#888;font-size:0.75rem;">社名一致</span>`
    : "";
  return `<li>${titleHtml}${badge}<br>
    <span class="news-meta">${escapeHtml(item.source)} ・ ${escapeHtml(formatPublishedAtJst(item.publishedAt))}</span>
  </li>`;
}

function formatHoldingNewsSectionHtml(items: ReadonlyArray<ResolvedHoldingNewsItem>): string {
  // D-08: 0件でも見出しは常に描画。セクション自体の省略は不採用
  if (items.length === 0) {
    return `<div class="news-card"><h5>関連ニュース</h5><p style="color:#888;font-size:0.85rem;">本日の関連ニュースなし</p></div>`;
  }
  const rows = items.map(formatHoldingNewsItemHtml).join("\n");
  // "news-card"クラスを付与し、既存CSSの ".news-card a { color:#93c5fd }" を再利用 (D-03)
  return `<div class="news-card"><h5>関連ニュース</h5><ul>${rows}</ul></div>`;
}
```

### 保有銘柄カード全体の統合（`formatHoldingEvaluationsHtml`拡張）
```typescript
// Source: src/scripts/generate-portfolio-report.ts の既存実装を拡張
function formatHoldingEvaluationsHtml(
  holdings: ReadonlyArray<HoldingEvaluation>,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>>,
): string {
  if (holdings.length === 0) return "";

  const cards = holdings.map((h) => {
    const color = decisionColor(h.decision);
    const riskHtml = h.riskNote
      ? `<p style="color:#f59e0b;font-size:0.85rem;">リスク: ${escapeHtml(h.riskNote)}</p>`
      : "";
    // Q2 RESOLVED / Pitfall2: 参照側も normalizeHoldingSymbol でキーを正規化しリゾルバー側とキー一致を保証
    const newsHtml = formatHoldingNewsSectionHtml(resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)] ?? []);
    return `<div class="agent-card" style="border-left-color:${color};">
      <h4>${escapeHtml(h.symbol)}${h.nameJa ? ` -- ${escapeHtml(h.nameJa)}` : ""} <span style="float:right;color:${color};font-weight:bold;">${escapeHtml(h.decision)}</span></h4>
      <p>${escapeHtml(h.rationale)}</p>
      ${riskHtml}
      ${newsHtml}
    </div>`;
  }).join("\n");

  return `<h2>保有銘柄 個別評価</h2>\n${cards}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| 保有銘柄カードにrationale/riskNoteのみ表示、ニュースなし | Phase 20でID解決済み関連ニュース（見出し/ソース/JST日時、最大5件）を常時表示 | 本フェーズ（v2.5） | UI-05/UI-06の要件を満たし、v1.0にあった「ニュースを踏まえた判断」の可視化を部分的に復元（rationaleへの明示的言及自体はPhase 22） |
| news-digest限定だったID参照解決パターン（`resolveNewsCuration`） | 保有銘柄軸にも同パターンを適用（`resolvePortfolioHoldingNews`） | 本フェーズ | 幻覚URL防止の設計原則がレポート全体で一貫適用される |

**Deprecated/outdated:** なし。既存パターンの水平展開のみで、破棄される旧実装はない。

## Assumptions Log

> 本リサーチはすべて直接のコードベース調査（Read）に基づいており、WebSearch由来の未検証な外部情報は使用していない。以下は「コード上に前例はあるが、プランナー/実装者が選択すべき設計判断」を明示するもので、事実誤認のリスクという意味での`[ASSUMED]`ではない。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | `resolvePortfolioHoldingNews()` を `schemas.ts` ではなく `holding-news.ts` に配置すべき、という判断は本リサーチの推奨であり、CONTEXT.mdの「Claude's Discretion」領域である（ユーザーによるロック済み決定ではない） | Architecture Patterns Pattern 1 | 低リスク。プランナーが `schemas.ts` 配置を選んでも実装ロジック自体は同一のため、フェーズの成否には影響しない。→ Q1 RESOLVED（holding-news.ts に確定） |
| A2 | `HoldingEvaluation.symbol` と `HoldingNewsFile` のキー（`PORTFOLIO_HOLDINGS`由来）が常に完全一致するという前提。実コード確認の結果 `portfolioAnalysisSchema` の symbol は無正規化（`z.string()` のみ、schemas.ts:151,166）で表記揺れリスクが残ることが判明 | Common Pitfalls #2 | **解消済み（Q2 RESOLVED）**。normalizeHoldingSymbol をリゾルバー側キー生成と参照側の両方に適用し、キー一致を構造的に保証する設計に確定。silent degradation リスクは軽減された |

**このテーブルが示す通り:** 本リサーチの技術的主張（型定義・関数シグネチャ・既存コードの挙動）はすべて直接のファイル読み取りにより`[VERIFIED: codebase]`である。ユーザー確認が必要だった A2（symbol 正規化）は Q2 RESOLVED として設計決定済み。

## Open Questions (RESOLVED)

1. **`resolvePortfolioHoldingNews()`の配置場所（`holding-news.ts` vs `schemas.ts`）**
   - What we know: 両モジュールとも技術的に配置可能。型的凝集性は`holding-news.ts`が優れる。v2.4前例の一貫性は`schemas.ts`が優れる
   - **RESOLVED:** `holding-news.ts` に配置する。関連型（HoldingNewsFile/HoldingNewsEntry/HoldingNewsMatchType）が同ファイルに定義済みで型的凝集性が高く、holding-news.json は自社TS生成物で zod raw 検証が不要なため schemas.ts の密結合理由が存在しない（Assumption A1 の第一候補を採用）。20-01 Task 1 / 20-02 Task 2 の import 元に反映済み

2. **`HoldingEvaluation.symbol`表記の正規化有無**
   - What we know: `portfolioAnalysisSchema`の該当箇所を実コード確認した結果、`rawHoldingSchema.symbol` は `z.string()` のみ（schemas.ts:151）、`holdingEvaluationSchema.transform` も `symbol: raw.symbol`（schemas.ts:166）で**正規化なし**。LLM(portfolio-analyst)出力の symbol は表記揺れ（"8522" vs "8522.T"、前後空白、大小文字）が起こり得る
   - **RESOLVED:** 銘柄シンボル正規化の単一情報源 `normalizeHoldingSymbol(symbol) = symbol.trim().toUpperCase()` を `holding-news.ts` に追加し、**リゾルバー側のキー生成**（`result[normalizeHoldingSymbol(symbol)] = ...`）と**参照側の引き当て**（`resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)] ?? []`）の**両方**に同一関数を適用する。これによりキー生成と参照が構造的に一致し、表記揺れによるサイレント0件表示を排除する。米国ティッカーは大文字、日本株は数値+".T" のため trim+toUpperCase は内部文字を変えず安全に正準化できる。`?? []` はキー不在時の最終フォールバックとして D-08 空状態に合流。20-01 Task 1（キー生成 + normalizeHoldingSymbol export + 単体/正規化キーテスト）と 20-02 Task 1（参照側適用 + キー正規化テスト）に反映済み

## Environment Availability

> 本フェーズは外部ツール・サービス・ランタイム依存を新規に追加しない（既存Node.js/vitest/zod環境のみで完結する純粋なコード変更）。既存環境（Node.js, npm, vitest ^4.0.18）はリポジトリの既存テストスイート実行（206テスト全パス、実行時間771ms）で稼働確認済み `[VERIFIED: npx vitest run]`。Step 2.6は上記理由によりスキップ。

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18（`package.json`確認済み、既存206テスト全パス） |
| Config file | none — vitest.config.*は存在せず、デフォルト設定で動作（`find`で不在確認済み） |
| Quick run command | `npx vitest run src/portfolio/holding-news.test.ts` |
| Full suite command | `npm test`（= `vitest run`、全テストファイル） |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| UI-05 | `resolvePortfolioHoldingNews`が正常IDを正しく解決し、見出し/ソース/URL/公開日時/matchTypeを持つオブジェクトを返す | unit | `npx vitest run src/portfolio/holding-news.test.ts -t "resolvePortfolioHoldingNews"` | ❌ Wave 0（describeブロック新規追加） |
| UI-05 | `normalizeHoldingSymbol`が trim + 大文字化で正準キーを生成し、リゾルバー結果キーが正規化される | unit | `npx vitest run src/portfolio/holding-news.test.ts -t "normalizeHoldingSymbol"` | ❌ Wave 0（Q2 RESOLVED対応） |
| UI-05 | 存在しないIDはそのエントリのみdropし、console.warnを呼ぶ（他エントリの解決は継続） | unit | `npx vitest run src/portfolio/holding-news.test.ts -t "不明な記事ID"` | ❌ Wave 0 |
| UI-05 | 銘柄間のID混入防止: holdingNewsでHII配下にのみ列挙された記事IDが、MRNAの解決結果に含まれない | unit | `npx vitest run src/portfolio/holding-news.test.ts -t "銘柄間"` | ❌ Wave 0（Pitfall 5対応、D-10必須項目） |
| UI-05 | `formatHoldingEvaluationsHtml`が見出しリンク・ソース名・JST日時・「社名一致」バッジ(name/alias一致時のみ)をHTMLに含める | unit | `npx vitest run src/scripts/generate-report.test.ts -t "Portfolio Report"` | ❌ Wave 0（既存describeブロックにテスト追加） |
| UI-05 | 参照側キー正規化: resolvedHoldingNewsのキーが正規化済み、h.symbolが表記揺れでも該当ニュースが描画される | unit | `npx vitest run src/scripts/generate-report.test.ts -t "Portfolio Report"` | ❌ Wave 0（Q2 RESOLVED対応） |
| UI-05 | リンクの`href`が`escapeHtml`済み、`target="_blank" rel="noopener noreferrer"`を持つ | unit | `npx vitest run src/scripts/generate-report.test.ts -t "rel.*noopener"` | ❌ Wave 0 |
| UI-05 | `generatePortfolioReportHtml`が3引数目省略時（既存2引数呼び出し）でも正常にHTML生成される（後方互換） | unit | `npx vitest run src/scripts/generate-report.test.ts -t "Test 25"` | ✅（既存Test 25-32が無変更でパスすることを確認するリグレッションチェック） |
| UI-06 | 関連ニュース0件銘柄でも「関連ニュース」見出しとミュートグレーの「本日の関連ニュースなし」が描画される | unit | `npx vitest run src/scripts/generate-report.test.ts -t "関連ニュースなし"` | ❌ Wave 0 |
| UI-06 | `tmp/holding-news.json`欠損/パース失敗時、`loadHoldingNews()`がthrowせず`{}`を返す（fail-soft, D-09） | unit | `npx vitest run src/scripts/report-data-loaders.test.ts -t "Holding news load failed"` | ❌ Wave 0（新規テストファイルまたは既存への追加が必要 — `report-data-loaders.test.ts`は現時点で存在しない） |
| UI-06 | `portfolioAnalysis === null`のフォールバック分岐がニュース関連引数追加後も無変更でパスする | unit | `npx vitest run src/scripts/generate-report.test.ts -t "Test 31"` | ✅（既存テスト、リグレッション確認のみ） |

### Sampling Rate
- **Per task commit:** `npx vitest run src/portfolio/holding-news.test.ts src/scripts/generate-report.test.ts`
- **Per wave merge:** `npm test`（全206+新規テスト）
- **Phase gate:** `npm test` が green であることを `/gsd:verify-work` 前に確認

### Wave 0 Gaps
- [ ] `src/portfolio/holding-news.test.ts` に `resolvePortfolioHoldingNews` / `normalizeHoldingSymbol` 向け describe ブロック追加 — UI-05 の解決ロジック・正規化キー生成・銘柄間ID混入防止（Pitfall 5）をカバー
- [ ] `src/scripts/generate-report.test.ts` の `describe("Portfolio Report", ...)` にニュースサブセクション向けテスト追加（0件/複数件/バッジ/リンク属性/キー正規化） — UI-05/UI-06 をカバー
- [ ] `src/scripts/report-data-loaders.test.ts` — 現状ファイル自体が存在しない（`ls`で不在確認済み）。`loadHoldingNews()`/`loadNewsPool()`のfail-soft挙動をテストする新規ファイルとして作成が必要
- [ ] フレームワークインストール: 不要（vitest既に導入済み）

## Security Domain

> `security_enforcement`は`.planning/config.json`に明示的な設定なし（absent = enabled として扱う）。ただし本プロジェクトはローカルバッチ処理が静的HTMLをGitHub Pagesへ配信するのみで、認証・セッション・APIエンドポイントを一切持たない個人利用ツールである点を踏まえ、該当するASVSカテゴリのみ評価する。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | 認証機構自体が存在しない（ローカルバッチ + 静的HTML配信） |
| V3 Session Management | no | セッション概念が存在しない |
| V4 Access Control | no | 単一ユーザーのローカルツール、アクセス制御レイヤーなし |
| V5 Input Validation | yes | `tmp/news.json`/`tmp/holding-news.json`は信頼できる自社生成物だが、JSON.parseの型アサーションのみでは実行時の形状不正（Pitfall 3の`publishedAt`型の嘘等）を検知できない点に留意。`resolvePortfolioHoldingNews`のID未検出時drop（D-10）が事実上の防御的入力検証として機能する |
| V6 Cryptography | no | 本フェーズは暗号処理を伴わない |

### Known Threat Patterns for TypeScript静的HTML生成パイプライン

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| 幻覚URL/存在しない記事IDによる不正リンク生成 | Tampering / Spoofing | ID参照方式（`resolvePortfolioHoldingNews`が`news.json`プールに存在するIDのみ解決、未知IDはdrop。D-10） |
| `javascript:`/`data:`スキームURLによるXSS（news.json内のurlフィールドが万一汚染された場合の最終防衛線） | Tampering | 既存の`safeHref()`（`http://`/`https://`のみ許可）を再利用（Don't Hand-Roll参照） |
| HTML属性/テキストへのタグインジェクション（記事タイトル・ソース名にHTML特殊文字が含まれる場合） | Tampering | 既存の`escapeHtml()`を全出力箇所（title/source/matchTypeバッジ含む）で徹底適用 |
| Reverse tabnabbing（`target="_blank"`のみでrel属性欠落） | Tampering | `rel="noopener noreferrer"`を全外部リンクに付与（既存news-digest実装の踏襲、D-03で明記） |
| symbol表記揺れによるサイレント0件（正しいニュースが消える情報欠落） | Denial of Service (silent) | `normalizeHoldingSymbol`をキー生成・参照の両側に適用し構造的にキー一致（Q2 RESOLVED） |

## Sources

### Primary (HIGH confidence)
- `/Users/arai/invest/.planning/phases/20-holding-card-news-display/20-CONTEXT.md` — 本フェーズのロック済み決定・裁量領域
- `/Users/arai/invest/.planning/phases/19-data-foundation-holding-news-supply/19-CONTEXT.md` — データ供給契約（D-05/D-07/D-09/D-10）
- `/Users/arai/invest/.planning/REQUIREMENTS.md` — UI-05/UI-06の正確な要件文言
- `/Users/arai/invest/.planning/research/SUMMARY.md` §Phase 2 — 本フェーズ相当の推奨実装
- `/Users/arai/invest/.planning/research/PITFALLS.md` Pitfall 10/11 — 空セクション問題・検証チェックリスト
- 直接コード調査: `src/scripts/generate-portfolio-report.ts`, `src/portfolio/holding-news.ts`, `src/portfolio/holding-news.test.ts`, `src/data/news/article-id.ts`, `src/data/news/types.ts`, `src/portfolio/holdings.ts`, `src/scripts/report-utils.ts`, `src/scripts/report-data-loaders.ts`, `src/scripts/generate-report.ts`, `src/scripts/generate-report.test.ts`, `src/scripts/generate-news-digest.ts`, `src/scripts/write-news-digest.ts`, `src/scripts/collect-data.ts`, `src/meeting/schemas.ts`, `src/meeting/types.ts`
- `npx vitest run` 実行結果（14ファイル/206テスト全パス, 771ms）— 既存テスト基盤の稼働確認 `[VERIFIED: npx vitest run]`
- `package.json` — zod ^4.3.6 / vitest ^4.0.18 のバージョン確認、vitest.config不在の確認（`find`コマンド）

### Secondary (MEDIUM confidence)
なし。本フェーズは既存コードベースの直接調査のみで十分な確信度に達しており、WebSearch等の外部情報源は不要だった。

### Tertiary (LOW confidence)
なし。

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 新規依存なし、既存`package.json`から直接確認
- Architecture: HIGH — 全設計判断が既存の稼働中コード（`resolveNewsCuration`, `write-news-digest.ts`, `generateDailyReportHtml`後方互換パターン）の直接踏襲
- Pitfalls: HIGH — PITFALLS.mdの既存記述 + 本セッションでの直接コード調査（型定義の実際の形状、既存テストの実際のアサーション内容）で裏付け済み

**Research date:** 2026-07-03
**Valid until:** 30日（安定した内部リファクタリングであり、外部API/ライブラリの陳腐化リスクなし。ただしPhase 19のholding-news.json形状が変更された場合は再調査が必要）
</content>
