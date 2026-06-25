import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PORTFOLIO_HOLDINGS } from "../portfolio/holdings.js";

const DOCS_DIR = join(import.meta.dirname, "../../docs");
const TMP_DIR = join(import.meta.dirname, "../../tmp");
const MARKER = "<!-- REPORT_ENTRIES -->";

async function getDate(): Promise<string> {
  const raw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const result = JSON.parse(raw) as { date: string };
  return result.date;
}

function buildIndexEntry(date: string): string {
  return `      <li class="report-item">
        <div class="report-date">${date}</div>
        <div class="report-links">
          <a href="${date}/daily-report.html">Daily Report</a>
          <a href="${date}/meeting-minutes.html">Meeting Minutes</a>
          <a href="${date}/portfolio-report.html">Portfolio Report</a>
        </div>
      </li>`;
}

function buildPortfolioEntry(date: string): string {
  return `      <li class="report-item">
        <div class="report-date">${date}</div>
        <div class="report-links">
          <a href="${date}/portfolio-report.html">Portfolio Report</a>
        </div>
      </li>`;
}

function buildHoldingSpans(): string {
  return PORTFOLIO_HOLDINGS.map((h) => `        <span>${h.symbol}</span>`).join("\n");
}

async function updateIndexHtml(date: string): Promise<void> {
  const filePath = join(DOCS_DIR, "index.html");
  const content = await readFile(filePath, "utf-8");

  if (content.includes(`<div class="report-date">${date}</div>`)) {
    console.log(`index.html: ${date} のエントリは既に存在します。スキップします。`);
    return;
  }

  const entry = buildIndexEntry(date);
  const updated = content.replace(MARKER, `${MARKER}\n${entry}`);
  await writeFile(filePath, updated, "utf-8");
  console.log(`index.html: ${date} のエントリを追加しました。`);
}

async function updatePortfolioHtml(date: string): Promise<void> {
  const filePath = join(DOCS_DIR, "portfolio.html");
  const content = await readFile(filePath, "utf-8");

  const withEntry = content.includes(`<div class="report-date">${date}</div>`)
    ? (() => {
        console.log(`portfolio.html: ${date} のエントリは既に存在します。スキップします。`);
        return content;
      })()
    : (() => {
        const entry = buildPortfolioEntry(date);
        console.log(`portfolio.html: ${date} のエントリを追加しました。`);
        return content.replace(MARKER, `${MARKER}\n${entry}`);
      })();

  const holdingsSpans = buildHoldingSpans();
  const updated = withEntry.replace(
    /(<div class="holdings-list">)[^]*?(<\/div>)/,
    `$1\n${holdingsSpans}\n      $2`,
  );

  await writeFile(filePath, updated, "utf-8");
  console.log("portfolio.html: ホールディングスリストを更新しました。");
}

async function main(): Promise<void> {
  const date = await getDate();
  console.log(`対象日付: ${date}`);
  await Promise.all([updateIndexHtml(date), updatePortfolioHtml(date)]);
}

main().catch((err) => {
  console.error("update-index failed:", err);
  process.exit(1);
});
