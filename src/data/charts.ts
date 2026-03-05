import { GoogleGenAI } from "@google/genai";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MarketIndex, SectorPerformance } from "./market.js";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenAI({ apiKey });

async function generateChartImage(
  prompt: string,
  outputPath: string,
): Promise<string | null> {
  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) return null;

    for (const part of parts) {
      if (part.inlineData) {
        const buffer = Buffer.from(part.inlineData.data!, "base64");
        await writeFile(outputPath, buffer);
        return outputPath;
      }
    }
    return null;
  } catch (error) {
    console.error(`Failed to generate chart image:`, error);
    return null;
  }
}

export async function generateSectorChart(
  sectors: ReadonlyArray<SectorPerformance>,
  outputDir: string,
): Promise<string | null> {
  const sortedSectors = [...sectors].sort(
    (a, b) => b.changePercent - a.changePercent,
  );

  const dataDescription = sortedSectors
    .map((s) => `${s.sector}: ${s.changePercent >= 0 ? "+" : ""}${s.changePercent.toFixed(2)}%`)
    .join(", ");

  const prompt = `Create a clean, professional horizontal bar chart showing today's sector performance.
Data: ${dataDescription}
Style: Dark theme with a dark navy/charcoal background (#1a1a2e). Use green bars for positive values and red bars for negative values.
Labels should be white text, clearly readable. Include percentage values at the end of each bar.
Title: "Sector Performance" in white bold text at the top.
Make it look like a Bloomberg terminal style chart. Resolution should be high quality.
Do NOT include any watermarks or signatures.`;

  const outputPath = join(outputDir, "sector-performance.png");
  return generateChartImage(prompt, outputPath);
}

export async function generateMarketOverviewChart(
  indices: ReadonlyArray<MarketIndex>,
  outputDir: string,
): Promise<string | null> {
  const dataDescription = indices
    .map(
      (i) =>
        `${i.name}: ${i.price.toLocaleString()} (${i.changePercent >= 0 ? "+" : ""}${i.changePercent.toFixed(2)}%)`,
    )
    .join(", ");

  const prompt = `Create a clean, professional summary card showing today's major market indices.
Data: ${dataDescription}
Style: Dark theme with a dark navy/charcoal background (#1a1a2e).
Show each index as a card/tile with the index name, current price, and percentage change.
Use green text/arrows for positive changes and red for negative. White text for labels.
Title: "Market Overview" in white bold text at the top.
Make it look like a Bloomberg terminal or financial dashboard style. Resolution should be high quality.
Do NOT include any watermarks or signatures.`;

  const outputPath = join(outputDir, "market-overview.png");
  return generateChartImage(prompt, outputPath);
}
