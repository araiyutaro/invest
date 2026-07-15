import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { watchlistJudgmentSchema } from "../meeting/schemas.js";
import type { WatchlistJudgment, WatchlistJudgmentFile } from "../meeting/types.js";
import {
  applyConfluenceGate,
  attachActionChanges,
  deriveMarket,
  buildSkippedJudgment,
} from "../portfolio/watchlist-judgment.js";
import { normalizeHoldingSymbol } from "../portfolio/holding-news.js";
import type { TechnicalSnapshot } from "../data/technicals.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const RAW_DIR = join(TMP_DIR, "watchlist-judgment-raw");
const OUTPUT_PATH = join(TMP_DIR, "watchlist-judgment.json");
const PREV_PATH = join(TMP_DIR, "prev-watchlist-judgment.json");
const TECHNICALS_PATH = join(TMP_DIR, "watchlist-technicals.json");
const MEETING_RESULT_PATH = join(TMP_DIR, "meeting-result.json");

/**
 * D-18/Pitfall 1: tmp/prev-watchlist-judgment.json の ENOENT-vs-破損 二段フェイル読込。
 * write-watchlist.ts の loadExistingWatchlist を verbatim ベースに実装する。
 * ENOENT 判定は `.code` と `.message` の両方をチェックする（このコードベースの
 * テストモック規約 — プレーンな Error("ENOENT") で欠損をシミュレートするため）。
 * 欠損（no-prior-data）と破損はどちらも前日比較をスキップする（prev: null）が、
 * corrupted フラグで区別し監査ログに残せるようにする。
 */
export async function loadPrevJudgmentDefensive(): Promise<{
  prev: WatchlistJudgmentFile | null;
  corrupted: boolean;
}> {
  try {
    const raw = await readFile(PREV_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { prev: null, corrupted: true };
    }
    return { prev: parsed as WatchlistJudgmentFile, corrupted: false };
  } catch (error) {
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    return isMissing ? { prev: null, corrupted: false } : { prev: null, corrupted: true };
  }
}

/**
 * D-18/D-19: 常に有効 JSON を tmp/watchlist-judgment.json に書き出す共通ヘルパ。
 * collect-watchlist-data.ts の writeEmptyOutputs と同趣旨。
 */
export async function writeEmptyOutput(date: string): Promise<void> {
  await writeFile(
    OUTPUT_PATH,
    JSON.stringify({ date, generatedAt: new Date().toISOString(), judgments: [] }, null, 2),
    "utf-8",
  );
}

/**
 * D-01/D-02/D-16/D-18/D-19: tmp/watchlist-judgment-raw/{ticker}.json 群を1銘柄ずつ独立に
 * zod 検証し、confluence ゲート・market/asOf 決定論再付与・前日比較を経て
 * tmp/watchlist-judgment.json を書き出す fail-soft CLI エントリポイント。
 * すべての I/O・フェイルソフト分岐をここに集約する。throw せず全分岐で return する。
 */
