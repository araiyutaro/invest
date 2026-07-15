import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchTechnicalSnapshot } from "../data/technicals.js";
import type { TechnicalSnapshot } from "../data/technicals.js";
import { getActiveWatchlistEntries } from "../portfolio/watchlist.js";
import type { WatchlistFile, WatchlistEntry } from "../portfolio/watchlist.js";
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
    // WR-03: エントリレベルの形状検証。値が null / 非オブジェクト / ticker 欠落のエントリを
    // 除外する。型キャストのみだと isActive(entry) の addedDate アクセスで TypeError →
    // fatal 経路に落ち [STEP:watchlist-data:FAIL:corrupted] マーカー契約が破られる
    // （write-watchlist.ts の loadExistingWatchlist と同じ理由付け、Phase 28 WR-02 と同水準）。
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      ([, v]) =>
        typeof v === "object" && v !== null && typeof (v as WatchlistEntry).ticker === "string",
    );
    return { watchlist: Object.fromEntries(entries) as WatchlistFile, corrupted: false };
  } catch (error) {
    const isMissing =
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      (error instanceof Error && error.message.includes("ENOENT"));
    return isMissing ? { watchlist: {}, corrupted: false } : { watchlist: {}, corrupted: true };
  }
}

/** JST（UTC+9）オフセット。generatedAt の同日判定にのみ使用する。 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * D-12: tmp/technicals.json の fail-soft 読込（同日キャッシュ）。
 * 欠損（ENOENT）・パース失敗・snapshots が配列でない場合は空配列にフォールバックする
 * （警告ログのみ、キャッシュは最適化であり正しさの依存点にしない）。
 * WR-01: generatedAt が当日（JST）でないキャッシュは全体を無視する — 前回 run の
 * 残留ファイルや単体実行時に前日の株価・RSI が「当日テクニカル」として流れるのを防ぐ。
 * generatedAt は UTC ISO 文字列（Step 2b が new Date().toISOString() で生成）のため、
 * 生成時刻・現在時刻の双方を JST 日付へ変換してから比較する（JST 朝の実行では
 * UTC 日付が前日になるため、UTC 日付同士・UTC-JST 混在の比較は誤判定する）。
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
    const todayJst = new Date(Date.now() + JST_OFFSET_MS).toISOString().slice(0, 10);
    const generatedAtMs = Date.parse(String((parsed as TechnicalsCacheFile).generatedAt ?? ""));
    const generatedDayJst = Number.isNaN(generatedAtMs)
      ? ""
      : new Date(generatedAtMs + JST_OFFSET_MS).toISOString().slice(0, 10);
    if (generatedDayJst !== todayJst) {
      console.error(
        "[watchlist-data] tmp/technicals.json が当日生成ではないためキャッシュを無視します",
      );
      return [];
    }
    // WR-02: 要素レベルの形状検証（D-12: キャッシュは正しさの依存点にしない）。
    // null や symbol を欠く不正要素が1件混入しただけでテクニカルブランチ全体が
    // 外側 catch で空縮退するのを防ぎ、不正要素のみ除外して残りを活かす。
    return (parsed as TechnicalsCacheFile).snapshots.filter(
      (s): s is TechnicalSnapshot =>
        typeof s === "object" && s !== null && typeof (s as TechnicalSnapshot).symbol === "string",
    );
  } catch {
    // ENOENT・パース失敗を区別せず fail-soft（D-12）
    return [];
  }
}

/**
 * WR-06: tmp/news.json 記事要素の形状検証。要素1件の破損（null・title 非文字列・
 * publishedAt 欠落/不正）でニュースマップ全体が {} に縮退したり、Invalid Date 由来の
 * NaN スコアが出力へ混入するのを防ぐ（D-20 fail-soft: 不正要素のみ除外し正常記事は保持）。
 * buildHoldingNewsMap（無改変流用, D-13）の throw-free 契約は正しい入力が前提のため、
 * 呼び出し側であるここが入力を保証する。
 */
function isValidPoolArticle(
  a: unknown,
): a is Omit<NewsArticleWithId, "publishedAt"> & { publishedAt: string } {
  if (typeof a !== "object" || a === null) return false;
  const r = a as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.title === "string" &&
    typeof r.publishedAt === "string" &&
    !Number.isNaN(Date.parse(r.publishedAt))
  );
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
      // WR-06: isValidPoolArticle で不正要素を除外してから復元する。
      articles = Array.isArray(parsed)
        ? parsed
            .filter(isValidPoolArticle)
            .map((a) => ({ ...a, publishedAt: new Date(a.publishedAt) }))
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
      // 出力先にも書けない場合は invest.md 側のフォールバック
      //（Step 2i: マーカー無し終了時の空JSON書き込み指示）に委ねる
    }
    // WR-04: fatal 経路でも STEP マーカー契約を守る（OK/FAIL いずれも出ない run を防ぐ）。
    // D-03: [PIPELINE:FAIL] は出さない。process.exit ではなく exitCode を使う。
    console.error("[STEP:watchlist-data:FAIL:fatal]");
    process.exitCode = 1;
  });
}
