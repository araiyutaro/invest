import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { analystRound1OutputSchema, analystRound2OutputSchema, analystRound3OutputSchema, portfolioAnalysisSchema } from "../meeting/schemas.js";
import type { NewsArticlePoolEntry } from "../meeting/schemas.js";
import type { AnalystRound1Output, AnalystRound2Output, AnalystRound3Output, PortfolioAnalysis, WatchlistJudgmentFile } from "../meeting/types.js";
import type { HoldingNewsFile } from "../portfolio/holding-news.js";
import type { UrgencyHistoryFile } from "../portfolio/urgency-history.js";
import type { WatchlistFile } from "../portfolio/watchlist.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DATA_DIR = join(import.meta.dirname, "../../data");

export async function loadRound1Results(): Promise<ReadonlyArray<AnalystRound1Output>> {
  const roundDir = join(TMP_DIR, "round-1");
  try {
    const files = await readdir(roundDir);
    const results = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const raw = await readFile(join(roundDir, f), "utf-8");
            return analystRound1OutputSchema.parse(JSON.parse(raw) as unknown) as AnalystRound1Output;
          } catch (error) {
            // WR-03/D-15: サイレントdropはアナリストが議事録から無警告で消えるため、必ずwarnを出す
            console.warn(`Round 1 result load failed (${f}):`, error instanceof Error ? error.message : error);
            return null;
          }
        }),
    );
    return results.filter((r): r is AnalystRound1Output => r !== null);
  } catch {
    return [];
  }
}

export async function loadRound2Results(): Promise<ReadonlyArray<AnalystRound2Output>> {
  const roundDir = join(TMP_DIR, "round-2");
  try {
    const files = await readdir(roundDir);
    const results = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const raw = await readFile(join(roundDir, f), "utf-8");
            return analystRound2OutputSchema.parse(JSON.parse(raw) as unknown) as AnalystRound2Output;
          } catch (error) {
            // WR-03/D-15: サイレントdropはアナリストが議事録から無警告で消えるため、必ずwarnを出す
            console.warn(`Round 2 result load failed (${f}):`, error instanceof Error ? error.message : error);
            return null;
          }
        }),
    );
    return results.filter((r): r is AnalystRound2Output => r !== null);
  } catch {
    return [];
  }
}

export async function loadRound3Results(): Promise<ReadonlyArray<AnalystRound3Output>> {
  const roundDir = join(TMP_DIR, "round-3");
  try {
    const files = await readdir(roundDir);
    const results = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            const raw = await readFile(join(roundDir, f), "utf-8");
            return analystRound3OutputSchema.parse(JSON.parse(raw) as unknown) as AnalystRound3Output;
          } catch (error) {
            // WR-03/D-15: サイレントdropはアナリストが議事録から無警告で消えるため、必ずwarnを出す
            console.warn(`Round 3 result load failed (${f}):`, error instanceof Error ? error.message : error);
            return null;
          }
        }),
    );
    return results.filter((r): r is AnalystRound3Output => r !== null);
  } catch {
    return [];
  }
}

