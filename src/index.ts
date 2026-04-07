import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fetchAllMarketData } from "./data/market.js";
import { fetchMarketNews } from "./data/news.js";
import {
  generateSectorChart,
  generateMarketOverviewChart,
} from "./data/charts.js";
import { runMeeting } from "./meeting/runner.js";
import { saveReports } from "./report/generator.js";
import { PORTFOLIO_HOLDINGS } from "./portfolio/holdings.js";
import { fetchPortfolioData, formatPortfolioSummary } from "./portfolio/data.js";
import { runPortfolioMeeting } from "./portfolio/runner.js";
import { savePortfolioReport } from "./report/portfolio-generator.js";
import type { MarketIndex, SectorPerformance } from "./data/market.js";

const REPORTS_DIR = join(import.meta.dirname, "../docs");

function formatMarketDataSummary(
  indices: ReadonlyArray<MarketIndex>,
  sectors: ReadonlyArray<SectorPerformance>,
): string {
  const lines: string[] = ["### 主要指数", ""];
  lines.push("| 指数 | 価格 | 前日比 | 変動率 |");
  lines.push("|------|------|--------|--------|");
  for (const idx of indices) {
    const sign = idx.change >= 0 ? "+" : "";
    lines.push(
      `| ${idx.name} | ${idx.price.toLocaleString()} | ${sign}${idx.change.toFixed(2)} | ${sign}${idx.changePercent.toFixed(2)}% |`,
    );
  }

  lines.push("", "### セクターパフォーマンス", "");
  lines.push("| セクター | ETF | 変動率 |");
  lines.push("|----------|-----|--------|");

  const sortedSectors = [...sectors].sort(
    (a, b) => b.changePercent - a.changePercent,
  );
  for (const sec of sortedSectors) {
    const sign = sec.changePercent >= 0 ? "+" : "";
    lines.push(
      `| ${sec.sector} | ${sec.symbol} | ${sign}${sec.changePercent.toFixed(2)}% |`,
    );
  }

  return lines.join("\n");
}

async function main() {
  const startTime = Date.now();
  console.log("=== Investment Agent Meeting ===");
  console.log(
    `Date: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
  );
  console.log("");

  console.log("Step 1/7: 市場データを取得中...");
  const [marketData, news, portfolioStocks] = await Promise.all([
    fetchAllMarketData(),
    fetchMarketNews(),
    fetchPortfolioData(PORTFOLIO_HOLDINGS),
  ]);

  const marketDataSummary = formatMarketDataSummary(
    marketData.indices,
    marketData.sectors,
  );
  console.log("  -> 市場データ取得完了");

  const portfolioSummary = formatPortfolioSummary(portfolioStocks);
  console.log(`  -> ポートフォリオ: ${portfolioStocks.length}銘柄取得完了`);

  console.log("Step 2/7: チャート生成中 (NanoBanana)...");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const dateDir = join(REPORTS_DIR, today);
  await mkdir(dateDir, { recursive: true });

  const [sectorChart, marketChart] = await Promise.all([
    generateSectorChart(marketData.sectors, dateDir),
    generateMarketOverviewChart(marketData.indices, dateDir),
  ]);
  const chartImages = [sectorChart, marketChart].filter(
    (c): c is string => c !== null,
  );
  console.log(`  -> ${chartImages.length}枚のチャート生成完了`);

  console.log("Step 3/7: ミーティング開始...");
  const meetingRecord = await runMeeting({ marketDataSummary, news });
  console.log("  -> ミーティング完了");

  console.log("Step 4/7: レポート保存中...");
  const { minutesPath, reportPath } = await saveReports(
    meetingRecord,
    chartImages,
  );
  console.log(`  -> 議事録: ${minutesPath}`);
  console.log(`  -> レポート: ${reportPath}`);

  console.log("Step 5/7: ポートフォリオミーティング開始...");
  try {
    const portfolioReport = await runPortfolioMeeting({
      portfolioSummary,
      marketDataSummary,
      news,
      stocks: portfolioStocks,
    });
    console.log("  -> ポートフォリオミーティング完了");

    console.log("Step 6/7: ポートフォリオレポート保存中...");
    const portfolioPath = await savePortfolioReport(portfolioReport);
    console.log(`  -> ポートフォリオレポート: ${portfolioPath}`);
  } catch (error) {
    console.error("Portfolio report generation failed:", error);
    console.log("  -> ポートフォリオレポートの生成に失敗しましたが、デイリーレポートは保存済みです");
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log(`Step 7/7: 完了 (${elapsed}秒)`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