export async function main(): Promise<void> {
  // 後続分岐に関わらず必ず tmp/ を作成する（write-watchlist.ts の DATA_DIR mkdir と同趣旨）
  await mkdir(TMP_DIR, { recursive: true });

  let date: string;
  try {
    const raw = await readFile(MEETING_RESULT_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { date?: unknown };
    if (typeof parsed.date !== "string" || parsed.date === "") {
      throw new Error("date欠落");
    }
    date = parsed.date;
  } catch (error) {
    console.error(
      "[watchlist-judgment] tmp/meeting-result.json の読み込みに失敗しました。空出力で終了します。",
      error,
    );
    // date が取得できないため、フォールバック値（当日 UTC 日付）で空出力を書く。
    const fallbackDate = new Date().toISOString().slice(0, 10);
    await writeEmptyOutput(fallbackDate);
    console.error("[STEP:watchlist-judgment:FAIL:meeting-result読込失敗]");
    return;
  }

  let rawFiles: string[];
  try {
    rawFiles = (await readdir(RAW_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    // D-19: raw ディレクトリが存在しない場合はアクティブ0件の正常系として扱う。
    rawFiles = [];
  }

  if (rawFiles.length === 0) {
    console.log("[watchlist-judgment] アクティブ銘柄0件");
    await writeEmptyOutput(date);
    console.error("[STEP:watchlist-judgment:OK]");
    return;
  }

  // technicals: asOf 決定論付与・skip 判定のソース（D-08/D-20）
  let technicalsBySymbol = new Map<string, TechnicalSnapshot>();
  try {
    const raw = await readFile(TECHNICALS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { snapshots?: unknown };
    if (Array.isArray(parsed.snapshots)) {
      const entries = (parsed.snapshots as TechnicalSnapshot[])
        .filter((s): s is TechnicalSnapshot => typeof s === "object" && s !== null && typeof s.symbol === "string")
        .map((s) => [normalizeHoldingSymbol(s.symbol), s] as const);
      technicalsBySymbol = new Map(entries);
    }
  } catch (error) {
    console.error(
      "[watchlist-judgment] tmp/watchlist-technicals.json の読み込みに失敗しました。asOf付与・skip判定は空扱いで継続します。",
      error,
    );
  }

  // raw 検証ループ: 1銘柄ずつ独立 try/catch（T-30-04 DoS 対策、D-18）
  const validatedByTicker = new Map<string, WatchlistJudgment>();
  const failedTickers: string[] = [];
  for (const file of rawFiles) {
    const ticker = file.replace(/\.json$/, "");
    try {
      const raw = await readFile(join(RAW_DIR, file), "utf-8");
      const parsed: unknown = JSON.parse(raw);
      const judgment = watchlistJudgmentSchema.parse(parsed);
      validatedByTicker.set(normalizeHoldingSymbol(judgment.ticker), judgment as WatchlistJudgment);
    } catch (error) {
      failedTickers.push(ticker);
      console.log(`[watchlist-judgment] 検証失敗: ${ticker} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 順序契約: 検証成功 → confluence ゲート → market/asOf 決定論付与（Pitfall 3/4）。
  // D-20/Pitfall 5: technicals にスナップショットが無い検証済み銘柄は buildSkippedJudgment で
  // 陽性 skip レコードに置き換える（省略ではなく明示記録）。raw 検証失敗銘柄（failedTickers）は
  // technicals の有無に関わらず判定欠落として output に含めない（読み取れた判定が無いため）。
  const processedJudgments: WatchlistJudgment[] = [];
  let downgradedCount = 0;
  for (const [normalizedTicker, judgment] of validatedByTicker) {
    const snapshot = technicalsBySymbol.get(normalizedTicker);
    if (snapshot === undefined) {
      processedJudgments.push(buildSkippedJudgment(judgment.ticker));
      continue;
    }
    const gated = applyConfluenceGate(judgment);
    if (gated.downgraded) {
      downgradedCount += 1;
    }
    processedJudgments.push({
      ...judgment,
      todayAction: gated.todayAction,
      market: deriveMarket(judgment.ticker),
      asOf: snapshot.asOf,
    });
  }

  // 前日比較（D-11、TIME-03）
  const { prev, corrupted: prevCorrupted } = await loadPrevJudgmentDefensive();
  if (prevCorrupted) {
    console.log("[watchlist-judgment] tmp/prev-watchlist-judgment.json が破損しています。前日比較をスキップします。");
  }
  const finalJudgments = attachActionChanges(processedJudgments, prev?.judgments ?? null);

  const output: WatchlistJudgmentFile = {
    date,
    generatedAt: new Date().toISOString(),
    judgments: finalJudgments,
  };
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(
    `[watchlist-judgment] 判定=${finalJudgments.length}件, skip=${finalJudgments.filter((j) => j.status === "skipped").length}件, 降格=${downgradedCount}件`,
  );

  if (failedTickers.length > 0) {
    console.error(
      `[STEP:watchlist-judgment:FAIL:${failedTickers.length}/${rawFiles.length}銘柄失敗（${failedTickers.join(", ")}）]`,
    );
  } else {
    console.error("[STEP:watchlist-judgment:OK]");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(async (error) => {
    console.error("Fatal error:", error);
    try {
      const fallbackDate = new Date().toISOString().slice(0, 10);
      await writeEmptyOutput(fallbackDate);
    } catch {
      // 出力先にも書けない場合は呼び出し元のフォールバックに委ねる
    }
    console.error("[STEP:watchlist-judgment:FAIL:fatal]");
    process.exitCode = 1;
  });
}
