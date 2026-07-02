import { describe, it, expect } from "vitest";
import type { NewsCuration, CuratedArticle } from "../meeting/types.js";

const baseDate = "2026-07-02";

const articleUsHigh: CuratedArticle = {
  id: "us-1",
  title: "NVIDIA第2四半期決算、市場予想上回る",
  url: "https://example.com/news/nvda?ref=digest&utm=abc",
  source: "Reuters",
  publishedAt: "2026-07-02T06:30:00.000Z", // JST 7/2 15:30
  market: "us",
  importance: "high",
  commentary: "AI需要の持続的拡大を示す強い決算内容。",
  tickers: ["NVDA"],
  tickerNames: { NVDA: "エヌビディア" },
};

const articleUsLow: CuratedArticle = {
  id: "us-2",
  title: "Apple、新製品発表を控え株価は小動き",
  url: "https://example.com/news/aapl",
  source: "Bloomberg",
  publishedAt: "2026-07-02T05:00:00.000Z",
  market: "us",
  importance: "low",
  commentary: "新製品への期待感はあるものの材料出尽くし感も。",
  tickers: ["AAPL"], // tickerNames欠落 -> シンボルのみにフォールバック(D-04)
};

const articleJpMedium: CuratedArticle = {
  id: "jp-1",
  title: "トヨタ自動車、増産計画を発表",
  url: "https://example.com/news/7203",
  source: "日本経済新聞",
  publishedAt: "2026-07-02T00:00:00.000Z",
  market: "japan",
  importance: "medium",
  commentary: "北米市場での需要増を受けた増産判断。",
  tickers: ["7203"],
  tickerNames: { "7203": "トヨタ自動車" },
};

// あえて importance 順ではない配列順で格納（CURA-06 のソートを実際に検証するため）
const validCuration: NewsCuration = {
  date: baseDate,
  generatedAt: "2026-07-02T07:00:00.000Z",
  leadIn: "決算シーズンが本格化し、ハイテク企業の動向が焦点。",
  articles: [articleUsLow, articleUsHigh, articleJpMedium], // global市場は0件(D-06検証用)
};

const emptyCuration: NewsCuration = {
  date: baseDate,
  generatedAt: "2026-07-02T07:00:00.000Z",
  leadIn: "",
  articles: [],
};

const articleBadScheme: CuratedArticle = {
  id: "bad-1",
  title: "不審なスキームのテスト記事",
  url: "javascript:alert(1)",
  source: "Test Source",
  publishedAt: "2026-07-02T04:00:00.000Z",
  market: "global",
  importance: "low",
  commentary: "スキーム検証用のテスト記事。",
  tickers: [],
};

const curationWithBadScheme: NewsCuration = {
  date: baseDate,
  generatedAt: "2026-07-02T07:00:00.000Z",
  leadIn: "スキーム検証",
  articles: [articleBadScheme],
};

function jstTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

