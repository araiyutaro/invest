import { escapeHtml, markdownToHtml, scoreColor, generateBaseStyles } from "./report-utils.js";
import type { MeetingResult, AnalystRound1Output, AnalystRound2Output, AnalystRound3Output } from "../meeting/types.js";

const AGENT_ROLE_NAMES: Record<string, string> = {
  fundamentals: "ファンダメンタルズアナリスト",
  tenbagger: "テンバガーハンター",
  macro: "マクロエコノミスト",
  technical: "テクニカルストラテジスト",
  "risk-manager": "リスクマネージャー",
};

function formatRound1Html(round1Results: ReadonlyArray<AnalystRound1Output>): string {
  if (round1Results.length === 0) return "<p>Round 1 データなし</p>";

  return round1Results.map((r) => {
    const picksHtml = r.picks.length > 0
      ? `<h4>推奨銘柄</h4><ul>${r.picks.map((p) =>
          `<li><strong>${escapeHtml(p.ticker)}</strong> [${escapeHtml(p.direction)}]: ${escapeHtml(p.rationale)}</li>`
        ).join("")}</ul>`
      : "";

    const highlightsHtml = r.highlights.length > 0
      ? `<h4>注目ポイント</h4><ul>${r.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}</ul>`
      : "";

    const risksHtml = r.risks.length > 0
      ? `<h4>リスク</h4><ul>${r.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>`
      : "";

    return `<div class="agent-card">
      <h3>${escapeHtml(r.agentRole)}</h3>
      <div class="analysis-section">${markdownToHtml(r.analysis)}</div>
      <h4>サマリー</h4>
      <p>${escapeHtml(r.summary)}</p>
      ${highlightsHtml}
      ${risksHtml}
      ${picksHtml}
      <h4>セクター見通し</h4>
      <p>${escapeHtml(r.sectorView)}</p>
    </div>`;
  }).join("\n");
}

function formatRound2Html(round2Results: ReadonlyArray<AnalystRound2Output>): string {
  if (round2Results.length === 0) return "<p>Round 2 データなし</p>";

  return round2Results.map((r) => {
    const agreementsHtml = r.agreements.length > 0
      ? `<h4>同意点</h4><ul>${r.agreements.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
      : "";

    const disagreementsHtml = r.disagreements.length > 0
      ? `<h4>異議点</h4><ul>${r.disagreements.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`
      : "";

    const roleName = AGENT_ROLE_NAMES[r.agentId] ?? r.agentId;

    return `<div class="discussion-card">
      <h3>${escapeHtml(roleName)}</h3>
      <div class="discussion-section">${markdownToHtml(r.discussion)}</div>
      <h4>コメント</h4>
      <p>${escapeHtml(r.comment)}</p>
      ${agreementsHtml}
      ${disagreementsHtml}
    </div>`;
  }).join("\n");
}

function formatRound3Html(round3Results: ReadonlyArray<AnalystRound3Output>): string {
  if (round3Results.length === 0) return "<p>Round 3 データなし</p>";

  return round3Results.map((r) => {
    const scoresHtml = r.scores.map((s) =>
      `<li><strong>${escapeHtml(s.ticker)}</strong>: <span style="color:${scoreColor(s.score)}">${s.score}/10</span> — ${escapeHtml(s.reason)}</li>`
    ).join("");

    return `<div class="agent-card">
      <h4>${escapeHtml(r.agentRole)}</h4>
      <ul>${scoresHtml}</ul>
    </div>`;
  }).join("\n");
}

export function generateMeetingMinutesHtml(
  result: MeetingResult,
  round1Results: ReadonlyArray<AnalystRound1Output>,
  round2Results: ReadonlyArray<AnalystRound2Output>,
  round3Results: ReadonlyArray<AnalystRound3Output>,
): string {
  const timestamp = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const styles = generateBaseStyles("#f59e0b");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting Minutes - ${escapeHtml(result.date)}</title>
  ${styles}
</head>
<body>
  <div class="container">
    <h1>Meeting Minutes - ${escapeHtml(result.date)}</h1>
    <p class="timestamp">Generated: ${timestamp}</p>
    <p>参加者: ${round1Results.length}名のアナリスト | Round 1→2→3 の時系列で記録</p>

    <hr>
    <h2>Round 1: 分析プレゼンテーション</h2>
    <p style="color: #888; font-size: 0.9rem; margin-bottom: 1rem;">各アナリストが独立して市場分析と銘柄推奨を提示</p>
    ${formatRound1Html(round1Results)}

    <hr>
    <h2>Round 2: ディスカッション</h2>
    <p style="color: #888; font-size: 0.9rem; margin-bottom: 1rem;">アナリスト間の相互参照による議論・反論・支持</p>
    ${formatRound2Html(round2Results)}

    <hr>
    <h2>Round 3: 銘柄スコアリング</h2>
    <p style="color: #888; font-size: 0.9rem; margin-bottom: 1rem;">議論を踏まえた各アナリストの最終スコア評価</p>
    ${formatRound3Html(round3Results)}
  </div>
</body>
</html>`;
}
