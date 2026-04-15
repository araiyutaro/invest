import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PortfolioReport } from "../portfolio/runner.js";

const REPORTS_DIR = join(import.meta.dirname, "../../docs");

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownToHtml(md: string): string {
  let html = escapeHtml(md);

  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  html = html.replace(
    /^\| (.+) \|$/gm,
    (_, content: string) => {
      const cells = content.split(" | ").map((c: string) => c.trim());
      const row = cells.map((c: string) => `<td>${c}</td>`).join("");
      return `<tr>${row}</tr>`;
    },
  );
  html = html.replace(/^\|[-| ]+\|$/gm, "");
  html = html.replace(/((?:<tr>.*<\/tr>\n?)+)/g, "<table>$1</table>");

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
      border-bottom: 2px solid #10b981;
      padding-bottom: 0.5rem;
      margin-bottom: 1.5rem;
    }
    h2 {
      font-size: 1.4rem;
      color: #34d399;
      margin-top: 2rem;
      margin-bottom: 0.8rem;
      border-left: 4px solid #10b981;
      padding-left: 0.8rem;
    }
    h3 {
      font-size: 1.15rem;
      color: #6ee7b7;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
    }
    h4 {
      font-size: 1rem;
      color: #a7f3d0;
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
      border-left: 3px solid #10b981;
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
      background: #1a3a2e;
      font-weight: bold;
      color: #6ee7b7;
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

function formatPortfolioReportHtml(report: PortfolioReport): string {
  const timestamp = new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });

  const portfolioDataHtml = markdownToHtml(report.portfolioSummary);
  const candidatesHtml = markdownToHtml(report.candidateRecommendations);
  const reportBody = markdownToHtml(report.finalReport);

  let agentsHtml = "";
  for (const a of report.analyses) {
    agentsHtml += `<div class="agent-card">
        <h4>${escapeHtml(a.agentRole)} (${escapeHtml(a.agentName)})</h4>
        ${markdownToHtml(a.analysis)}
      </div>`;
  }

  let discussionHtml = "";
  for (const d of report.discussion) {
    discussionHtml += `<div class="discussion-card">
        <h4>${escapeHtml(d.agentName)}</h4>
        ${markdownToHtml(d.comment)}
      </div>`;
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio Report - ${report.date}</title>
  ${HTML_STYLES}
</head>
<body>
  <div class="container">
    <h1>Portfolio Analysis Report - ${report.date}</h1>
    <p class="timestamp">Generated: ${timestamp}</p>
    <hr>
    <h2>Portfolio Holdings</h2>
    ${portfolioDataHtml}
    <hr>
    <h2>新規組み入れ候補（デイリーレポート由来）</h2>
    ${candidatesHtml}
    <hr>
    <h2>Final Report</h2>
    ${reportBody}
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

export async function savePortfolioReport(
  report: PortfolioReport,
): Promise<string> {
  const dateDir = join(REPORTS_DIR, report.date);
  await mkdir(dateDir, { recursive: true });

  const reportPath = join(dateDir, "portfolio-report.html");
  const content = formatPortfolioReportHtml(report);
  await writeFile(reportPath, content, "utf-8");

  await updatePortfolioIndex(report.date);

  return reportPath;
}

async function updatePortfolioIndex(date: string): Promise<void> {
  const indexPath = join(REPORTS_DIR, "portfolio.html");

  try {
    const html = await readFile(indexPath, "utf-8");

    if (html.includes(`>${date}<`)) {
      return;
    }

    const entryHtml = `<li class="report-item">
        <div class="report-date">${date}</div>
        <div class="report-links">
          <a href="${date}/portfolio-report.html">Portfolio Report</a>
        </div>
      </li>`;

    const updated = html.replace(
      "<!-- REPORT_ENTRIES -->",
      `<!-- REPORT_ENTRIES -->\n      ${entryHtml}`,
    );

    await writeFile(indexPath, updated, "utf-8");
  } catch {
    console.error("Failed to update portfolio.html");
  }
}
