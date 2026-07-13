import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PORTFOLIO_HOLDINGS } from "../portfolio/holdings.js";

const AGENTS = [
  "fundamentals",
  "tenbagger",
  "macro",
  "technical",
  "risk-manager",
] as const;

// ティッカーと誤認しやすい一般略語（invest.md Step 2b から移植し、金融・市場用語を拡充）
const COMMON_WORDS = new Set([
  "AI", "US", "IT", "GDP", "FRB", "BOJ", "CPI", "PMI", "EV", "IPO", "ETF",
  "PE", "PB", "CF", "MoS", "VIX", "OK", "NO", "BY", "IN", "AT", "ON", "TO",
  "AS", "OF", "OR", "IF", "IS", "BE", "DO", "GO",
  "FCF", "MACD", "RSI", "EPS", "PER", "PBR", "ROE", "ROIC", "YOY", "QOQ",
  "TAM", "CAGR", "ATH", "FDA", "SEC", "FOMC", "OPEC", "GAAP", "HALEU",
  // 通貨・商品・市況の一般略語（picksでの明示指名はこのリストを経由しないため影響なし）
  "WTI", "USD", "JPY", "EUR", "GBP", "SPA", "TOPIX", "NISA",
]);

interface AgentPick {
  readonly ticker?: unknown;
}

/**
 * Round 1 の各エージェント出力から候補ティッカーを抽出する。
 * picks配列を優先し、summary/highlights/sectorViewの本文からも正規表現で補完する。
 * ポートフォリオ保有銘柄と一般略語は除外する。
 */
export function extractCandidateTickers(
  agentOutputs: ReadonlyArray<unknown>,
  portfolioSymbols: ReadonlySet<string>,
): ReadonlyArray<string> {
  const tickerSet = new Set<string>();

  for (const output of agentOutputs) {
    if (output === null || typeof output !== "object") continue;
    const data = output as {
      picks?: ReadonlyArray<AgentPick>;
      summary?: unknown;
      highlights?: ReadonlyArray<unknown>;
      sectorView?: unknown;
    };

    if (Array.isArray(data.picks)) {
      for (const pick of data.picks) {
        if (
          typeof pick?.ticker === "string" &&
          pick.ticker.trim().length > 0 &&
          pick.ticker !== "UNKNOWN"
        ) {
          tickerSet.add(pick.ticker.trim());
        }
      }
    }

    const texts = [
      typeof data.summary === "string" ? data.summary : "",
      ...(Array.isArray(data.highlights)
        ? data.highlights.filter((h): h is string => typeof h === "string")
        : []),
      typeof data.sectorView === "string" ? data.sectorView : "",
    ].join(" ");

    for (const m of texts.matchAll(/\b([A-Z]{2,5})\b/g)) {
      if (!COMMON_WORDS.has(m[1])) tickerSet.add(m[1]);
    }
    for (const m of texts.matchAll(/(\d{4})\.T\b/g)) {
      tickerSet.add(`${m[1]}.T`);
    }
  }

  return Array.from(tickerSet).filter((t) => !portfolioSymbols.has(t));
}

async function main() {
  const roundDir = join(import.meta.dirname, "../../tmp/round-1");
  const outputPath = join(
    import.meta.dirname,
    "../../tmp/moderator-tickers.json",
  );

  const outputs = await Promise.all(
    AGENTS.map(async (agent) => {
      try {
        return JSON.parse(
          await readFile(join(roundDir, `${agent}.json`), "utf-8"),
        ) as unknown;
      } catch {
        return null;
      }
    }),
  );

  const portfolioSymbols = new Set(PORTFOLIO_HOLDINGS.map((h) => h.symbol));
  const tickers = extractCandidateTickers(outputs, portfolioSymbols);

  await writeFile(outputPath, JSON.stringify({ tickers }, null, 2), "utf-8");
  console.log(
    `ティッカー抽出: ${tickers.length}銘柄を特定（ポートフォリオ保有銘柄は除外済み）`,
  );
  console.log(tickers.join(", "));
}

const isDirectRun = process.argv[1]?.endsWith("extract-tickers.ts");
if (isDirectRun) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
