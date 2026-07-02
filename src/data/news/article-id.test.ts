import { describe, it, expect } from "vitest";
import { assignArticleIds } from "./article-id.js";
import type { RawNewsArticle } from "./types.js";

const makeArticle = (overrides: Partial<RawNewsArticle>): RawNewsArticle => ({
  title: "デフォルトタイトル",
  summary: "デフォルト本文",
  source: "TestSource",
  url: "https://example.com/article",
  publishedAt: new Date(),
  category: "japan_market",
  ...overrides,
});

describe("assignArticleIds (D-01)", () => {
  it("入力順に n01, n02, n03 が付与される", () => {
    const articles = [
      makeArticle({ title: "記事A" }),
      makeArticle({ title: "記事B" }),
      makeArticle({ title: "記事C" }),
    ];
    const result = assignArticleIds(articles);
    expect(result.map((a) => a.id)).toEqual(["n01", "n02", "n03"]);
  });

  it("元配列は変更されず、他フィールドは保持される", () => {
    const articles = [makeArticle({ title: "記事A", url: "https://example.com/a" })];
    const original = [...articles];
    const result = assignArticleIds(articles);

    expect(articles).toEqual(original);
    expect(result[0].title).toBe("記事A");
    expect(result[0].url).toBe("https://example.com/a");
    expect(result[0].id).toBe("n01");
  });

  it("80件入力で最後の要素が n80（2桁ゼロ埋め）になる", () => {
    const articles = Array.from({ length: 80 }, (_, i) =>
      makeArticle({ title: `記事${i}`, url: `https://example.com/${i}` }),
    );
    const result = assignArticleIds(articles);
    expect(result[79].id).toBe("n80");
    expect(result[0].id).toBe("n01");
  });

  it("空配列入力で空配列を返す", () => {
    const result = assignArticleIds([]);
    expect(result).toEqual([]);
  });
});