describe("generateNewsDigestHtml", () => {
  it("CURA-03: 見出しリンク(escapeHtml済みhref・target=_blank・rel=noopener noreferrer)・ソース名・JST絶対時刻を含む", async () => {
    const { generateNewsDigestHtml } = await import("./generate-news-digest.js");
    const html = generateNewsDigestHtml(validCuration, baseDate);

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("&amp;"); // href中の & がエスケープされている
    expect(html).toContain("Reuters");
    expect(html).toContain("Bloomberg");
    expect(html).toContain(jstTime(articleUsHigh.publishedAt));
  });

  it("CURA-04: 各記事の日本語「なぜ重要か」解説コメントを含む", async () => {
    const { generateNewsDigestHtml } = await import("./generate-news-digest.js");
    const html = generateNewsDigestHtml(validCuration, baseDate);

    expect(html).toContain(articleUsHigh.commentary);
    expect(html).toContain(articleUsLow.commentary);
    expect(html).toContain(articleJpMedium.commentary);
  });

  it("CURA-06: 同一市場グループ内で重要度順(high→medium→low)に配列される", async () => {
    const { generateNewsDigestHtml } = await import("./generate-news-digest.js");
    const html = generateNewsDigestHtml(validCuration, baseDate);

    const idxHigh = html.indexOf(articleUsHigh.title);
    const idxLow = html.indexOf(articleUsLow.title);
    expect(idxHigh).toBeGreaterThan(-1);
    expect(idxLow).toBeGreaterThan(-1);
    expect(idxHigh).toBeLessThan(idxLow);
  });

  it("CURA-07: High/Medium/Lowバッジがimportanceと同一ソースから導出される(D-08配色)", async () => {
    const { generateNewsDigestHtml } = await import("./generate-news-digest.js");
    const html = generateNewsDigestHtml(validCuration, baseDate);

    expect(html).toContain("High");
    expect(html).toContain("Medium");
    expect(html).toContain("Low");
    expect(html).toContain("#ef4444");
    expect(html).toContain("#f59e0b");
    expect(html).toContain("#6b7280");
  });

  it("CURA-08: 会社名併記ティッカーピルを含み、社名欠落時はシンボルのみにフォールバックする(D-04/D-09)", async () => {
    const { generateNewsDigestHtml } = await import("./generate-news-digest.js");
    const html = generateNewsDigestHtml(validCuration, baseDate);

    expect(html).toContain("NVDA エヌビディア");
    expect(html).toContain("トヨタ自動車");
    expect(html).toContain(">AAPL<"); // tickerNames欠落 -> シンボルのみのプレーンピル
  });

  it("CURA-09: リード文がページ冒頭付近(市場セクションより前)に出現する", async () => {
    const { generateNewsDigestHtml } = await import("./generate-news-digest.js");
    const html = generateNewsDigestHtml(validCuration, baseDate);

    const idxLeadIn = html.indexOf(validCuration.leadIn);
    const idxUsSection = html.indexOf("米国株");
    expect(idxLeadIn).toBeGreaterThan(-1);
    expect(idxUsSection).toBeGreaterThan(-1);
    expect(idxLeadIn).toBeLessThan(idxUsSection);
  });

  it("UI-03: 既存3レポートと同じダークテーマ(#8b5cf6)・モバイル対応・DOCTYPEを含む", async () => {
    const { generateNewsDigestHtml } = await import("./generate-news-digest.js");
    const html = generateNewsDigestHtml(validCuration, baseDate);

    expect(html).toContain("#8b5cf6");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('name="viewport"');
  });

  it("市場順: 米国株 → 日本株 → グローバルの固定順で出現する(D-05)", async () => {
    const { generateNewsDigestHtml } = await import("./generate-news-digest.js");
    const html = generateNewsDigestHtml(validCuration, baseDate);

    const idxUs = html.indexOf("米国株");
    const idxJapan = html.indexOf("日本株");
    const idxGlobal = html.indexOf("グローバル");
    expect(idxUs).toBeGreaterThan(-1);
    expect(idxJapan).toBeGreaterThan(-1);
    expect(idxGlobal).toBeGreaterThan(-1);
    expect(idxUs).toBeLessThan(idxJapan);
    expect(idxJapan).toBeLessThan(idxGlobal);
  });

  it("0件市場グループ: 記事0件のグローバル市場も見出しと「本日の該当記事なし」を表示する(D-06)", async () => {
    const { generateNewsDigestHtml } = await import("./generate-news-digest.js");
    const html = generateNewsDigestHtml(validCuration, baseDate);

    expect(html).toContain("グローバル");
    expect(html).toContain("本日の該当記事なし");
  });

  it("フォールバック(null): 完全なHTMLページで「生成できませんでした」を表示し、記事カードを含まない(D-12)", async () => {
    const { generateNewsDigestHtml } = await import("./generate-news-digest.js");
    const html = generateNewsDigestHtml(null, baseDate);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("生成できませんでした");
    expect(html).not.toContain("news-card");
  });

  it("フォールバック(空配列): 「厳選記事なし」を表示し「生成できませんでした」は含まない(D-06後半, Pitfall 2)", async () => {
    const { generateNewsDigestHtml } = await import("./generate-news-digest.js");
    const html = generateNewsDigestHtml(emptyCuration, baseDate);

    expect(html).toContain("厳選記事なし");
    expect(html).not.toContain("生成できませんでした");
  });

  it("URLスキーム検証: http(s)以外のスキーム(javascript:)はリンク化せずプレーンテキスト見出しにフォールバックする(T-16-02-03)", async () => {
    const { generateNewsDigestHtml } = await import("./generate-news-digest.js");
    const html = generateNewsDigestHtml(curationWithBadScheme, baseDate);

    expect(html).not.toContain("javascript:");
    expect(html).toContain(articleBadScheme.title);
  });
});
