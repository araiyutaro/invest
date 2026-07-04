import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractUrgencySnapshots, appendUrgencySnapshot, isValidDateKey } from "../portfolio/urgency-history.js";
import type { UrgencyHistoryFile } from "../portfolio/urgency-history.js";
import type { PortfolioAnalysis } from "../meeting/types.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DATA_DIR = join(import.meta.dirname, "../../data");
const HISTORY_PATH = join(DATA_DIR, "urgency-history.json");

async function loadExistingHistory(): Promise<{ history: UrgencyHistoryFile; corrupted: boolean }> {
  try {
    const raw = await readFile(HISTORY_PATH, "utf-8");
    return { history: JSON.parse(raw) as UrgencyHistoryFile, corrupted: false };
  } catch (error) {
    // NodeJS.ErrnoException.code は本番実行では必ず "ENOENT" を持つが、
    // このプロジェクトの既存テスト規約（write-news-digest.test.ts 等）は
    // プレーンな Error(message) で ENOENT をシミュレートするため、
    // code と message の両方をチェックして一致させる。
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    return isMissing ? { history: {}, corrupted: false } : { history: {}, corrupted: true };
  }
}

/**
 * D-08: tmp/portfolio-analysis.json を読み込み、純関数で抽出・マージし、
 * data/urgency-history.json に書き出す薄い fail-soft CLI ラッパー。
 */
export async function main(): Promise<void> {
  // Pitfall 1 対策: data/ は Step 4 の `git add docs/ data/` が exit 128 で
  // 失敗しないよう、以降のスキップ/失敗分岐に関わらず必ず作成する。
  await mkdir(DATA_DIR, { recursive: true });

  const { history: existingHistory, corrupted } = await loadExistingHistory();
  if (corrupted) {
    // D-14: 既存ファイルを保全するため上書きせず、破損を可視化して終了する。
    console.error(
      "[urgency-history] FAIL: 既存の data/urgency-history.json が破損しています。保全のため今回の書き込みをスキップします。",
    );
    process.exit(1);
    return;
  }

  let analysis: PortfolioAnalysis | null;
  try {
    const raw = await readFile(join(TMP_DIR, "portfolio-analysis.json"), "utf-8");
    // 自社生成のアーティファクト（loadHoldingNews と同方式）: zod は使わない。
    analysis = JSON.parse(raw) as PortfolioAnalysis;
  } catch {
    analysis = null;
  }

  if (analysis === null || !Array.isArray(analysis.holdings) || analysis.holdings.length === 0) {
    // D-13: 分析欠損/0件は正常系。既存 history は一切変更せず終了する。
    console.error("[urgency-history] OK (skip: tmp/portfolio-analysis.json 欠損または holdings 0件, D-13)");
    return;
  }

  // D-05: dateKey は meeting-result.json 由来（Step 4 の docs/{date}/ と一致を保証）。
  const meetingRaw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
  const { date: dateKey } = JSON.parse(meetingRaw) as { date: string };

  if (!isValidDateKey(dateKey)) {
    console.error(`[urgency-history] FAIL: 不正なdateキー形式: ${dateKey}`);
    process.exit(1);
    return;
  }

  const snapshots = extractUrgencySnapshots(analysis);
  const updated = appendUrgencySnapshot(existingHistory, dateKey, snapshots);
  await writeFile(HISTORY_PATH, JSON.stringify(updated, null, 2), "utf-8");
  console.error(`[urgency-history] OK: ${dateKey} に${snapshots.length}銘柄分を記録`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
