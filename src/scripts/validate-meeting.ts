import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateMeetingResult } from "../meeting/schemas.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");

export async function validate() {
  const filePath = join(TMP_DIR, "meeting-result.json");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as unknown;
  const result = validateMeetingResult(data);
  console.log("Validation passed");
  console.log(`  注目銘柄: ${result.highlightedStocks.length}件`);
  console.log(`  リスク警告: ${result.riskWarnings.length}件`);
  console.log(`  スコア対象: ${result.roundSummary.scoredTickers.length}銘柄`);
  console.log(`  アクションアイテム: ${result.actionItems.length}件`);
  return result;
}

validate().catch((error) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
