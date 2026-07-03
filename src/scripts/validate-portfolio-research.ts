import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { webSearchResultSchema } from "../meeting/schemas.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const PORTFOLIO_RESEARCH_DIR = join(TMP_DIR, "portfolio-research");

export async function validate() {
  const files = (await readdir(PORTFOLIO_RESEARCH_DIR)).filter((f) => f.endsWith(".json"));
  let failed = 0;

  for (const file of files) {
    const symbol = file.replace(/\.json$/, "");
    try {
      const raw = await readFile(join(PORTFOLIO_RESEARCH_DIR, file), "utf-8");
      const data = JSON.parse(raw) as unknown;
      webSearchResultSchema.parse(data);
      console.log(`  OK: ${symbol}`);
    } catch (error) {
      failed += 1;
      console.log(`  FAIL: ${symbol} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`Validation complete: ${files.length - failed}/${files.length} passed`);

  if (failed > 0) {
    process.exit(1);
  }
}

validate().catch((error) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
