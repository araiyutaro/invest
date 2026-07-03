import { calculatePriorityScore } from "../data/news/filter.js";
import type { NewsArticleWithId } from "../data/news/article-id.js";
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";
import type { PortfolioHolding } from "./holdings.js";

/** 1銘柄あたりの供給上限（D-09） */
const MAX_ARTICLES_PER_HOLDING = 5;

/** マッチ方式。切り捨て時は ticker一致 > 社名・エイリアス一致（同格、優先度スコア降順）の優先順位を持つ (D-10)。 */
export type HoldingNewsMatchType = "ticker" | "name" | "alias";

/**
 * holding-news.json の1エントリ。記事本体は含まずID参照 + マッチメタ情報のみを保持する (D-05)。
 */
export interface HoldingNewsEntry {
  readonly id: string;
  readonly matchType: HoldingNewsMatchType;
  readonly score: number;
}

/** 保有銘柄シンボルをキーとする holding-news マップ。全銘柄のキーを必ず持つ (D-08)。 */
export type HoldingNewsFile = Record<string, ReadonlyArray<HoldingNewsEntry>>;

/**
 * 銘柄シンボル正規化の単一情報源（Open Questions Q2 RESOLVED）。
 * trim + toUpperCase のみを行い、内部文字は変えない（例: " 8522.t " → "8522.T", "mrna" → "MRNA"）。
 * resolvePortfolioHoldingNews のキー生成と Wave 2 の参照側（generate-portfolio-report.ts）が
 * 同じ関数でキーを生成することで、LLM(portfolio-analyst)出力の HoldingEvaluation.symbol の
 * 表記揺れ（schemas.ts の symbol は z.string() のみで無正規化）によるキー不一致を構造的に防ぐ。
 * 米国ティッカーは大文字、日本株は数値+".T" のため trim+toUpperCase で安全に正準化できる。
 */
export function normalizeHoldingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * resolvePortfolioHoldingNews が返す解決済みニュース項目。
 * score は含めない (D-06: 優先度スコアは内部値のため非表示。型に含めないことで構造的に防止)。
 */
export interface ResolvedHoldingNewsItem {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly url: string;
  readonly publishedAt: string; // JSON往復後は必ずstring（Pitfall 3と同じ注意）
  readonly matchType: HoldingNewsMatchType;
}

/**
 * holding-news.json（銘柄別ID参照, Phase 19生成）と news.json（記事プール）を照合し、
 * 各銘柄の解決済みニュース項目を返す。
 * pool に存在しないIDのエントリは drop され console.warn が出る (D-10: 幻覚URL防止の最終ガード)。
 * 銘柄間のID混入を防ぐため Object.entries(holdingNews) を起点にループし、プールを独立再フィルタ
 * しない (Pitfall 5)。throw しない。結果マップのキーは normalizeHoldingSymbol で正規化される。
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
        id: article.id,
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

interface HoldingArticleMatch {
  readonly article: NewsArticleWithId;
  readonly matchType: HoldingNewsMatchType;
}

/**
 * article.ticker が holding.symbol と厳密一致するか判定する (D-01)。
 * ticker一致は社名一致より優先度が高い最も確実なマッチ方式。
 */
export function matchesTicker(
  article: NewsArticleWithId,
  holding: PortfolioHolding,
): boolean {
  return article.ticker === holding.symbol;
}

/**
 * タイトルに候補文字列のいずれかが含まれるか大小文字区別なしで判定する。
 */
function titleIncludesAny(
  title: string,
  candidates: ReadonlyArray<string>,
): boolean {
  const lowerTitle = title.toLowerCase();
  return candidates.some((c) => lowerTitle.includes(c.toLowerCase()));
}

/**
 * タイトルが holding.name / holding.nameJa に一致すれば "name"、
 * matchAliases のいずれかに一致すれば "alias"、どちらにも一致しなければ null を返す。
 * 社名照合はタイトルのみを対象とする (D-03: summary は評価しない -- filter.ts isDenylisted の
 * タイトルのみ照合パターンを踏襲。RESEARCH.md Pitfall 5)。
 */
