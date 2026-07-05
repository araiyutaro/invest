import { describe, it, expect } from "vitest";
import {
  selectStaleDateDirs,
  pruneIndexHtmlToMonth,
  prunePortfolioHtmlToMonth,
} from "./archive-old-reports.js";

describe("selectStaleDateDirs", () => {
  it("当月以外の日付ディレクトリのみを返す", () => {
    const names = ["2026-07-01", "2026-07-06", "2026-06-30", "2026-05-01"];
    expect(selectStaleDateDirs(names, "2026-07")).toEqual(["2026-05-01", "2026-06-30"]);
  });

  it("YYYY-MM-DD 形式でない名前（index.html 等）は無視する", () => {
    const names = ["index.html", "portfolio.html", "2026-06-01", "assets", ".DS_Store"];
    expect(selectStaleDateDirs(names, "2026-07")).toEqual(["2026-06-01"]);
  });

  it("当月のみのときは空配列", () => {
    expect(selectStaleDateDirs(["2026-07-01", "2026-07-06"], "2026-07")).toEqual([]);
  });

  it("結果は昇順ソートされ、入力を変更しない", () => {
    const names = ["2026-05-10", "2026-03-01", "2026-04-15"];
    const copy = [...names];
    expect(selectStaleDateDirs(names, "2026-07")).toEqual([
      "2026-03-01",
      "2026-04-15",
      "2026-05-10",
    ]);
    expect(names).toEqual(copy);
  });
});

const INDEX_FIXTURE = `<html><body>
    <!-- REPORT_ENTRIES -->
      <div class="hero"></div>
      <details class="month-group" open>
        <summary>2026年7月 (1件)</summary>
        <ul class="report-list">
        <li class="report-item">
          <div class="report-date">2026-07-06</div>
          <div class="report-links">
            <a href="2026-07-06/daily-report.html">Daily Report</a>
          </div>
        </li>
        </ul>
      </details>
      <details class="month-group">
        <summary>2026年6月 (1件)</summary>
        <ul class="report-list">
        <li class="report-item">
          <div class="report-date">2026-06-30</div>
          <div class="report-links">
            <a href="2026-06-30/daily-report.html">Daily Report</a>
          </div>
        </li>
        </ul>
      </details>
      <!-- /REPORT_ENTRIES -->
  </body></html>`;

describe("pruneIndexHtmlToMonth", () => {
  it("当月のエントリのみを残し、過去月のエントリを除去する", () => {
    const out = pruneIndexHtmlToMonth(INDEX_FIXTURE, "2026-07");
    expect(out).toContain("2026-07-06");
    expect(out).not.toContain("2026-06-30");
  });

  it("マーカーの外側（before/after）は保持される", () => {
    const out = pruneIndexHtmlToMonth(INDEX_FIXTURE, "2026-07");
    expect(out.startsWith("<html><body>")).toBe(true);
    expect(out.endsWith("</body></html>")).toBe(true);
    expect(out).toContain("<!-- REPORT_ENTRIES -->");
    expect(out).toContain("<!-- /REPORT_ENTRIES -->");
  });

  it("マーカーが無い場合は原文をそのまま返す（fail-soft）", () => {
    const noMarker = "<html>no markers here</html>";
    expect(pruneIndexHtmlToMonth(noMarker, "2026-07")).toBe(noMarker);
  });

  it("当月エントリが1件も無い場合でも throw せず外側を保持する", () => {
    const out = pruneIndexHtmlToMonth(INDEX_FIXTURE, "2026-12");
    expect(out).not.toContain("2026-07-06");
    expect(out).not.toContain("2026-06-30");
    expect(out).toContain("<!-- /REPORT_ENTRIES -->");
  });
});

const PORTFOLIO_FIXTURE = `      <!-- REPORT_ENTRIES -->
      <li class="report-item">
        <div class="report-date">2026-07-06</div>
        <div class="report-links">
          <a href="2026-07-06/portfolio-report.html">Portfolio Report</a>
        </div>
      </li>
      <li class="report-item">
        <div class="report-date">2026-06-30</div>
        <div class="report-links">
          <a href="2026-06-30/portfolio-report.html">Portfolio Report</a>
        </div>
      </li>
      <li class="report-item">
        <div class="report-date">2026-07-05</div>
        <div class="report-links">
          <a href="2026-07-05/portfolio-report.html">Portfolio Report</a>
        </div>
      </li>`;

describe("prunePortfolioHtmlToMonth", () => {
  it("当月の report-item のみを残す", () => {
    const out = prunePortfolioHtmlToMonth(PORTFOLIO_FIXTURE, "2026-07");
    expect(out).toContain("2026-07-06");
    expect(out).toContain("2026-07-05");
    expect(out).not.toContain("2026-06-30");
  });

  it("除去後も当月ブロックの構造（リンク）を保持する", () => {
    const out = prunePortfolioHtmlToMonth(PORTFOLIO_FIXTURE, "2026-07");
    expect(out).toContain("2026-07-06/portfolio-report.html");
    expect(out).toContain("<!-- REPORT_ENTRIES -->");
  });

  it("report-date を持たない report-item は保持する（安全側）", () => {
    const html = `      <!-- REPORT_ENTRIES -->
      <li class="report-item">
        <div class="report-links"><a href="x">X</a></div>
      </li>`;
    expect(prunePortfolioHtmlToMonth(html, "2026-07")).toContain('<li class="report-item">');
  });

  it("全て過去月なら全 report-item が除去される", () => {
    const out = prunePortfolioHtmlToMonth(PORTFOLIO_FIXTURE, "2026-12");
    expect(out).not.toContain('<li class="report-item">');
    expect(out).toContain("<!-- REPORT_ENTRIES -->");
  });
});
