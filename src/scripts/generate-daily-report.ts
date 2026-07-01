import { escapeHtml, markdownToHtml, scoreColor, verdictColor, generateBaseStyles } from "./report-utils.js";
import { renderSectorBarChart, renderVixLineChart } from "./report-charts.js";
import type { SectorDatum, VixDatum } from "./report-charts.js";
import type { MeetingResult, WebSearchResult, ReevaluationOutput } from "../meeting/types.js";

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

export function generateDailyReportHtml(
  result: MeetingResult,
  webSearchResults: ReadonlyArray<WebSearchResult>,
  reevalResults: ReadonlyArray<ReevaluationOutput>,
  marketData: {
    sectors: ReadonlyArray<SectorDatum>;
    vixHistory: ReadonlyArray<VixDatum>;
  } = { sectors: [], vixHistory: [] },
): string {
  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const styles = generateBaseStyles("#3b82f6");

  const marketSection = formatMarketOverviewHtml(result);
  const sectorChartSection = `<hr>
    <h2>セクターパフォーマンス</h2>
    <div class="chart-container">
      ${renderSectorBarChart(marketData.sectors)}
    </div>`;
  const vixChartSection = `<hr>
    <h2>VIX推移</h2>
    <div class="chart-container">
      ${renderVixLineChart(marketData.vixHistory)}
    </div>`;
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
  ${styles}
</head>
<body>
  <div class="container">
    <h1>Daily Investment Report - ${escapeHtml(result.date)}</h1>
    <p class="timestamp">Generated: ${timestamp}</p>
    ${marketSection}
    ${sectorChartSection}
    ${vixChartSection}
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

