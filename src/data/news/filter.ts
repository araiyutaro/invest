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
 * ニュース記事をフィルタリングする。
 * Pass 1: URL dedup
 * Pass 2: Title Jaccard dedup
 * Pass 3/4: Phase 09-02 で実装
 */
export function filterNewsArticles(
  articles: ReadonlyArray<RawNewsArticle>,
): NewsFilterResult {
  const afterUrlDedup = deduplicateByUrl(articles);
  const afterTitleDedup = deduplicateByTitle(afterUrlDedup);

  // Pass 3 (関連性フィルタ) と Pass 4 (24h フィルタ) は Plan 08-02 で実装
  const afterRelevance = afterTitleDedup;
  const finalArticles = afterRelevance;

  return {
    articles: finalArticles,
    stats: {
      raw: articles.length,
      afterUrlDedup: afterUrlDedup.length,
      afterTitleDedup: afterTitleDedup.length,
      afterRelevance: afterRelevance.length,
      final: finalArticles.length,
    },
  };
}
