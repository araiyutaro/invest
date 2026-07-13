import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { fetchTechnicalSnapshots } from "../data/technicals.js";

/**
 * ティッカーリストのJSON入力を解釈する。
 * 対応形式: {tickers: string[]} / {highlightedStocks: [{ticker}]} / string[]
 */
export function parseTickerList(input: unknown): ReadonlyArray<string> {
  const raw = Array.isArray(input)
    ? input
    : input !== null && typeof input === "object" && "tickers" in input
      ? (input as { tickers: unknown }).tickers
      : input !== null &&
          typeof input === "object" &&
          "highlightedStocks" in input
        ? (
            (input as { highlightedStocks: unknown })
              .highlightedStocks as ReadonlyArray<unknown>
          )
        : [];
  if (!Array.isArray(raw)) return [];
  const tickers = raw
    .map((item) =>
      typeof item === "string"
        ? item
        : item !== null &&
            typeof item === "object" &&
            "ticker" in item &&
            typeof (item as { ticker: unknown }).ticker === "string"
          ? (item as { ticker: string }).ticker
          : "",
    )
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return Array.from(new Set(tickers));
}

async function main(outputPath: string) {
  const inputPath = process.argv[2] ?? "tmp/moderator-tickers.json";

  let tickers: ReadonlyArray<string> = [];
  try {
    const parsed = JSON.parse(await readFile(inputPath, "utf-8")) as unknown;
    tickers = parseTickerList(parsed);
  } catch (error) {
    console.error(`入力ファイル読み込み失敗 (${inputPath}):`, error);
  }

  console.log(`テクニカルデータ収集: ${tickers.length}銘柄`);
  const snapshots = await fetchTechnicalSnapshots(tickers);

  const failed = tickers.filter(
    (t) => !snapshots.some((s) => s.symbol === t),
  );
  if (failed.length > 0) {
    console.log(`⚠ 取得失敗: ${failed.join(", ")}`);
  }

  await writeFile(
    outputPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), snapshots },
      null,
      2,
    ),
    "utf-8",
  );

  for (const s of snapshots) {
    const rsi = s.rsi14 !== null ? `RSI ${Math.round(s.rsi14)}` : "RSI n/a";
    console.log(
      `  ${s.symbol}: $${s.price.toFixed(2)} (${s.asOf}) ${rsi} — ${s.trendLabel}`,
    );
  }
  console.log(
    `テクニカルデータ収集完了: ${snapshots.length}/${tickers.length}銘柄 → ${outputPath}`,
  );
}

const isDirectRun = process.argv[1]?.endsWith("collect-technicals.ts");
if (isDirectRun) {
  const outputPath = process.argv[3] ?? "tmp/technicals.json";
  main(outputPath).catch(async (error) => {
    console.error("Fatal error:", error);
    // fail-soft: 後続ステップが常に有効なJSONを読めるよう空スナップショットを書き込む
    try {
      await writeFile(
        outputPath,
        JSON.stringify({ generatedAt: new Date().toISOString(), snapshots: [] }),
        "utf-8",
      );
    } catch {
      // 出力先にも書けない場合は invest.md 側のフォールバック手順に委ねる
    }
    process.exit(1);
  });
}
