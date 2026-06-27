import type { RawNewsArticle, NewsFilterResult } from "./types.js";

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
 * 現在はスケルトン実装。入力をそのまま返す。
 */
export function filterNewsArticles(
  articles: ReadonlyArray<RawNewsArticle>,
): NewsFilterResult {
  return {
    articles: [...articles],
    stats: {
      raw: articles.length,
      afterUrlDedup: articles.length,
      afterTitleDedup: articles.length,
      afterRelevance: articles.length,
      final: articles.length,
    },
  };
}
