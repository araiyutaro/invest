import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PORTFOLIO_HOLDINGS } from "../portfolio/holdings.js";
import { escapeHtml } from "./report-utils.js";

const DOCS_DIR = join(import.meta.dirname, "../../docs");
const TMP_DIR = join(import.meta.dirname, "../../tmp");
const START_MARKER = "<!-- REPORT_ENTRIES -->";
const END_MARKER = "<!-- /REPORT_ENTRIES -->";
const MARKER = "<!-- REPORT_ENTRIES -->";

export interface ReportLink {
  readonly href: string;
  readonly label: string;
}

export interface ReportEntry {
  readonly date: string;
  readonly links: ReadonlyArray<ReportLink>;
}

async function getDate(): Promise<string> {
  const raw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const result = JSON.parse(raw) as { date: string };
  return result.date;
}

function buildStandardLinks(date: string): ReportLink[] {
  return [
    { href: `${date}/daily-report.html`, label: "Daily Report" },
    { href: `${date}/meeting-minutes.html`, label: "Meeting Minutes" },
    { href: `${date}/portfolio-report.html`, label: "Portfolio Report" },
  ];
}

const NEWS_DIGEST_LABEL = "News Digest";

async function newsDigestFileExists(date: string): Promise<boolean> {
  try {
    await access(join(DOCS_DIR, date, "news-digest.html"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-derives the News Digest link for a single entry strictly from fs state,
 * every run (D-01/D-02). Never trusts a parsed "News Digest" link — always
 * strips it first, then re-adds only if the file exists right now.
 */
async function withNewsDigestLink(entry: ReportEntry): Promise<ReportEntry> {
  const baseLinks = entry.links.filter((l) => l.label !== NEWS_DIGEST_LABEL);
  const exists = await newsDigestFileExists(entry.date);
  const links = exists
    ? [...baseLinks, { href: `${entry.date}/news-digest.html`, label: NEWS_DIGEST_LABEL }]
    : baseLinks;
  return { ...entry, links };
}

/**
 * Parses existing `<li class="report-item">` blocks out of a fragment of index.html,
 * preserving each entry's actual link set (do not assume 3 links per entry).
 */
export function parseExistingEntries(html: string): ReportEntry[] {
  const entries: ReportEntry[] = [];
  const itemRe =
    /<li class="report-item">\s*<div class="report-date">([\d-]+)<\/div>\s*<div class="report-links">([\s\S]*?)<\/div>\s*<\/li>/g;
  const linkRe = /<a href="([^"]*)">([^<]*)<\/a>/g;

  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html))) {
    const [, date, linksHtml] = m;
    const links: ReportLink[] = [];
    linkRe.lastIndex = 0;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(linksHtml))) {
      links.push({ href: lm[1], label: lm[2] });
    }
    entries.push({ date, links });
  }
  return entries;
}

/** New date wins if it already exists in `existing`. */
export function mergeEntry(
  existing: ReadonlyArray<ReportEntry>,
  newEntry: ReportEntry,
): ReportEntry[] {
  const filtered = existing.filter((e) => e.date !== newEntry.date);
  return [...filtered, newEntry];
}

function compareDateDesc(a: ReportEntry, b: ReportEntry): number {
  if (a.date < b.date) return 1;
  if (a.date > b.date) return -1;
  return 0;
}

/** Groups entries by `YYYY-MM`, sorting entries within each month descending by date. */
export function groupByMonth(
  entries: ReadonlyArray<ReportEntry>,
): Map<string, ReportEntry[]> {
  const groups = new Map<string, ReportEntry[]>();
  for (const e of entries) {
    const month = e.date.slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month)!.push(e);
  }
  for (const items of groups.values()) {
    items.sort(compareDateDesc);
  }
  return groups;
}

