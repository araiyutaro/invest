import { describe, it, expect } from "vitest";
import { renderSectorBarChart } from "./report-charts.js";

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
});
