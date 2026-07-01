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

export interface VixDatum {
  readonly date: string; // YYYY-MM-DD
  readonly close: number;
}

export function renderVixLineChart(history: ReadonlyArray<VixDatum>): string {
  if (history.length === 0) {
    return `<div class="chart-empty">
      <p><strong>データ取得エラー</strong></p>
      <p>VIX推移データを取得できませんでした。次回のレポート生成をお待ちください。</p>
    </div>`;
  }

  const width = 600;
  const height = 200;
  const padding = { top: 10, right: 40, bottom: 20, left: 10 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const values = history.map((h) => h.close);
  const minV = Math.min(...values, 15); // ensure 20/30 thresholds stay visible
  const maxV = Math.max(...values, 35);
  const yFor = (v: number) =>
    padding.top + plotH - ((v - minV) / (maxV - minV)) * plotH;
  const xFor = (i: number) =>
    padding.left + (i / (history.length - 1 || 1)) * plotW;

  const points = history
    .map((h, i) => `${xFor(i)},${yFor(h.close)}`)
    .join(" ");
  const dots = history
    .map(
      (h, i) =>
        `<circle cx="${xFor(i)}" cy="${yFor(h.close)}" r="3" fill="#3b82f6"/>`,
    )
    .join("");

  const thresholdLine = (level: number) => `
    <line x1="${padding.left}" y1="${yFor(level)}" x2="${width - padding.right}" y2="${yFor(level)}"
          stroke="#6b7280" stroke-width="1" stroke-dasharray="4,4"/>
    <text x="${width - padding.right + 4}" y="${yFor(level) + 4}" font-size="13" fill="#6b7280">${level}</text>
  `;

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="VIX推移">
    ${thresholdLine(20)}
    ${thresholdLine(30)}
    <polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="2"/>
    ${dots}
    <text x="${padding.left}" y="${height - 4}" font-size="13" fill="#888">${escapeHtml(history[0]?.date ?? "")}</text>
    <text x="${width - padding.right}" y="${height - 4}" font-size="13" fill="#888" text-anchor="end">${escapeHtml(history[history.length - 1]?.date ?? "")}</text>
  </svg>`;
}
