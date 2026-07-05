import { readdir, rename, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseExistingEntries, buildRegion } from "./update-index.js";

const DOCS_DIR = join(import.meta.dirname, "../../docs");
const DOCS_OLD_DIR = join(import.meta.dirname, "../../docs_old");
const TMP_DIR = join(import.meta.dirname, "../../tmp");

const DATE_DIR_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const START_MARKER = "<!-- REPORT_ENTRIES -->";
const END_MARKER = "<!-- /REPORT_ENTRIES -->";

/**
 * docs/ 配下の日付ディレクトリ名のうち、当月（currentMonth = "YYYY-MM"）以外を返す。
 * 純関数: I/O なし・throw なし・入力を変更しない。YYYY-MM-DD 形式でない名前は無視する。
 */
export function selectStaleDateDirs(
  names: ReadonlyArray<string>,
  currentMonth: string,
): string[] {
  return names
    .filter((n) => DATE_DIR_RE.test(n) && n.slice(0, 7) !== currentMonth)
    .slice()
    .sort();
}

/**
 * index.html の REPORT_ENTRIES 領域を当月エントリのみに剪定して返す。
 * update-index.ts の updateIndexHtml と同一の領域書式（parseExistingEntries → buildRegion）を用いるため、
 * 翌日の update-index 実行と齟齬が出ない。マーカーが無い/壊れている場合は fail-soft で原文を返す。
 * 純関数: I/O なし・throw なし。
 */
export function pruneIndexHtmlToMonth(html: string, currentMonth: string): string {
  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return html;

  const regionStart = startIdx + START_MARKER.length;
  const region = html.slice(regionStart, endIdx);
  const entries = parseExistingEntries(region).filter(
    (e) => e.date.slice(0, 7) === currentMonth,
  );
  const regionHtml = buildRegion(entries);

  const before = html.slice(0, regionStart);
  const after = html.slice(endIdx);
  return `${before}\n${regionHtml}\n      ${after}`;
}

/**
 * portfolio.html の `<li class="report-item">` ブロックのうち、当月以外の日付を持つものを除去して返す。
 * portfolio.html は END マーカー・月アコーディオンを持たないため、領域再構築ではなくブロック単位で除去する。
 * report-date を持たないブロックは安全側で保持する。純関数: I/O なし・throw なし。
 */
export function prunePortfolioHtmlToMonth(html: string, currentMonth: string): string {
  return html.replace(
    /\n[ \t]*<li class="report-item">[\s\S]*?<\/li>/g,
    (block) => {
      const m = block.match(/report-date">(\d{4}-\d{2})-\d{2}</);
      if (m && m[1] !== currentMonth) return "";
      return block;
    },
  );
}

/** tmp/meeting-result.json の date（YYYY-MM-DD）から当月キー（YYYY-MM）を導出する。 */
async function resolveCurrentMonth(): Promise<string> {
  const raw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const { date } = JSON.parse(raw) as { date: string };
  if (!DATE_DIR_RE.test(date)) {
    throw new Error(`meeting-result.json の date が不正: ${date}`);
  }
  return date.slice(0, 7);
}

/** 当月以外の日付ディレクトリを docs_old/{YYYY-MM}/ へ移動する。移動件数を返す。 */
async function moveStaleDirs(currentMonth: string): Promise<number> {
  const names = await readdir(DOCS_DIR);
  const stale = selectStaleDateDirs(names, currentMonth);
  let moved = 0;
  for (const dir of stale) {
    const month = dir.slice(0, 7);
    const destDir = join(DOCS_OLD_DIR, month);
    const destPath = join(destDir, dir);
    if (existsSync(destPath)) {
      // 既にアーカイブ済み（再実行）。source をそのまま残さないよう上書きは避けスキップ。
      console.warn(`[archive-reports] skip (dest exists): ${dir}`);
      continue;
    }
    await mkdir(destDir, { recursive: true });
    await rename(join(DOCS_DIR, dir), destPath);
    moved++;
  }
  return moved;
}

/** index.html / portfolio.html を当月エントリのみに剪定する（変更があった場合のみ書き込む）。 */
async function pruneIndexPages(currentMonth: string): Promise<void> {
  const targets: ReadonlyArray<[string, (html: string, m: string) => string]> = [
    ["index.html", pruneIndexHtmlToMonth],
    ["portfolio.html", prunePortfolioHtmlToMonth],
  ];
  for (const [file, prune] of targets) {
    const path = join(DOCS_DIR, file);
    if (!existsSync(path)) continue;
    const html = await readFile(path, "utf-8");
    const pruned = prune(html, currentMonth);
    if (pruned !== html) {
      await writeFile(path, pruned, "utf-8");
      console.log(`${file}: 当月(${currentMonth})のエントリのみに剪定しました。`);
    }
  }
}

async function main(): Promise<void> {
  const currentMonth = await resolveCurrentMonth();
  if (!MONTH_RE.test(currentMonth)) {
    throw new Error(`当月キーが不正: ${currentMonth}`);
  }
  const moved = await moveStaleDirs(currentMonth);
  await pruneIndexPages(currentMonth);
  console.log(`[archive-reports] 当月=${currentMonth}, 移動=${moved}件 → docs_old/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then(() => {
      console.log("[STEP:archive-reports:OK]");
    })
    .catch((err) => {
      // fail-soft: アーカイブ失敗はレポート生成・デプロイをブロックしない。
      console.error("archive-old-reports failed:", err instanceof Error ? err.message : err);
      console.log("[STEP:archive-reports:FAIL:アーカイブ処理でエラー（デプロイは継続）]");
    });
}
