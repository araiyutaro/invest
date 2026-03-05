import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import type { MeetingRecord } from "../agents/index.js";

const REPORTS_DIR = join(import.meta.dirname, "../../reports");

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownToHtml(md: string): string {
  let html = escapeHtml(md);

  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  html = html.replace(
    /^\| (.+) \|$/gm,
    (_, content: string) => {
      const cells = content.split(" | ").map((c: string) => c.trim());
      const row = cells.map((c: string) => `<td>${c}</td>`).join("");
      return `<tr>${row}</tr>`;
    },
  );
  html = html.replace(/^\|[-| ]+\|$/gm, "");
  html = html.replace(/((?:<tr>.*<\/tr>\n?)+)/g, '<table>$1</table>');

  html = html.replace(/^---$/gm, "<hr>");

  html = html.replace(/\n{2,}/g, "\n</p>\n<p>\n");
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*(<h[1-4]>)/g, "$1");
  html = html.replace(/(<\/h[1-4]>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<table>)/g, "$1");
  html = html.replace(/(<\/table>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<hr>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

const HTML_STYLES = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif;
      background: #0f0f1a;
      color: #e0e0e0;
      line-height: 1.7;
      padding: 2rem;
    }
    .container { max-width: 960px; margin: 0 auto; }
    h1 {
      font-size: 1.8rem;
      color: #fff;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 0.5rem;
      margin-bottom: 1.5rem;
    }
    h2 {
      font-size: 1.4rem;
      color: #60a5fa;
      margin-top: 2rem;
      margin-bottom: 0.8rem;
      border-left: 4px solid #3b82f6;
      padding-left: 0.8rem;
    }
    h3 {
      font-size: 1.15rem;
      color: #93c5fd;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
    }
    h4 {
      font-size: 1rem;
      color: #a5b4fc;
      margin-top: 1.2rem;
      margin-bottom: 0.4rem;
    }
    p { margin-bottom: 0.8rem; }
    ul { list-style: none; padding-left: 0; margin-bottom: 1rem; }
    li {
      padding: 0.5rem 0.8rem;
      margin-bottom: 0.3rem;
      background: #1e1e2e;
      border-radius: 6px;
      border-left: 3px solid #3b82f6;
    }
    strong { color: #fbbf24; }
    hr {
      border: none;
      border-top: 1px solid #333;
      margin: 2rem 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      background: #1e1e2e;
      border-radius: 8px;
      overflow: hidden;
    }
    tr:first-child td {
      background: #2a2a3e;
      font-weight: bold;
      color: #93c5fd;
    }
    td {
      padding: 0.6rem 1rem;
      border-bottom: 1px solid #333;
      text-align: left;
    }
    .timestamp {
      color: #888;
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
    }
    .chart-section {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
      margin: 1.5rem 0;
    }
    .chart-section img {
      max-width: 100%;
      border-radius: 8px;
      border: 1px solid #333;
    }
    .agent-card {
      background: #1e1e2e;
      border-radius: 8px;
      padding: 1.2rem;
      margin-bottom: 1rem;
      border-left: 4px solid #6366f1;
    }
    .agent-card h4 { color: #a5b4fc; margin-top: 0; }
    .discussion-card {
      background: #1a1a28;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 0.8rem;
      border-left: 4px solid #f59e0b;
    }
    .discussion-card h4 { color: #fbbf24; margin-top: 0; }
  </style>
`;

function formatDailyReportHtml(
  record: MeetingRecord,
  chartImages: ReadonlyArray<string>,
): string {
  const timestamp = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });

  const chartHtml =
    chartImages.length > 0
      ? `<div class="chart-section">${chartImages.map((img) => `<img src="${basename(img)}" alt="Chart">`).join("\n")}</div>`
      : "";

  const reportBody = markdownToHtml(record.finalSummary);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Investment Report - ${record.date}</title>
  ${HTML_STYLES}
</head>
<body>
  <div class="container">
    <h1>Daily Investment Report - ${record.date}</h1>
    <p class="timestamp">Generated: ${timestamp}</p>
    ${chartHtml}
    <hr>
    ${reportBody}
  </div>
</body>
</html>`;
}

function formatMeetingMinutesHtml(
  record: MeetingRecord,
): string {
  const timestamp = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });

  let agentsHtml = "";
  let discussionHtml = "";

  const firstRound = record.rounds[0];
  if (firstRound) {
    for (const p of firstRound.presentations) {
      agentsHtml += `<div class="agent-card">
        <h4>${escapeHtml(p.agentRole)} (${escapeHtml(p.agentName)})</h4>
        ${markdownToHtml(p.analysis)}
      </div>`;
    }

    for (const d of firstRound.discussion) {
      discussionHtml += `<div class="discussion-card">
        <h4>${escapeHtml(d.agentName)}</h4>
        ${markdownToHtml(d.comment)}
      </div>`;
    }
  }

  const marketDataHtml = markdownToHtml(record.marketDataSummary);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting Minutes - ${record.date}</title>
  ${HTML_STYLES}
</head>
<body>
  <div class="container">
    <h1>Investment Team Meeting Minutes - ${record.date}</h1>
    <p class="timestamp">Generated: ${timestamp}</p>
    <hr>
    <h2>Market Data Summary</h2>
    ${marketDataHtml}
    <hr>
    <h2>Agent Analysis</h2>
    ${agentsHtml}
    <hr>
    <h2>Discussion</h2>
    ${discussionHtml}
  </div>
</body>
</html>`;
}

export async function saveReports(
  record: MeetingRecord,
  chartImages: ReadonlyArray<string> = [],
): Promise<{
  readonly minutesPath: string;
  readonly reportPath: string;
}> {
  const dateDir = join(REPORTS_DIR, record.date);
  await mkdir(dateDir, { recursive: true });

  const minutesPath = join(dateDir, "meeting-minutes.html");
  const reportPath = join(dateDir, "daily-report.html");

  const minutesContent = formatMeetingMinutesHtml(record);
  const reportContent = formatDailyReportHtml(record, chartImages);

  await Promise.all([
    writeFile(minutesPath, minutesContent, "utf-8"),
    writeFile(reportPath, reportContent, "utf-8"),
  ]);

  await updateIndex(record.date);

  return { minutesPath, reportPath };
}

async function updateIndex(date: string): Promise<void> {
  const indexPath = join(REPORTS_DIR, "index.html");

  try {
    const html = await readFile(indexPath, "utf-8");

    const entryHtml = `<li class="report-item">
        <div class="report-date">${date}</div>
        <div class="report-links">
          <a href="${date}/daily-report.html">Daily Report</a>
          <a href="${date}/meeting-minutes.html">Meeting Minutes</a>
        </div>
      </li>`;

    if (html.includes(`>${date}<`)) {
      return;
    }

    const updated = html.replace(
      "<!-- REPORT_ENTRIES -->",
      `<!-- REPORT_ENTRIES -->\n      ${entryHtml}`,
    );

    await writeFile(indexPath, updated, "utf-8");
  } catch {
    console.error("Failed to update index.html");
  }
}
