import { escapeHtml, scoreColor, verdictColor, generateBaseStyles, safeHref, formatPublishedAtJst } from "./report-utils.js";
import { normalizeHoldingSymbol } from "../portfolio/holding-news.js";
import type { ResolvedHoldingNewsItem } from "../portfolio/holding-news.js";
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

function formatHoldingNewsItemHtml(item: ResolvedHoldingNewsItem): string {
  const href = safeHref(item.url);
  const titleHtml = href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>`
    : escapeHtml(item.title);
  const badge = item.matchType !== "ticker" // D-07: name/alias一致のみ
    ? ` <span style="display:inline-block;background:#2a2a3e;color:#9ca3af;font-size:0.7rem;padding:0.15rem 0.4rem;margin-left:0.4rem;border-radius:999px;">社名一致</span>`
    : "";
  return `<li style="padding:0.4rem 0;border-top:1px solid #2a2a3e;background:transparent;border-radius:0;margin-bottom:0;">
      ${titleHtml}${badge}
      <p style="color:#888;font-size:0.85rem;margin:0.15rem 0 0;">${escapeHtml(item.source)} ・ ${escapeHtml(formatPublishedAtJst(item.publishedAt))}</p>
    </li>`;
}

function formatHoldingNewsSectionHtml(items: ReadonlyArray<ResolvedHoldingNewsItem>): string {
  // D-08: 見出しは常時表示。0件でもセクション自体は省略しない
  const heading = `<p style="font-size:0.85rem;font-weight:600;color:#a5b4fc;margin-bottom:0.4rem;">関連ニュース</p>`;
  if (items.length === 0) {
    return `<div style="margin-top:0.8rem;">${heading}<p style="color:#888;font-size:0.85rem;">本日の関連ニュースなし</p></div>`;
  }
  const rows = items.map(formatHoldingNewsItemHtml).join("\n");
  return `<div style="margin-top:0.8rem;">${heading}<ul style="list-style:none;padding-left:0;margin:0;">${rows}</ul></div>`;
}

/** urgent: true の銘柄に赤系「⚠ 緊急」バッジを表示する (D-16/UI-07)。false/未設定なら空文字。 */
function formatUrgentBadgeHtml(urgent: boolean): string {
  if (!urgent) return "";
  return ` <span style="display:inline-block;background:#ef4444;color:#fff;font-size:0.75rem;font-weight:bold;padding:0.15rem 0.5rem;margin-left:0.5rem;border-radius:999px;">⚠ 緊急</span>`;
}

/**
 * decisionChanged === true の銘柄にアンバー系「判断変更: {前日} → {当日}」バッジを表示する (D-17/UI-07)。
 * 条件は必ず `!== true` の早期returnにする — undefined（比較不能）と false（変化なし）を
 * どちらも非表示にする（truthyチェック禁止、D-14）。
 */
function formatDecisionChangedBadgeHtml(
  decisionChanged: boolean | undefined,
  previousDecision: string | undefined,
  decision: string,
): string {
  if (decisionChanged !== true) return "";
  return ` <span style="display:inline-block;background:#f59e0b;color:#1a1a28;font-size:0.75rem;font-weight:bold;padding:0.15rem 0.5rem;margin-left:0.5rem;border-radius:999px;">判断変更: ${escapeHtml(previousDecision ?? "?")} → ${escapeHtml(decision)}</span>`;
}

function formatHoldingEvaluationsHtml(
  holdings: ReadonlyArray<HoldingEvaluation>,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>>,
): string {
  if (holdings.length === 0) return "";

  const cards = holdings.map((h) => {
    const color = decisionColor(h.decision);
    const riskHtml = h.riskNote
      ? `<p style="color:#f59e0b;font-size:0.85rem;">リスク: ${escapeHtml(h.riskNote)}</p>`
      : "";
    const newsHtml = formatHoldingNewsSectionHtml(resolvedHoldingNews[normalizeHoldingSymbol(h.symbol)] ?? []); // Q2 RESOLVED: 参照側もnormalizeHoldingSymbolでキー一致（Pitfall 2 の silent 0件を構造的に防ぐ）
    const urgentBadge = formatUrgentBadgeHtml(h.urgent);
    const changedBadge = formatDecisionChangedBadgeHtml(h.decisionChanged, h.previousDecision, h.decision);
    // border-left-color は decisionColor(h.decision) のまま — バッジ有無で上書きしない (D-18)
    return `<div class="agent-card news-card" style="border-left-color:${color};">
      <h4>${escapeHtml(h.symbol)}${h.nameJa ? ` -- ${escapeHtml(h.nameJa)}` : ""}${urgentBadge}${changedBadge} <span style="float:right;color:${color};font-weight:bold;">${escapeHtml(h.decision)}</span></h4>
      <p>${escapeHtml(h.rationale)}</p>
      ${riskHtml}
      ${newsHtml}
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

export function generatePortfolioReportHtml(
  result: MeetingResult,
  portfolioAnalysis: PortfolioAnalysis | null,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> = {},
): string {
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
  const holdingEvaluationsHtml = formatHoldingEvaluationsHtml(portfolioAnalysis.holdings, resolvedHoldingNews);
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
