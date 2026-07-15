import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchTechnicalSnapshot } from "../data/technicals.js";
import { getActiveWatchlistEntries } from "../portfolio/watchlist.js";
import type { WatchlistFile } from "../portfolio/watchlist.js";
import { buildHoldingNewsMap } from "../portfolio/holding-news.js";
import type { HoldingNewsFile } from "../portfolio/holding-news.js";
import type { NewsArticleWithId } from "../data/news/article-id.js";
import {
  toPortfolioHoldingShape,
  mergeWithCache,
  fetchChunked,
} from "../portfolio/watchlist-data.js";
import type { TechnicalsCacheFile } from "../portfolio/watchlist-data.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DATA_DIR = join(import.meta.dirname, "../../data");
const WATCHLIST_PATH = join(DATA_DIR, "watchlist.json");
const TECHNICALS_CACHE_PATH = join(TMP_DIR, "technicals.json");
const NEWS_POOL_PATH = join(TMP_DIR, "news.json");
const OUT_TECHNICALS_PATH = join(TMP_DIR, "watchlist-technicals.json");
const OUT_NEWS_PATH = join(TMP_DIR, "watchlist-news.json");

/**
 * D-19: data/watchlist.json の ENOENT-vs-corrupted 二段フェイル読込。
 * write-watchlist.ts の loadExistingWatchlist を verbatim ベースに実装する。
 * ENOENT 判定は `.code` と `.message` の両方をチェックする（このコードベースの
 * テストモック規約 — プレーンな Error("ENOENT") で欠損をシミュレートするため）。
 * ENOENT は D-04 の正常系（初回実行）として空ウォッチリストを返す。
 */
export async function loadWatchlistDefensive(): Promise<{
  watchlist: WatchlistFile;
  corrupted: boolean;
}> {
  try {
    const raw = await readFile(WATCHLIST_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { watchlist: {}, corrupted: true };
    }
    return { watchlist: parsed as WatchlistFile, corrupted: false };
  } catch (error) {
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    return isMissing ? { watchlist: {}, corrupted: false } : { watchlist: {}, corrupted: true };
  }
}

/**
 * D-12: tmp/technicals.json の fail-soft 読込（同日キャッシュ）。
 * 欠損（ENOENT）・パース失敗・snapshots が配列でない場合は空配列にフォールバックする
 * （警告ログのみ、キャッシュは最適化であり正しさの依存点にしない）。
 */
async function loadSameDayCache(
  path: string,
): Promise<ReadonlyArray<TechnicalsCacheFile["snapshots"][number]>> {
  try {
    const raw = await readFile(path, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as TechnicalsCacheFile).snapshots)
    ) {
      console.error(
        "[watchlist-data] tmp/technicals.json の形状が不正なためキャッシュを無視します",
      );
      return [];
    }
    return (parsed as TechnicalsCacheFile).snapshots;
  } catch {
    // ENOENT・パース失敗を区別せず fail-soft（D-12）
    return [];
  }
}

/**
 * D-04/D-19: 両出力ファイルに有効な空JSONを書込む（空ウォッチリスト・破損・fatal 時の共通経路）。
 */
export async function writeEmptyOutputs(): Promise<void> {
  await writeFile(
    OUT_TECHNICALS_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), snapshots: [] }),
    "utf-8",
  );
  await writeFile(OUT_NEWS_PATH, JSON.stringify({}), "utf-8");
}

/**
 * D-02/D-19: fail-soft CLI エントリポイント。ウォッチリストのアクティブ銘柄について
 * テクニカル・ニュース両ブランチを収集し、tmp/watchlist-technicals.json /
 * tmp/watchlist-news.json を書き込む。全異常系で両ファイルは常に有効JSONになる。
 */
