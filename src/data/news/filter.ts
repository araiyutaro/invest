import type { RawNewsArticle, NewsFilterResult } from "./types.js";

/** Jaccard 類似度の閾値 (D-01) */
const JACCARD_THRESHOLD = 0.75;

/**
 * URL を正規化してホスト名 + パスのみを返す。
 * クエリパラメータ（トラッキング等）を除去して比較に使用する。
 * パース失敗時は元 URL をそのまま返す。
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return url;
  }
}

/**
 * タイトルを NFKC 正規化し、ブラケット除去・空白正規化・小文字化を行う。
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .replace(/【[^】]*】/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[　\s]+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * 正規化済みタイトルを空白・句読点で分割し、2 文字未満のトークンを除外して Set で返す。
 */
export function tokenize(normalized: string): Set<string> {
  return new Set(
    normalized.split(/[\s　・、。,!?！？]+/).filter((t) => t.length >= 2),
  );
}

/**
 * Jaccard 類似度を計算する。両方空 Set の場合は 1.0 を返す。
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * タイトルの 50% 以上が非 ASCII 文字なら日本語グループと判定する (D-03)。
 */
function isJapaneseTitle(title: string): boolean {
  if (title.length === 0) return false;
  const nonAsciiCount = [...title].filter((c) => c.charCodeAt(0) > 127).length;
  return nonAsciiCount / title.length >= 0.5;
}

/**
 * URL 正規化後に同一 URL の記事を集約し、summary が長い方を残す (DEDUP-01 / D-02)。
 */
function deduplicateByUrl(
  articles: ReadonlyArray<RawNewsArticle>,
): RawNewsArticle[] {
  const urlMap = new Map<string, RawNewsArticle>();
  for (const article of articles) {
    const key = normalizeUrl(article.url);
    const existing = urlMap.get(key);
    // D-02: summary が長い方を残す
    if (!existing || article.summary.length > existing.summary.length) {
      urlMap.set(key, article);
    }
  }
  return [...urlMap.values()];
}

/**
 * タイトルの Jaccard 類似度が閾値以上の記事を集約し、summary が長い方を残す (DEDUP-02 / D-01)。
 * 英語記事と日本語記事は同一言語グループ内のみで比較する (D-03)。
 */
function deduplicateByTitle(
  articles: ReadonlyArray<RawNewsArticle>,
): RawNewsArticle[] {
  const excluded = new Set<number>();

  for (let i = 0; i < articles.length; i++) {
    if (excluded.has(i)) continue;

    const tokensI = tokenize(normalizeTitle(articles[i].title));
    const isJapaneseI = isJapaneseTitle(articles[i].title);

    for (let j = i + 1; j < articles.length; j++) {
      if (excluded.has(j)) continue;

      // D-03: 異なる言語グループは比較しない
      const isJapaneseJ = isJapaneseTitle(articles[j].title);
      if (isJapaneseI !== isJapaneseJ) continue;

      const tokensJ = tokenize(normalizeTitle(articles[j].title));
      const similarity = jaccardSimilarity(tokensI, tokensJ);

      if (similarity >= JACCARD_THRESHOLD) {
        // D-02: summary が短い方を除外する
        if (articles[i].summary.length >= articles[j].summary.length) {
          excluded.add(j);
        } else {
          excluded.add(i);
          break; // i を除外したので i のループを終了
        }
      }
    }
  }

  return articles.filter((_, idx) => !excluded.has(idx));
}

/**
 * 除外対象カテゴリ: 娯楽・スポーツ・天気 (D-06)
 * タイトルのみに適用する (RESEARCH.md Pitfall 5)。
 */
export const DENYLIST_PATTERNS: ReadonlyArray<RegExp> = [
  /スポーツ|野球|サッカー|テニス|競馬|ゴルフ|バスケ|オリンピック/,
  /芸能|タレント|俳優|歌手|アイドル|ドラマ|映画|コンサート/,
  /天気|台風|気象|豪雨|大雪/,
];

