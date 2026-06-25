import { escapeHtml, generateBaseStyles } from "./report-utils.js";
import type { MeetingResult } from "../meeting/types.js";

export function generatePortfolioReportHtml(result: MeetingResult): string {
  const styles = generateBaseStyles("#10b981");
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
    <div class="agent-card">
      <h2>Phase 7 で実装予定</h2>
      <p>以下の機能が追加される予定です:</p>
      <ul>
        <li>保有銘柄の個別評価（保持/買増/一部売却/全売却）</li>
        <li>Daily Report 推奨銘柄の新規組入候補評価</li>
        <li>リバランス提案（具体的なアクションアイテム）</li>
      </ul>
    </div>
  </div>
</body>
</html>`;
}