export async function main(): Promise<void> {
  // tmp/ は後続分岐に関わらず必ず作成する（write-watchlist.ts の DATA_DIR mkdir と同趣旨）
  await mkdir(TMP_DIR, { recursive: true });

  const { watchlist, corrupted } = await loadWatchlistDefensive();
  if (corrupted) {
    console.error(
      "[watchlist-data] data/watchlist.json の形状が不正です。空JSONで終了します。",
    );
    await writeEmptyOutputs();
    console.error("[STEP:watchlist-data:FAIL:corrupted]");
    return;
  }

  const activeEntries = getActiveWatchlistEntries(watchlist);
  if (activeEntries.length === 0) {
    console.log("[watchlist-data] アクティブ銘柄0件");
    await writeEmptyOutputs();
    console.error("[STEP:watchlist-data:OK]");
    return;
  }

  // テクニカルブランチ（独立 try/catch）
  let mergedSnapshots: ReadonlyArray<TechnicalsCacheFile["snapshots"][number]> = [];
  try {
    const activeTickers = activeEntries.map((entry) => entry.ticker);
    const activeSet = new Set(activeTickers);
    const cachedSnapshots = await loadSameDayCache(TECHNICALS_CACHE_PATH);
    const { missingTickers } = mergeWithCache(activeTickers, cachedSnapshots);
    // CR-01: アクティブ銘柄に一致するスナップショットのみコピーする（D-11）。
    // cachedTickers（キャッシュ全 symbol の集合）で filter するとトートロジーになり、
    // ウォッチリスト外銘柄（Step 2b のモデレーター候補）が出力へ漏出する。
    // 同一 symbol の重複キャッシュ要素も seen 集合で去重する。
    const seen = new Set<string>();
    const hitSnapshots = cachedSnapshots.filter((s) => {
      if (!activeSet.has(s.symbol) || seen.has(s.symbol)) return false;
      seen.add(s.symbol);
      return true;
    });
    const fetchedSnapshots = await fetchChunked(missingTickers, fetchTechnicalSnapshot);
    mergedSnapshots = [...hitSnapshots, ...fetchedSnapshots];

    const failed = activeTickers.filter(
      (t) => !mergedSnapshots.some((s) => s.symbol === t),
    );
    if (failed.length > 0) {
      console.log(`⚠ 取得失敗: ${failed.join(", ")}`);
    }

    await writeFile(
      OUT_TECHNICALS_PATH,
      JSON.stringify(
        { generatedAt: new Date().toISOString(), snapshots: mergedSnapshots },
        null,
        2,
      ),
      "utf-8",
    );
  } catch (error) {
    console.error("[watchlist-data] テクニカル収集に失敗しました。空スナップショットで縮退します。", error);
    await writeFile(
      OUT_TECHNICALS_PATH,
      JSON.stringify({ generatedAt: new Date().toISOString(), snapshots: [] }),
      "utf-8",
    );
  }

  // ニュースブランチ（独立 try/catch — テクニカルブランチの成否に関わらず実行する, D-20/Pitfall 4）
  try {
    let articles: ReadonlyArray<NewsArticleWithId> = [];
    try {
      const raw = await readFile(NEWS_POOL_PATH, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      // tmp/news.json は別プロセス実行で書かれた JSON ファイルのため、publishedAt は
      // JSON往復後 string になっている（NewsArticlePoolEntry.publishedAt の契約と同一）。
      // buildHoldingNewsMap（無改変流用, D-13）は calculatePriorityScore 経由で
      // publishedAt.getTime() を呼ぶため、Date への復元が必須。
      articles = Array.isArray(parsed)
        ? (parsed as ReadonlyArray<Omit<NewsArticleWithId, "publishedAt"> & { publishedAt: string }>).map(
            (a) => ({ ...a, publishedAt: new Date(a.publishedAt) }),
          )
        : [];
    } catch {
      console.error(
        "[watchlist-data] tmp/news.json の読込に失敗しました。ニュースは全銘柄空配列で出力します。",
      );
      articles = [];
    }

    const holdings = toPortfolioHoldingShape(activeEntries);
    const newsMap: HoldingNewsFile = buildHoldingNewsMap(articles, holdings);

    await writeFile(OUT_NEWS_PATH, JSON.stringify(newsMap, null, 2), "utf-8");
  } catch (error) {
    console.error("[watchlist-data] ニュース収集に失敗しました。空マップで縮退します。", error);
    await writeFile(OUT_NEWS_PATH, JSON.stringify({}), "utf-8");
  }

  console.error("[STEP:watchlist-data:OK]");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(async (error) => {
    console.error("Fatal error:", error);
    try {
      await writeEmptyOutputs();
    } catch {
      // 出力先にも書けない場合は invest.md 側のフォールバックに委ねる
    }
    // D-03: [PIPELINE:FAIL] は出さない。process.exit ではなく exitCode を使う。
    process.exitCode = 1;
  });
}