/**
 * 投資関連キーワード: これらが存在すればdenylistにマッチしても除外しない (D-05)
 */
export const FINANCIAL_EXCEPTION_KEYWORDS: ReadonlyArray<RegExp> = [
  /株|株価|上場|決算|業績|利益|売上/,
  /金利|為替|円安|円高|インフレ/,
  /投資|ファンド|ETF|債券|IPO|M&A|買収/,
];

/**
 * タイトルが denylist に該当し、かつ投資関連キーワードが存在しない場合に true を返す。
 * タイトルのみを照合対象とする (summaryは対象外 -- RESEARCH.md Pitfall 5)。
 */
export function isDenylisted(title: string): boolean {
  const hasDenyMatch = DENYLIST_PATTERNS.some((p) => p.test(title));
  if (!hasDenyMatch) return false;
  // 例外: 投資関連キーワードがあれば除外しない (D-05)
  const hasFinancialKeyword = FINANCIAL_EXCEPTION_KEYWORDS.some((p) =>
    p.test(title),
  );
  return !hasFinancialKeyword;
}

/**
 * denylist に該当する記事を除外する (FILT-01 / D-05 / D-07)。
 */
export function filterByRelevance(
  articles: ReadonlyArray<RawNewsArticle>,
): RawNewsArticle[] {
  return articles.filter((a) => !isDenylisted(a.title));
}

/**
 * 24時間以内の記事のみを残す (FILT-02 / D-08)。
 * finnhub.ts 39-42行目のパターンを踏襲。
 */
export function filterByTime(
  articles: ReadonlyArray<RawNewsArticle>,
): RawNewsArticle[] {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return articles.filter((a) => a.publishedAt.getTime() > oneDayAgo);
}

export function calculatePriorityScore(
  article: RawNewsArticle,
  now: number,
  portfolioTickers: ReadonlyArray<string>,
): number {
  const ageHours = (now - article.publishedAt.getTime()) / (60 * 60 * 1000);

  let timeScore: number;
  if (ageHours < 6) {
    timeScore = 1.0;
  } else if (ageHours < 12) {
    timeScore = 0.7;
  } else {
    timeScore = 0.4;
  }

  const tickerBonus =
    article.ticker !== undefined && portfolioTickers.includes(article.ticker)
      ? 0.2
      : 0;

  return timeScore + tickerBonus;
}

export function sortByPriorityScore(
  articles: ReadonlyArray<RawNewsArticle>,
  portfolioTickers: ReadonlyArray<string>,
): RawNewsArticle[] {
  const now = Date.now();
  return [...articles].sort((a, b) => {
    const scoreA = calculatePriorityScore(a, now, portfolioTickers);
    const scoreB = calculatePriorityScore(b, now, portfolioTickers);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });
}

/**
 * ニュース記事をフィルタリングしてスコア順にソートする。
 * Pass 1: URL dedup (DEDUP-01)
 * Pass 2: Title Jaccard dedup (DEDUP-02)
 * Pass 3: Relevance filter — denylist + 投資キーワード例外 (FILT-01)
 * Pass 4: 24h time filter (FILT-02)
 * Pass 5: Priority score sort (NEWS-02)
 */
export function filterNewsArticles(
  articles: ReadonlyArray<RawNewsArticle>,
  portfolioTickers: ReadonlyArray<string> = [],
): NewsFilterResult {
  const afterUrlDedup = deduplicateByUrl(articles);
  const afterTitleDedup = deduplicateByTitle(afterUrlDedup);
  const afterRelevance = filterByRelevance(afterTitleDedup);
  const afterTime = filterByTime(afterRelevance);
  const finalArticles = sortByPriorityScore(afterTime, portfolioTickers);

  return {
    articles: finalArticles,
    stats: {
      raw: articles.length,
      afterUrlDedup: afterUrlDedup.length,
      afterTitleDedup: afterTitleDedup.length,
      afterRelevance: afterRelevance.length,
      final: afterTime.length,
    },
  };
}
