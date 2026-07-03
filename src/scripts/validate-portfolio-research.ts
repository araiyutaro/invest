import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { webSearchResultSchema } from "../meeting/schemas.js";
import { PORTFOLIO_HOLDINGS } from "../portfolio/holdings.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const PORTFOLIO_RESEARCH_DIR = join(TMP_DIR, "portfolio-research");

export async function validate() {
  const files = (await readdir(PORTFOLIO_RESEARCH_DIR)).filter((f) => f.endsWith(".json"));
  // D-11の契約: 失敗銘柄も含め12銘柄全てのファイルが必ず存在する。
  // ディレクトリ内の実在ファイルではなく PORTFOLIO_HOLDINGS 由来の期待リストを検査することで、
  // ファイル不足（リサーチ全滅による0ファイルを含む）を偽陽性なく失敗として検知する。
  const expected = PORTFOLIO_HOLDINGS.map((h) => `${h.symbol.replaceAll("/", "-")}.json`);
  let failed = 0;

  for (const file of expected) {
    const symbol = file.replace(/\.json$/, "");
    if (!files.includes(file)) {
      failed += 1;
      console.log(`  FAIL: ${symbol} — ファイルが存在しません`);
      continue;
    }
    try {
      const raw = await readFile(join(PORTFOLIO_RESEARCH_DIR, file), "utf-8");
      const data = JSON.parse(raw) as unknown;
      const parsed = webSearchResultSchema.parse(data);
      // ファイル名の symbol と JSON 内の ticker を突合（Pitfall 5: エンティティ衝突対策）。
      // ファイル名は `/` を `-` に置換する規約（Step 3a 踏襲）のため、比較前に同じ正規化を適用する。
      if (parsed.ticker.replaceAll("/", "-") !== symbol) {
        throw new Error(`ticker不一致: ファイル=${symbol}, JSON=${parsed.ticker}`);
      }
      console.log(`  OK: ${symbol}`);
    } catch (error) {
      failed += 1;
      console.log(`  FAIL: ${symbol} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`Validation complete: ${expected.length - failed}/${expected.length} passed`);

  if (failed > 0) {
    process.exit(1);
  }
}

validate().catch((error) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