export async function loadPortfolioAnalysis(): Promise<PortfolioAnalysis | null> {
  try {
    const raw = await readFile(join(TMP_DIR, "portfolio-analysis.json"), "utf-8");
    return portfolioAnalysisSchema.parse(JSON.parse(raw) as unknown) as PortfolioAnalysis;
  } catch (error) {
    console.error('Portfolio analysis load failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * tmp/prev-portfolio-analysis.json（前日のポートフォリオ判断スナップショット）を fail-soft で読み込む。
 * 欠損/パース失敗は初回実行・スキップ日などの想定内エッジケースのため console.warn を使う
 * （loadPortfolioAnalysis の console.error とは severity を区別、D-15/Pitfall 7）。
 */
export async function loadPrevPortfolioAnalysis(): Promise<PortfolioAnalysis | null> {
  try {
    const raw = await readFile(join(TMP_DIR, "prev-portfolio-analysis.json"), "utf-8");
    return portfolioAnalysisSchema.parse(JSON.parse(raw) as unknown) as PortfolioAnalysis;
  } catch (error) {
    console.warn("Prev portfolio analysis load failed (D-15/Pitfall 7):", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * tmp/news.json（記事プール）を fail-soft で読み込む。自社TS生成物のため zod は使わず、
 * write-news-digest.ts と同じ型アサーションを用いる。欠損/パース失敗時は throw せず [] を返す。
 */
export async function loadNewsPool(): Promise<ReadonlyArray<NewsArticlePoolEntry>> {
  try {
    const raw = await readFile(join(TMP_DIR, "news.json"), "utf-8");
    return JSON.parse(raw) as ReadonlyArray<NewsArticlePoolEntry>;
  } catch (error) {
    console.error("News pool load failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * tmp/holding-news.json（銘柄別ID参照, Phase 19生成）を fail-soft で読み込む。
 * 欠損/パース失敗時は throw せず {} を返す (D-09: 欠損は全銘柄0件と同一扱い)。
 */
export async function loadHoldingNews(): Promise<HoldingNewsFile> {
  try {
    const raw = await readFile(join(TMP_DIR, "holding-news.json"), "utf-8");
    return JSON.parse(raw) as HoldingNewsFile;
  } catch (error) {
    console.error("Holding news load failed:", error instanceof Error ? error.message : error);
    return {};
  }
}

/**
 * data/urgency-history.json（Phase 25生成）を fail-soft で読み込む。
 * 自社TS生成物のため zod は使わず、loadHoldingNews と同じ型アサーションを用いる（D-13）。
 * 欠損（初回実行・履歴未蓄積）は正常系のため console.warn を用いる
 * （loadPrevPortfolioAnalysis と同じ severity 方針、D-13/D-14）。
 */
export async function loadUrgencyHistory(): Promise<UrgencyHistoryFile> {
  try {
    const raw = await readFile(join(DATA_DIR, "urgency-history.json"), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    // CR-02: JSON.parse は root が null/配列/プリミティブでも成功してしまうため、
    // Object.keys(history) を呼ぶ下流（computeWeeklyUrgencyRollup）で throw する前に
    // 形状を検証してフェイルソフトにフォールバックする（defense in depth）。
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("Urgency history load failed (unexpected root shape) — falling back to {}");
      return {};
    }
    return parsed as UrgencyHistoryFile;
  } catch (error) {
    console.warn("Urgency history load failed (expected on first run / fail-soft, HIST-03):", error instanceof Error ? error.message : error);
    return {};
  }
}

/**
 * tmp/watchlist-judgment.json（Phase 30生成）を fail-soft で読み込む。
 * 自社TS生成物のため zod は使わず、loadUrgencyHistory と同じ型アサーションを用いる。
 * D-13: file.date が渡された meetingResultDate と一致しない場合（前日残留ファイル）は
 * 当日レポートへの誤表示を防ぐため null を返す（ルックアヘッド防止思想の表示側適用）。
 * 欠損・破損・形状不整合はいずれも正常系として console.warn を用いる。
 */
export async function loadWatchlistJudgment(meetingResultDate: string): Promise<WatchlistJudgmentFile | null> {
  try {
    const raw = await readFile(join(TMP_DIR, "watchlist-judgment.json"), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("Watchlist judgment load failed (unexpected root shape) — falling back to null");
      return null;
    }
    const file = parsed as WatchlistJudgmentFile;
    if (!Array.isArray(file.judgments) || typeof file.date !== "string") {
      console.warn("Watchlist judgment load failed (unexpected file shape) — falling back to null");
      return null;
    }
    if (file.date !== meetingResultDate) {
      console.warn(
        `Watchlist judgment load skipped (stale file, D-13): file.date=${file.date} !== meetingResultDate=${meetingResultDate}`,
      );
      return null;
    }
    return file;
  } catch (error) {
    console.warn("Watchlist judgment load failed (expected on first run / fail-soft):", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * data/watchlist.json（Phase 28生成）を fail-soft で読み込む。
 * 自社TS生成物のため zod は使わず、loadUrgencyHistory と同じ型アサーションを用いる（D-12）。
 * 欠損・破損・形状不整合はいずれも正常系として console.warn を用い、{} にフォールバックする。
 */
export async function loadWatchlist(): Promise<WatchlistFile> {
  try {
    const raw = await readFile(join(DATA_DIR, "watchlist.json"), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      console.warn("Watchlist load failed (unexpected root shape) — falling back to {}");
      return {};
    }
    return parsed as WatchlistFile;
  } catch (error) {
    console.warn("Watchlist load failed (expected on first run / fail-soft):", error instanceof Error ? error.message : error);
    return {};
  }
}
