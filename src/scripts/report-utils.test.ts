import { describe, it, expect } from "vitest";
import { generateBaseStyles } from "./report-utils.js";

describe("report-utils", () => {
  describe("generateBaseStyles", () => {
    it("emits a mobile responsive media query at 768px", () => {
      const styles = generateBaseStyles("#3b82f6");

      expect(styles).toContain("@media (max-width: 768px)");
    });

    it("makes tables horizontally scrollable within the responsive block", () => {
      const styles = generateBaseStyles("#3b82f6");

      expect(styles).toContain("overflow-x: auto");
    });

    it("ensures interactive elements meet the 44px tap-target minimum", () => {
      const styles = generateBaseStyles("#3b82f6");

      expect(styles).toContain("min-height: 44px");
    });

    it("preserves the existing dark-theme background (no regression)", () => {
      const styles = generateBaseStyles("#3b82f6");

      expect(styles).toContain("#0f0f1a");
    });
  });
});
