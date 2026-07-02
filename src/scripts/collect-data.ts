import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fetchAllMarketData } from "../data/market.js";
import { fetchAllFinnhubNews } from "../data/news/finnhub.js";
import { fetchGoogleNewsJapan } from "../data/news/google-news.js";
import { fetchAllRssNews } from "../data/news/rss-sources.js";
import { filterNewsArticles } from "../data/news/filter.js";
import { assignArticleIds } from "../data/news/article-id.js";
import { PORTFOLIO_HOLDINGS } from "../portfolio/holdings.js";
import { fetchPortfolioData } from "../portfolio/data.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");

export async function main() {
  const t0 = performance.now();
  console.log("データ収集開始...");
  await mkdir(TMP_DIR, { recursive: true });

  console.log("市場データ収集中...");
  const marketData = await fetchAllMarketData();
  await writeFile(
    join(TMP_DIR, "market.json"),
    JSON.stringify(marketData, null, 2),
    "utf-8",
  );
  console.log(
    `市場データ収集完了 (指数: ${marketData.indices.length}件, セクター: ${marketData.sectors.length}件)`,
  );

  try {
    console.log("ニュース収集中...");
    const usTickers = PORTFOLIO_HOLDINGS
      .map((h) => h.symbol)
      .filter((s) => !s.includes("."));

    const [finnhubNews, googleNews, rssNews] = await Promise.all([
      fetchAllFinnhubNews(usTickers),
      fetchGoogleNewsJapan().catch(() => [] as Awaited<ReturnType<typeof fetchGoogleNewsJapan>>),
      fetchAllRssNews().catch(() => [] as Awaited<ReturnType<typeof fetchAllRssNews>>),
    ]);
    const allArticles = [
      ...finnhubNews.general,
      ...finnhubNews.merger,
      ...finnhubNews.company,
      ...googleNews,
      ...rssNews,
    ];
    const { articles: filtered, stats } = filterNewsArticles(allArticles, usTickers);
    console.log(`ニュース: ${stats.raw}件 → dedup: ${stats.afterTitleDedup}件 → フィルタ後: ${stats.final}件`);
    let finalArticles = [...filtered];
    if (filtered.length > 80) {
      console.log(`MAX=80超過: ${filtered.length}件 → 80件にトリミング`);
      finalArticles = [...filtered].slice(0, 80);
    }
    if (finalArticles.length < 20) {
      console.log(`⚠ フィルタ後の記事が${finalArticles.length}件です（MIN=20未満）`);
    }
    const idArticles = assignArticleIds(finalArticles);
    await writeFile(
      join(TMP_DIR, "news.json"),
      JSON.stringify(idArticles, null, 2),
      "utf-8",
    );
  } catch (e) {
    console.error("ニュース収集失敗（続行）:", e);
    await writeFile(join(TMP_DIR, "news.json"), "[]", "utf-8");
  }

  try {
    console.log("ポートフォリオデータ収集中...");
    const portfolioStocks = await fetchPortfolioData(PORTFOLIO_HOLDINGS);
    await writeFile(
      join(TMP_DIR, "portfolio.json"),
      JSON.stringify(portfolioStocks, null, 2),
      "utf-8",
    );
    console.log(`ポートフォリオデータ収集完了 (${portfolioStocks.length}銘柄)`);
  } catch (e) {
    console.error("ポートフォリオ収集失敗（続行）:", e);
    await writeFile(join(TMP_DIR, "portfolio.json"), "[]", "utf-8");
  }

  const topIndex = marketData.indices[0];
  console.log("=== データ収集サマリー ===");
  if (topIndex) {
    const sign = topIndex.changePercent >= 0 ? "+" : "";
    console.log(
      `主要指数: ${topIndex.name} ${sign}${topIndex.changePercent.toFixed(2)}%`,
    );
  }
  console.log(`指数数: ${marketData.indices.length}件`);
  const durationMs = Math.round(performance.now() - t0);
  const metricsPath = join(TMP_DIR, "pipeline-metrics.json");
  let metrics: Record<string, unknown> = {};
  try {
    metrics = JSON.parse(await readFile(metricsPath, "utf-8")) as Record<string, unknown>;
  } catch {
    // ファイル未存在は正常（パイプライン初回）
  }
  const updated = { ...metrics, collectData: { durationMs } };
  await writeFile(metricsPath, JSON.stringify(updated, null, 2), "utf-8");
  console.log("データ収集完了");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
