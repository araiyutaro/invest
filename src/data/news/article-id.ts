import type { RawNewsArticle } from "./types.js";

/**
 * ID を付与された記事。
 * `id` は入力配列の順序どおりに割り当てられる短い連番文字列（例: "n01"）。
 */
export interface NewsArticleWithId extends RawNewsArticle {
  readonly id: string;
}

/**
 * 記事配列に短い連番 ID（n01, n02, ...）を入力順に付与する (D-01)。
 * 配列インデックスの暗黙参照や URL ハッシュは採用しない — LLM に短い ID をコピーさせるだけで
 * 記事を一意に参照できるようにするため（幻覚 URL の構造的防止）。
 * 元配列・元要素は変更しない（イミュータブルな新配列を返す）。
 *
 * 桁数は 2 桁ゼロ埋め固定とする。collect-data.ts の MAX=80 件クランプに対し
 * 2 桁（n01〜n99）で十分にカバーできるため。
 */
export function assignArticleIds(
  articles: ReadonlyArray<RawNewsArticle>,
): ReadonlyArray<NewsArticleWithId> {
  return articles.map((article, i) => ({
    ...article,
    id: `n${String(i + 1).padStart(2, "0")}`,
  }));
}
