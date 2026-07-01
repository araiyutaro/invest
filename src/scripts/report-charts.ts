import { escapeHtml } from "./report-utils.js";

export interface SectorDatum {
  readonly sector: string;
  readonly changePercent: number;
}

export function renderSectorBarChart(
  sectors: ReadonlyArray<SectorDatum>,
): string {
  if (sectors.length === 0) {
    return `<div class="chart-empty">
      <p><strong>データ取得エラー</strong></p>
      <p>セクターパフォーマンスデータを取得できませんでした。次回のレポート生成をお待ちください。</p>
    </div>`;
  }

  const sorted = [...sectors].sort(
    (a, b) => b.changePercent - a.changePercent,
  );
  const maxAbs = Math.max(
    ...sorted.map((s) => Math.abs(s.changePercent)),
    1,
  );
  const barHeight = 24;
  const gap = 8;
  const rowHeight = barHeight + gap;
  const svgHeight = sorted.length * rowHeight;
  const chartWidth = 400; // viewBox unit; scales via width:100%
  const labelWidth = 140;
  const barAreaWidth = chartWidth - labelWidth;
  const centerX = labelWidth + barAreaWidth / 2;

  const bars = sorted
    .map((s, i) => {
      const y = i * rowHeight;
      const barWidth =
        (Math.abs(s.changePercent) / maxAbs) * (barAreaWidth / 2 - 4);
      const color = s.changePercent >= 0 ? "#10b981" : "#ef4444";
      const x = s.changePercent >= 0 ? centerX : centerX - barWidth;
      const sign = s.changePercent >= 0 ? "+" : "";
      return `
      <text x="${labelWidth - 8}" y="${y + barHeight / 2 + 4}" font-size="13" fill="#e0e0e0" text-anchor="end">${escapeHtml(s.sector)}</text>
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="2"/>
      <text x="${s.changePercent >= 0 ? x + barWidth + 4 : x - 4}" y="${y + barHeight / 2 + 4}" font-size="13" fill="#e0e0e0" text-anchor="${s.changePercent >= 0 ? "start" : "end"}">${sign}${s.changePercent.toFixed(2)}%</text>
    `;
    })
    .join("");

  return `<svg viewBox="0 0 ${chartWidth} ${svgHeight}" width="100%" role="img" aria-label="セクターパフォーマンス">
    <line x1="${centerX}" y1="0" x2="${centerX}" y2="${svgHeight}" stroke="#333" stroke-width="1"/>
    ${bars}
  </svg>`;
}
