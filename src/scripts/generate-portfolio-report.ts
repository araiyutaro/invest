import { escapeHtml, scoreColor, verdictColor, generateBaseStyles } from "./report-utils.js";
import type { MeetingResult, PortfolioAnalysis, HoldingEvaluation } from "../meeting/types.js";

function decisionColor(decision: string): string {
  switch (decision) {
    case "保持": return "#10b981";
    case "買増": return "#3b82f6";
    case "一部売却": return "#f59e0b";
    case "全売却": return "#ef4444";
    default: return "#10b981";
  }
}

function formatOverallCommentHtml(comment: string): string {
  return `<h2>総括コメント</h2>
    <div class="agent-card">
      <p>${escapeHtml(comment)}</p>
    </div>`;
}

function formatHoldingEvaluationsHtml(holdings: ReadonlyArray<HoldingEvaluation>): string {
  if (holdings.length === 0) return "";

  const cards = holdings.map((h) => {
    const color = decisionColor(h.decision);
    const riskHtml = h.riskNote
      ? `<p style="color:#f59e0b;font-size:0.85rem;">リスク: ${escapeHtml(h.riskNote)}</p>`
      : "";
    return `<div class="agent-card" style="border-left-color:${color};">
      <h4>${escapeHtml(h.symbol)}${h.nameJa ? ` -- ${escapeHtml(h.nameJa)}` : ""} <span style="float:right;color:${color};font-weight:bold;">${escapeHtml(h.decision)}</span></h4>
      <p>${escapeHtml(h.rationale)}</p>
      ${riskHtml}
    </div>`;
  }).join("\n");

  return `<h2>保有銘柄 個別評価</h2>
    ${cards}`;
}

function formatRebalanceActionsHtml(actions: ReadonlyArray<string>): string {
  if (actions.length === 0) return "";

  const items = actions.map((a) => `<li>${escapeHtml(a)}</li>`).join("\n");
  return `<h2>リバランス提案</h2>
    <ul>${items}</ul>`;
}

function formatNewCandidatesHtml(result: MeetingResult): string {
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

  return `<h2>新規組入候補（Daily Report より転載）</h2>
    <p>Daily Reportのアナリストミーティングで推奨された銘柄です。スコアリングマトリクスを参考に投資判断してください。</p>
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

export function generatePortfolioReportHtml(result: MeetingResult, portfolioAnalysis: PortfolioAnalysis | null): string {
  const styles = generateBaseStyles("#10b981");
  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

  const newCandidatesHtml = formatNewCandidatesHtml(result);

  if (portfolioAnalysis === null) {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio Report - ${escapeHtml(result.date)}</title>
  ${styles}
</head>
<body>
  <div class="container">
    <h1>Portfolio Report - ${escapeHtml(result.date)}</h1>
    <p class="timestamp">生成日時: ${timestamp}</p>
    <div class="agent-card">
      <p>本日のポートフォリオ分析は生成されませんでした。</p>
    </div>
    ${newCandidatesHtml}
  </div>
</body>
</html>`;
  }

  const overallCommentHtml = formatOverallCommentHtml(portfolioAnalysis.overallComment);
  const holdingEvaluationsHtml = formatHoldingEvaluationsHtml(portfolioAnalysis.holdings);
  const rebalanceActionsHtml = formatRebalanceActionsHtml(portfolioAnalysis.rebalanceActions);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio Report - ${escapeHtml(result.date)}</title>
  ${styles}
</head>
<body>
  <div class="container">
    <h1>Portfolio Report - ${escapeHtml(result.date)}</h1>
    <p class="timestamp">生成日時: ${timestamp}</p>
    ${overallCommentHtml}
    ${holdingEvaluationsHtml}
    ${rebalanceActionsHtml}
    ${newCandidatesHtml}
  </div>
</body>
</html>`;
}
