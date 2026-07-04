import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractUrgencySnapshots, appendUrgencySnapshot, isValidDateKey } from "../portfolio/urgency-history.js";
import type { UrgencyHistoryFile } from "../portfolio/urgency-history.js";
import type { PortfolioAnalysis } from "../meeting/types.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DATA_DIR = join(import.meta.dirname, "../../data");
const HISTORY_PATH = join(DATA_DIR, "urgency-history.json");

/**
 * D-08: tmp/portfolio-analysis.json を読み込み、純関数で抽出・マージし、
 * data/urgency-history.json に書き出す薄い fail-soft CLI ラッパー。
 * GREEN タスクで実装する（現時点はスタブ）。
 */
export async function main(): Promise<void> {
  throw new Error("not implemented");
}
