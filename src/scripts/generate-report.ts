import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { validateMeetingResult, validateWebSearchResult, validateReevaluationOutput } from "../meeting/schemas.js";
import type { MeetingResult, WebSearchResult, ReevaluationOutput } from "../meeting/types.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const REPORTS_DIR = join(import.meta.dirname, "../../reports");

export function escapeHtml(text: string): string {
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

function scoreColor(score: number): string {
  if (score >= 8) return "#10b981";
  if (score >= 6) return "#60a5fa";
  if (score >= 4) return "#f59e0b";
  return "#ef4444";
}

function verdictColor(verdict: string): string {
  switch (verdict) {
    case "強気": return "#10b981";
    case "弱気": return "#ef4444";
    default: return "#f59e0b";
  }
}

function formatMarketOverviewHtml(result: MeetingResult): string {
  const trendColor = result.marketOverview.trend === "上昇" ? "#10b981"
    : result.marketOverview.trend === "下降" ? "#ef4444"
    : "#f59e0b";

  const indicesHtml = result.marketOverview.keyIndices.map((idx) => {
    const color = idx.changePercent >= 0 ? "#10b981" : "#ef4444";
    const sign = idx.changePercent >= 0 ? "+" : "";
    return `<li>${escapeHtml(idx.name)}: <span style="color:${color}">${sign}${idx.changePercent}%</span></li>`;
  }).join("\n");

  return `<hr>
    <h2>市場概況</h2>
    <div class="agent-card">
      <p><strong>トレンド:</strong> <span style="color:${trendColor}">${escapeHtml(result.marketOverview.trend)}</span></p>
      <p>${escapeHtml(result.marketOverview.summary)}</p>
      <ul>${indicesHtml}</ul>
    </div>`;
}

function formatSectorRecommendationsHtml(result: MeetingResult): string {
  if (result.sectorRecommendations.length === 0) return "";

  const rows = result.sectorRecommendations.map((s) => {
    const color = verdictColor(s.outlook);
    return `<tr>
      <td>${s.rank}</td>
      <td><strong>${escapeHtml(s.sector)}</strong></td>
      <td>${escapeHtml(s.rationale)}</td>
      <td style="color:${color};font-weight:bold;">${escapeHtml(s.outlook)}</td>
    </tr>`;
  }).join("\n");

  return `<hr>
    <h2>セクター推奨ランキング</h2>
    <table>
      <tr>
        <td>ランク</td>
        <td>セクター</td>
        <td>理由</td>
        <td>見通し</td>
      </tr>
      ${rows}
    </table>`;
}

function formatHighlightedStocksHtml(result: MeetingResult): string {
  if (result.highlightedStocks.length === 0) return "";

  const rows = result.highlightedStocks.map((s) => {
    const agentCells = s.agentScores
      .map((a) => `<td style="text-align:center;color:${scoreColor(a.score)}"><strong>${a.score}</strong><br><span style="font-size:0.75rem;color:#888;">${escapeHtml(a.reason)}</span></td>`)
      .join("");

    return `<tr>
      <td><strong>${escapeHtml(s.ticker)}</strong><br><span style="font-size:0.8rem;color:#888;">${escapeHtml(s.summary)}</span></td>
      ${agentCells}
      <td style="text-align:center;"><strong style="color:${scoreColor(s.averageScore)}">${s.averageScore}</strong></td>
      <td style="text-align:center;"><span style="color:${verdictColor(s.verdict)};font-weight:bold;">${escapeHtml(s.verdict)}</span></td>
    </tr>`;
  }).join("\n");

  const agentHeaders = result.highlightedStocks[0]?.agentScores
    .map((a) => `<td style="text-align:center;font-size:0.8rem;">${escapeHtml(a.agentRole)}</td>`)
    .join("") ?? "";

  return `<hr>
    <h2>注目銘柄スコアリングマトリクス</h2>
    <p style="color: #888; font-size: 0.9rem; margin-bottom: 1rem;">各エージェントが10段階評価した結果です。平均7以上=強気、4〜6.9=中立、4未満=弱気。</p>
    <table>
      <tr>
        <td style="background:#2a2a3e;font-weight:bold;color:#93c5fd;">銘柄</td>
        ${agentHeaders.replace(/(<td)/g, '$1 style="background:#2a2a3e;font-weight:bold;color:#93c5fd;"')}
        <td style="background:#2a2a3e;font-weight:bold;color:#93c5fd;text-align:center;">平均</td>
        <td style="background:#2a2a3e;font-weight:bold;color:#93c5fd;text-align:center;">判定</td>
      </tr>
      ${rows}
    </table>`;
}

function formatWebSearchHtml(results: ReadonlyArray<WebSearchResult>): string {
  if (results.length === 0) return "";

  let html = "";
  for (const r of results) {
    const positivesHtml = r.positiveFindings.length > 0
      ? `<p><strong>ポジティブ:</strong></p><ul>${r.positiveFindings.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`
      : "";
    const negativesHtml = r.negativeFindings.length > 0
      ? `<p><strong>ネガティブ:</strong></p><ul>${r.negativeFindings.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`
      : "";
    const articlesHtml = r.keyArticles.length > 0
      ? `<p><strong>注目記事:</strong></p><ul>${r.keyArticles.map((a) => `<li><strong>${escapeHtml(a.title)}</strong>: ${escapeHtml(a.summary)}</li>`).join("")}</ul>`
      : "";

    html += `<div class="agent-card" style="border-left-color: #10b981;">
      <h4>${escapeHtml(r.ticker)}</h4>
      <p>${escapeHtml(r.researchSummary)}</p>
      ${positivesHtml}
      ${negativesHtml}
      ${articlesHtml}
    </div>`;
  }

  return `<hr>
    <h2>WebSearch リサーチ結果</h2>
    <p style="color: #888; font-size: 0.9rem; margin-bottom: 1rem;">注目銘柄に関する最新の定性情報をWebリサーチした結果です。</p>
    ${html}`;
}

function formatReevalHtml(reevals: ReadonlyArray<ReevaluationOutput>): string {
  if (reevals.length === 0) return "";

  let html = "";
  for (const r of reevals) {
    const changedItems = r.reevaluations.filter((e) => e.changed);
    if (changedItems.length === 0) continue;

    const itemsHtml = changedItems.map((e) => `<li>
      <strong>${escapeHtml(e.ticker)}</strong>:
      <span style="color:${scoreColor(e.originalScore)}">${e.originalScore}</span>
      → <span style="color:${scoreColor(e.revisedScore)}">${e.revisedScore}</span>
      <br><span style="font-size:0.85rem;color:#aaa;">${escapeHtml(e.comment)}</span>
    </li>`).join("");

    if (itemsHtml) {
      html += `<div class="agent-card" style="border-left-color: #f59e0b;">
        <h4>${escapeHtml(r.agentRole)}</h4>
        <ul>${itemsHtml}</ul>
      </div>`;
    }
  }

  if (!html) return "";

  return `<hr>
    <h2>再評価ラウンド結果（WebSearch後）</h2>
    <p style="color: #888; font-size: 0.9rem; margin-bottom: 1rem;">WebSearchリサーチ結果を踏まえて各アナリストがスコアを再評価した結果です。</p>
    ${html}`;
}

function formatRiskWarningsHtml(result: MeetingResult): string {
  if (result.riskWarnings.length === 0) return "";

  const warningColor = (severity: string): string => {
    switch (severity) {
      case "高": return "#ef4444";
      case "中": return "#f59e0b";
      default: return "#10b981";
    }
  };

  const items = result.riskWarnings.map((w) =>
    `<li><span style="color:${warningColor(w.severity)};font-weight:bold;">[${escapeHtml(w.severity)}]</span> ${escapeHtml(w.description)}</li>`,
  ).join("\n");

  return `<hr>
    <h2>リスク警告</h2>
    <ul>${items}</ul>`;
}

function formatActionItemsHtml(result: MeetingResult): string {
  if (result.actionItems.length === 0) return "";

  const items = result.actionItems.map((item) =>
    `<li>${escapeHtml(item)}</li>`,
  ).join("\n");

  return `<hr>
    <h2>アクションアイテム</h2>
    <ul>${items}</ul>`;
}

function formatWeeklyEventsHtml(result: MeetingResult): string {
  if (result.weeklyEvents.length === 0) return "";

  const impactColor = (impact: string): string => {
    switch (impact) {
      case "高": return "#ef4444";
      case "中": return "#f59e0b";
      default: return "#10b981";
    }
  };

  const rows = result.weeklyEvents.map((e) =>
    `<tr>
      <td>${escapeHtml(e.date)}</td>
      <td>${escapeHtml(e.event)}</td>
      <td style="color:${impactColor(e.impact)};font-weight:bold;">${escapeHtml(e.impact)}</td>
    </tr>`,
  ).join("\n");

  return `<hr>
    <h2>週間注目イベント</h2>
    <table>
      <tr>
        <td>日付</td>
        <td>イベント</td>
        <td>インパクト</td>
      </tr>
      ${rows}
    </table>`;
}

export function generateHtml(
  result: MeetingResult,
  webSearchResults: ReadonlyArray<WebSearchResult>,
  reevalResults: ReadonlyArray<ReevaluationOutput>,
): string {
  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  const marketSection = formatMarketOverviewHtml(result);
  const sectorSection = formatSectorRecommendationsHtml(result);
  const scoringSection = formatHighlightedStocksHtml(result);
  const webSearchSection = formatWebSearchHtml(webSearchResults);
  const reevalSection = formatReevalHtml(reevalResults);
  const riskSection = formatRiskWarningsHtml(result);
  const actionSection = formatActionItemsHtml(result);
  const weeklySection = formatWeeklyEventsHtml(result);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Investment Report - ${escapeHtml(result.date)}</title>
  ${HTML_STYLES}
</head>
<body>
  <div class="container">
    <h1>Daily Investment Report - ${escapeHtml(result.date)}</h1>
    <p class="timestamp">Generated: ${timestamp}</p>
    ${marketSection}
    ${sectorSection}
    ${scoringSection}
    ${webSearchSection}
    ${reevalSection}
    ${riskSection}
    ${actionSection}
    ${weeklySection}
    <hr>
    <h2>インデックス投資家へのアドバイス</h2>
    <div class="agent-card">
      <p>${escapeHtml(result.indexInvestorAdvice)}</p>
    </div>
  </div>
</body>
</html>`;
}

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

export async function main(): Promise<void> {
  console.log("レポート生成開始...");
  const raw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const meetingResult = validateMeetingResult(JSON.parse(raw) as unknown);
  const webSearchResults = await loadWebSearchResults();
  const reevalResults = await loadReevalResults();
  const html = generateHtml(meetingResult, webSearchResults, reevalResults);
  const dateDir = join(REPORTS_DIR, meetingResult.date);
  await mkdir(dateDir, { recursive: true });
  const reportPath = join(dateDir, "daily-report.html");
  await writeFile(reportPath, html, "utf-8");
  console.log("レポート生成完了: reports/" + meetingResult.date + "/daily-report.html");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