function resolveNameMatchType(
  title: string,
  holding: PortfolioHolding,
): "name" | "alias" | null {
  if (titleIncludesAny(title, [holding.name, holding.nameJa])) {
    return "name";
  }
  if (holding.matchAliases && titleIncludesAny(title, holding.matchAliases)) {
    return "alias";
  }
  return null;
}

/**
 * タイトルが holding の name / nameJa / matchAliases のいずれかに一致するか判定する (D-02, D-03, D-04)。
 * 社名フォールバックは全12銘柄に均一適用され、日本株限定にはしない (D-02)。
 * matchAliases は人間キュレーション済みの追加エイリアスとして照合に参加する (D-04)。
 */
export function matchesHoldingByName(
  title: string,
  holding: PortfolioHolding,
): boolean {
  return resolveNameMatchType(title, holding) !== null;
}

/**
 * 1銘柄について記事プール全体から候補記事を収集する。
 * ticker一致を優先し、ticker不一致の場合のみ社名フォールバックを評価する (D-01)。
 * 入力配列は変更しない。
 */
export function matchArticlesForHolding(
  articles: ReadonlyArray<NewsArticleWithId>,
  holding: PortfolioHolding,
): ReadonlyArray<HoldingArticleMatch> {
  const matches: HoldingArticleMatch[] = [];
  for (const article of articles) {
    if (matchesTicker(article, holding)) {
      matches.push({ article, matchType: "ticker" });
      continue;
    }
    const nameMatchType = resolveNameMatchType(article.title, holding);
    if (nameMatchType !== null) {
      matches.push({ article, matchType: nameMatchType });
    }
  }
  return matches;
}

/**
 * 候補記事を優先度スコアで採点し、ticker一致を優先しつつ上限5件に切り捨てる (D-09, D-10)。
 * 順序: ticker一致（スコア降順）→ name/alias一致（スコア降順）の順に並べ、先頭5件のみ採用。
 * これにより上限超過時は確実性の高いticker一致が常に残る。
 */
export function rankAndCapHoldingArticles(
  matches: ReadonlyArray<HoldingArticleMatch>,
  now: number,
  portfolioTickers: ReadonlyArray<string>,
): ReadonlyArray<HoldingNewsEntry> {
  const scored = matches.map((m) => ({
    ...m,
    score: calculatePriorityScore(m.article, now, portfolioTickers),
  }));

  const tickerMatches = scored
    .filter((m) => m.matchType === "ticker")
    .sort((a, b) => b.score - a.score);
  const nameMatches = scored
    .filter((m) => m.matchType !== "ticker")
    .sort((a, b) => b.score - a.score);

  return [...tickerMatches, ...nameMatches]
    .slice(0, MAX_ARTICLES_PER_HOLDING)
    .map((m) => ({ id: m.article.id, matchType: m.matchType, score: m.score }));
}

/**
 * 記事プールと12銘柄の保有リストから、保有銘柄別ニュースマップを決定論的に生成する。
 * fail-soft: 常に全 holding.symbol をキーに持ち、マッチ0件の銘柄も空配列を返す。throwしない (D-08)。
 * 副作用なし。入力 articles / holdings は変更しない。
 */
export function buildHoldingNewsMap(
  articles: ReadonlyArray<NewsArticleWithId>,
  holdings: ReadonlyArray<PortfolioHolding>,
): HoldingNewsFile {
  const now = Date.now();
  const portfolioTickers = holdings.map((h) => h.symbol);

  const entries = holdings.map((holding) => {
    const matches = matchArticlesForHolding(articles, holding);
    const ranked = rankAndCapHoldingArticles(matches, now, portfolioTickers);
    return [holding.symbol, ranked] as const;
  });

  return Object.fromEntries(entries);
}