function renderEntryLinks(entry: ReportEntry): string {
  return entry.links
    .map(
      (l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`,
    )
    .join("\n          ");
}

function renderEntryItem(entry: ReportEntry): string {
  return `        <li class="report-item">
          <div class="report-date">${escapeHtml(entry.date)}</div>
          <div class="report-links">
            ${renderEntryLinks(entry)}
          </div>
        </li>`;
}

/** Renders the single newest entry as a Display-typography hero block (D-01). */
export function renderHero(entry: ReportEntry): string {
  return `      <div class="hero">
        <div class="hero-label">最新レポート</div>
        <div class="hero-date">${escapeHtml(entry.date)}</div>
        <div class="report-links">
          ${renderEntryLinks(entry)}
        </div>
      </div>`;
}

/**
 * Renders one `<details class="month-group">` per month (descending), the newest month
 * `open` by default (D-02), summary text `{y}年{Number(mo)}月 ({N}件)`.
 */
export function renderAccordion(groups: Map<string, ReportEntry[]>): string {
  const months = [...groups.keys()].sort().reverse();
  return months
    .map((month, i) => {
      const [y, mo] = month.split("-");
      const items = groups.get(month)!;
      const itemsHtml = items.map((e) => renderEntryItem(e)).join("\n");
      return `      <details class="month-group"${i === 0 ? " open" : ""}>
        <summary>${escapeHtml(y)}年${Number(mo)}月 (${items.length}件)</summary>
        <ul class="report-list">
${itemsHtml}
        </ul>
      </details>`;
    })
    .join("\n");
}

/**
 * Builds the full hero + month-accordion region from a merged, deterministic entry list.
 * The newest entry appears both in the hero block and within its month's accordion.
 */
export function buildRegion(entries: ReadonlyArray<ReportEntry>): string {
  if (entries.length === 0) return "";
  const sorted = [...entries].sort(compareDateDesc);
  const heroEntry = sorted[0];
  const groups = groupByMonth(sorted);
  const heroHtml = renderHero(heroEntry);
  const accordionHtml = renderAccordion(groups);
  return `${heroHtml}\n${accordionHtml}`;
}

function buildPortfolioEntry(date: string): string {
  return `      <li class="report-item">
        <div class="report-date">${escapeHtml(date)}</div>
        <div class="report-links">
          <a href="${escapeHtml(date)}/portfolio-report.html">Portfolio Report</a>
        </div>
      </li>`;
}

function buildHoldingSpans(): string {
  return PORTFOLIO_HOLDINGS.map((h) => `        <span>${h.symbol}</span>`).join("\n");
}

/**
 * Rewrites docs/index.html: parses existing entries, merges the new date (new date wins on
 * duplicate), groups by month, and replaces ONLY the content strictly between
 * REPORT_ENTRIES markers with a hero block + month accordions. Single readFile + single
 * writeFile (no partial/streaming writes) to keep OPS-02 checksum protection well-behaved.
 */
export async function updateIndexHtml(date: string): Promise<void> {
  const filePath = join(DOCS_DIR, "index.html");
  const content = await readFile(filePath, "utf-8");

  const startIdx = content.indexOf(START_MARKER);
  const endIdx = content.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error("index.html: REPORT_ENTRIES マーカーが見つかりません。");
  }

  const regionStart = startIdx + START_MARKER.length;
  const existingRegion = content.slice(regionStart, endIdx);
  const existingEntries = parseExistingEntries(existingRegion);

  const newEntry: ReportEntry = { date, links: buildStandardLinks(date) };
  const merged = mergeEntry(existingEntries, newEntry);
  const withDigestLinks = await Promise.all(merged.map(withNewsDigestLink));

  const regionHtml = buildRegion(withDigestLinks);

  const before = content.slice(0, regionStart);
  const after = content.slice(endIdx);
  const updated = `${before}\n${regionHtml}\n      ${after}`;

  await writeFile(filePath, updated, "utf-8");
  console.log(`index.html: ${date} のエントリを更新しました。`);
}

async function updatePortfolioHtml(date: string): Promise<void> {
  const filePath = join(DOCS_DIR, "portfolio.html");
  const content = await readFile(filePath, "utf-8");

  const withEntry = content.includes(`<div class="report-date">${date}</div>`)
    ? (() => {
        console.log(`portfolio.html: ${date} のエントリは既に存在します。スキップします。`);
        return content;
      })()
    : (() => {
        const entry = buildPortfolioEntry(date);
        console.log(`portfolio.html: ${date} のエントリを追加しました。`);
        return content.replace(MARKER, `${MARKER}\n${entry}`);
      })();

  const holdingsSpans = buildHoldingSpans();
  const updated = withEntry.replace(
    /(<div class="holdings-list">)[^]*?(<\/div>)/,
    `$1\n${holdingsSpans}\n      $2`,
  );

  await writeFile(filePath, updated, "utf-8");
  console.log("portfolio.html: ホールディングスリストを更新しました。");
}

async function main(): Promise<void> {
  const date = await getDate();
  console.log(`対象日付: ${date}`);
  await Promise.all([updateIndexHtml(date), updatePortfolioHtml(date)]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("update-index failed:", err);
    process.exit(1);
  });
}
