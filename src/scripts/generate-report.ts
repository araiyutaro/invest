import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { validateMeetingResult, validateWebSearchResult, validateReevaluationOutput } from "../meeting/schemas.js";
import type { MeetingResult, WebSearchResult, ReevaluationOutput, PortfolioAnalysis } from "../meeting/types.js";
import { generateDailyReportHtml } from "./generate-daily-report.js";
import { generateMeetingMinutesHtml } from "./generate-meeting-minutes.js";
import { generatePortfolioReportHtml } from "./generate-portfolio-report.js";
import { loadRound1Results, loadRound2Results, loadRound3Results, loadPortfolioAnalysis } from "./report-data-loaders.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DOCS_DIR = join(import.meta.dirname, "../../docs");

async function loadWebSearchResults(): Promise<ReadonlyArray<WebSearchResult>> {
  const websearchDir = join(TMP_DIR, "websearch");
  try {
    const files = await readdir(websearchDir);
    const results = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const raw = await readFile(join(websearchDir, f), "utf-8");
            return validateWebSearchResult(JSON.parse(raw) as unknown);
          } catch {
            return null;
          }
        }),
    );
    return results.filter((r): r is WebSearchResult => r !== null);
  } catch {
    return [];
  }
}

async function loadReevalResults(): Promise<ReadonlyArray<ReevaluationOutput>> {
  const reevalDir = join(TMP_DIR, "reeval");
  try {
    const files = await readdir(reevalDir);
    const results = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const raw = await readFile(join(reevalDir, f), "utf-8");
            return validateReevaluationOutput(JSON.parse(raw) as unknown);
          } catch {
            return null;
          }
        }),
    );
    return results.filter((r): r is ReevaluationOutput => r !== null);
  } catch {
    return [];
  }
}

export function generateHtml(
  result: MeetingResult,
  webSearchResults: ReadonlyArray<WebSearchResult>,
  reevalResults: ReadonlyArray<ReevaluationOutput>,
): string {
  return generateDailyReportHtml(result, webSearchResults, reevalResults);
}

export async function main(): Promise<void> {
  console.log("レポート生成開始...");

  const raw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const meetingResult = validateMeetingResult(JSON.parse(raw) as unknown);

  const [webSearchResults, reevalResults, round1Results, round2Results, round3Results, portfolioAnalysis] = await Promise.all([
    loadWebSearchResults(),
    loadReevalResults(),
    loadRound1Results(),
    loadRound2Results(),
    loadRound3Results(),
    loadPortfolioAnalysis(),
  ]);

  const dateDir = join(DOCS_DIR, meetingResult.date);
  await mkdir(dateDir, { recursive: true });

  const dailyHtml = generateDailyReportHtml(meetingResult, webSearchResults, reevalResults);
  const minutesHtml = generateMeetingMinutesHtml(meetingResult, round1Results, round2Results, round3Results);
  const portfolioHtml = generatePortfolioReportHtml(meetingResult, portfolioAnalysis);

  await Promise.all([
    writeFile(join(dateDir, "daily-report.html"), dailyHtml, "utf-8"),
    writeFile(join(dateDir, "meeting-minutes.html"), minutesHtml, "utf-8"),
    writeFile(join(dateDir, "portfolio-report.html"), portfolioHtml, "utf-8"),
  ]);

  console.log("レポート生成完了: docs/" + meetingResult.date + "/");
  console.log("  - daily-report.html");
  console.log("  - meeting-minutes.html");
  console.log("  - portfolio-report.html");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
