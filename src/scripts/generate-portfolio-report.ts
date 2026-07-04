import { escapeHtml, generateBaseStyles, safeHref, formatPublishedAtJst } from "./report-utils.js";
import { normalizeHoldingSymbol } from "../portfolio/holding-news.js";
import type { ResolvedHoldingNewsItem } from "../portfolio/holding-news.js";
import { computeWeeklyUrgencyRollup, formatDateKeyShort } from "../portfolio/urgency-rollup.js";
import type { WeeklyUrgencyRollup } from "../portfolio/urgency-rollup.js";
import { isValidDateKey } from "../portfolio/urgency-history.js";
import type { UrgencyHistoryFile } from "../portfolio/urgency-history.js";
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

/**
 * D-06/D-08/D-09/D-10/D-14: 直近7暦日の緊急フラグ・判断変更ロールアップセクションを描画する。
 * - D-08: 見出しは常に表示する（履歴が空でもセクション自体は省略しない）。
 * - D-09: 3段階フォールバック — (1) 履歴が0件、(2) 履歴はあるが窓内の動きが0件、
 *   (3) daysCovered<7 の部分集計（脚注付き）。いずれもエラーにしない。
 * - D-06/D-07: 日付は formatDateKeyShort（MM/DD、純粋文字列変換）で描画し、
 *   formatPublishedAtJst は使わない。symbol/nameJa/decision は escapeHtml を通す。
 * - D-14: このセクションは portfolioAnalysis の有無に関わらず描画される
 *   （呼び出し側で null 分岐にも同じ HTML を差し込む、フェイルソフト）。
 */
function formatWeeklyUrgencyRollupHtml(rollup: WeeklyUrgencyRollup, totalHistoryEntries: number): string {
  const heading = `<h2>今週の緊急・判断変更ロールアップ</h2>`;

  if (totalHistoryEntries === 0) {
    return `${heading}
    <div class="agent-card">
      <p style="color:#888;font-size:0.85rem;">まだ緊急フラグ・判断変更の履歴がありません（履歴は日次で蓄積されます）</p>
    </div>`;
  }

  const footnoteHtml = rollup.daysCovered < 7
    ? `<p style="color:#888;font-size:0.85rem;margin-top:0.4rem;">（過去${rollup.daysCovered}日分の履歴に基づく）</p>`
    : "";

  if (rollup.symbols.length === 0) {
    return `${heading}
    <div class="agent-card">
      <p style="color:#888;font-size:0.85rem;">今週は緊急フラグ・判断変更はありませんでした</p>
      ${footnoteHtml}
    </div>`;
  }

  const cards = rollup.symbols.map((s) => {
    // WR-03: 他の全ての動的文字列（symbol/nameJa/decision）と同様、日付も escapeHtml を
    // 通す（現状 isValidDateKey により数字とハイフンのみに限定されているため実害はないが、
    // このモジュール単独では検証できないクロスモジュール不変条件に依存させない defense in depth）。
    const urgentHtml = s.urgentDates.length > 0
      ? `<p style="color:#ef4444;font-size:0.9rem;font-weight:bold;margin:0.2rem 0;">⚠ 緊急フラグ: ${s.urgentDates.map((d) => escapeHtml(formatDateKeyShort(d))).join(", ")}</p>`
      : "";
    const changesHtml = s.decisionChanges
      .map((c) => `<p style="color:#f59e0b;font-size:0.9rem;font-weight:bold;margin:0.2rem 0;">判断変更: ${escapeHtml(formatDateKeyShort(c.date))} ${escapeHtml(c.from)} → ${escapeHtml(c.to)}</p>`)
      .join("\n");
    return `<div class="agent-card">
      <h4>${escapeHtml(s.symbol)}${s.nameJa ? ` -- ${escapeHtml(s.nameJa)}` : ""}</h4>
      ${urgentHtml}
      ${changesHtml}
    </div>`;
  }).join("\n");

  return `${heading}
    ${cards}
    ${footnoteHtml}`;
}

export function generatePortfolioReportHtml(
  result: MeetingResult,
  portfolioAnalysis: PortfolioAnalysis | null,
  resolvedHoldingNews: Record<string, ReadonlyArray<ResolvedHoldingNewsItem>> = {},
  urgencyHistory: UrgencyHistoryFile = {},
): string {
  const styles = generateBaseStyles("#10b981");
  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  // D-14: portfolioAnalysis の有無に関わらず算出する（null 分岐でもフェイルソフトで描画するため）
  // WR-02: totalHistoryEntries は isValidDateKey を通した有効な日付キーのみを数える
  // （"__proto__"/"not-a-date" 等の不正キーのみの history で誤って Tier2 を選んでしまうのを防ぐ）。
  const weeklyRollupHtml = formatWeeklyUrgencyRollupHtml(
    computeWeeklyUrgencyRollup(urgencyHistory, result.date),
    Object.keys(urgencyHistory).filter(isValidDateKey).length,
  );

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
    ${weeklyRollupHtml}
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
    ${weeklyRollupHtml}
    ${holdingEvaluationsHtml}
    ${rebalanceActionsHtml}
  </div>
</body>
</html>`;
}
