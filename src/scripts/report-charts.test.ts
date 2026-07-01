import { describe, it, expect } from "vitest";
import { renderSectorBarChart, renderVixLineChart } from "./report-charts.js";

describe("report-charts", () => {
  describe("renderSectorBarChart (sector)", () => {
    it("sorts sectors descending by changePercent and colors bars green/red", () => {
      const output = renderSectorBarChart([
        { sector: "Tech", changePercent: 2.1 },
        { sector: "Energy", changePercent: -1.4 },
        { sector: "Health", changePercent: 0.5 },
      ]);

      const techIndex = output.indexOf("Tech");
      const healthIndex = output.indexOf("Health");
      const energyIndex = output.indexOf("Energy");

      expect(techIndex).toBeGreaterThanOrEqual(0);
      expect(healthIndex).toBeGreaterThan(techIndex);
      expect(energyIndex).toBeGreaterThan(healthIndex);

      expect(output).toContain("#10b981");
      expect(output).toContain("#ef4444");
    });

    it("renders the fixed data-error copy block and no <svg> when sectors is empty", () => {
      const output = renderSectorBarChart([]);

      expect(output).toContain("データ取得エラー");
      expect(output).toContain(
        "セクターパフォーマンスデータを取得できませんでした",
      );
      expect(output).not.toContain("<svg");
    });

    it("renders a responsive svg root with viewBox and width=100% and no fixed pixel width", () => {
      const output = renderSectorBarChart([
        { sector: "Tech", changePercent: 2.1 },
      ]);

      expect(output).toContain('viewBox="0 0');
      expect(output).toContain('width="100%"');
      expect(output).not.toMatch(/<svg[^>]*width="\d+"/);
    });

    it("escapes sector names containing HTML-sensitive characters", () => {
      const output = renderSectorBarChart([
        { sector: "<script>alert(1)</script>", changePercent: 1 },
      ]);

      expect(output).not.toContain("<script>alert(1)</script>");
    });
  });

  describe("renderVixLineChart (vix)", () => {
    it("renders a polyline, dots, and dashed 20/30 threshold lines", () => {
      const output = renderVixLineChart([
        { date: "2026-06-01", close: 18 },
        { date: "2026-06-02", close: 22 },
      ]);

      expect(output).toContain("<polyline");
      expect(output).toContain('stroke="#3b82f6"');
      expect(output).toContain('stroke-width="2"');

      const circleMatches = output.match(/<circle[^>]*r="3"[^>]*fill="#3b82f6"/g);
      expect(circleMatches).not.toBeNull();
      expect(circleMatches!.length).toBeGreaterThanOrEqual(2);

      const thresholdMatches = output.match(/stroke="#6b7280"/g);
      expect(thresholdMatches).not.toBeNull();
      expect(thresholdMatches!.length).toBe(2);

      expect(output).toContain(">20<");
      expect(output).toContain(">30<");
    });

    it("renders the fixed data-error copy block and no <polyline> when history is empty", () => {
      const output = renderVixLineChart([]);

      expect(output).toContain("データ取得エラー");
      expect(output).toContain("VIX推移データを取得できませんでした");
      expect(output).not.toContain("<polyline");
    });

    it("renders a responsive svg root with viewBox 0 0 600 200 and width=100% with no fixed pixel width/height", () => {
      const output = renderVixLineChart([
        { date: "2026-06-01", close: 18 },
        { date: "2026-06-02", close: 22 },
      ]);

      expect(output).toContain('viewBox="0 0 600 200"');
      expect(output).toContain('width="100%"');
      expect(output).not.toMatch(/<svg[^>]*width="\d+"/);
      expect(output).not.toMatch(/<svg[^>]*height="\d+"/);
    });

    it("escapes first/last date axis labels", () => {
      const output = renderVixLineChart([
        { date: "<b>2026-06-01</b>", close: 18 },
        { date: "2026-06-02", close: 22 },
      ]);

      expect(output).not.toContain("<b>2026-06-01</b>");
    });
  });
});
