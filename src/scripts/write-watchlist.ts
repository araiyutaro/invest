import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import YahooFinance from "yahoo-finance2";
import {
  admitBullishStocks,
  pruneWatchlist,
  getActiveWatchlistEntries,
} from "../portfolio/watchlist.js";
import type { WatchlistFile } from "../portfolio/watchlist.js";
import { isValidDateKey } from "../portfolio/urgency-history.js";
import { normalizeHoldingSymbol } from "../portfolio/holding-news.js";
import type { QuoteTypeLookup } from "../portfolio/etf-exclusion.js";
import { PORTFOLIO_HOLDINGS } from "../portfolio/holdings.js";
import type { MeetingResult } from "../meeting/types.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const DATA_DIR = join(import.meta.dirname, "../../data");
const WATCHLIST_PATH = join(DATA_DIR, "watchlist.json");

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/**
 * D-18: ENOENT（欠損）と破損（JSON パース失敗等）を二段フェイルで厳密に分離する。
 * write-urgency-history.ts の loadExistingHistory を verbatim ベースに実装する。
 * ENOENT 判定は `.code` と `.message` の両方をチェックする（このコードベースの
 * テストモック規約 — プレーンな Error("ENOENT") で欠損をシミュレートするため）。
 */
export async function loadExistingWatchlist(): Promise<{
  watchlist: WatchlistFile;
  corrupted: boolean;
}> {
  try {
    const raw = await readFile(WATCHLIST_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    // JSON として valid でも形状が不正（null / 配列 / プリミティブ）な場合は corrupted 扱いにし、
    // D-18 の保全経路（上書きスキップ + FAIL マーカー）へ落とす。型キャストのみだと
    // main 側の `existingWatchlist[ticker]` 等で TypeError → fatal 経路に落ち、
    // [STEP:watchlist:FAIL:<reason>] マーカー契約が破られる。
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
 * D-04/D-22: batch quote() 1回で quoteType（ETF第2ゲート）と社名（longName/shortName）を
 * 同時に取得する（1コール2役、追加 API 呼び出しゼロ）。filter-etf-stocks.ts の
 * fetchQuoteTypes の batch quote() ループを流用する。batch 呼び出し自体の例外は
 * 呼び出し元（main）の try/catch へ伝播させる（filter-etf-stocks.ts と同じ
 * 「メカニズム故障」扱い）。
 */
export async function fetchQuoteTypesAndNames(
  tickers: ReadonlyArray<string>,
): Promise<{
  quoteTypeByTicker: ReadonlyMap<string, QuoteTypeLookup>;
  nameByTicker: ReadonlyMap<string, { name?: string; nameJa?: string }>;
}> {
  const quoteTypeByTicker = new Map<string, QuoteTypeLookup>();
  const nameByTicker = new Map<string, { name?: string; nameJa?: string }>();
  if (tickers.length === 0) return { quoteTypeByTicker, nameByTicker };

  const quotes = await yahooFinance.quote([...tickers]);
  // Array.isArray による防御的パース: yahoo-finance2 の overload は
  // 単一要素配列でも単体オブジェクトを返すブレがあり得るため備える。
  const quoteArray = Array.isArray(quotes) ? quotes : [quotes];
  for (const q of quoteArray) {
    const record = q as {
      symbol?: string;
      quoteType?: string;
      longName?: string;
      shortName?: string;
    };
    const symbol = record.symbol;
    if (!symbol) continue;

    // WR-03 対応: Map キーは normalizeHoldingSymbol で正規化し、admitBullishStocks 側の
    // 正規化済み lookup と対称にする（キー不一致 → fail-closed 誤除外を防ぐ）
    const key = normalizeHoldingSymbol(symbol);
    if (record.quoteType) {
      quoteTypeByTicker.set(key, { status: "ok", quoteType: record.quoteType });
    }
    nameByTicker.set(key, { name: record.longName ?? record.shortName, nameJa: undefined });
  }

  return { quoteTypeByTicker, nameByTicker };
}

/**
 * D-01/D-02/D-16: tmp/meeting-result.json（ETF除外・検証済み）+ data/watchlist.json（前日状態）+
 * PORTFOLIO_HOLDINGS を入力に prune→admit を実行し data/watchlist.json を更新する
 * fail-soft CLI ラッパー。すべての I/O・batch quote() 呼び出し・process.exit をここに集約する。
 */
export async function main(): Promise<void> {
  // Pitfall 1 対策: data/ は `git add docs/ data/` が exit 128 で失敗しないよう、
  // 以降のスキップ/失敗分岐に関わらず必ず作成する。
  await mkdir(DATA_DIR, { recursive: true });

  const { watchlist: existingWatchlist, corrupted } = await loadExistingWatchlist();
  if (corrupted) {
    // D-18: 既存ファイルを保全するため上書きせず、破損を可視化して終了する。
    console.error(
      "[watchlist] 既存の data/watchlist.json が破損しています。保全のため今回の書き込みをスキップします。",
    );
    console.error("[STEP:watchlist:FAIL:corrupted]");
    return;
  }

  let meetingResult: MeetingResult;
  try {
    const raw = await readFile(join(TMP_DIR, "meeting-result.json"), "utf-8");
    meetingResult = JSON.parse(raw) as MeetingResult;
  } catch (error) {
    console.error(
      "[watchlist] tmp/meeting-result.json の読み込みに失敗しました。書き込みをスキップします。",
      error,
    );
    console.error("[STEP:watchlist:FAIL:meeting-read]");
    return;
  }

  const dateKey = meetingResult.date;
  if (!isValidDateKey(dateKey)) {
    console.error(`[watchlist] 不正なdateキー形式: ${dateKey}`);
    console.error("[STEP:watchlist:FAIL:invalid-date]");
    return;
  }

  // ticker を欠く不正要素は除外する（LLM 生成 JSON の防御, Phase 27 の fail-soft ガードと同規約）。
  // 欠落要素があると normalizeHoldingSymbol(undefined).trim() で fatal クラッシュし
  // FAIL マーカー契約が破られるため、ここでフィルタする。
  const highlightedStocks = (meetingResult.highlightedStocks ?? []).filter(
    (s) => typeof s?.ticker === "string",
  );
  const bullishStocks = highlightedStocks.filter((s) => s.verdict === "強気");

  // D-22: 既存登録済み（active）の ticker は再検証不要。未登録の当日強気銘柄のみ quote() 対象にする。
  // WR-03 対応: watchlist キーは正規化済みのため、照合前に normalizeHoldingSymbol を適用する
  // （未正規化のまま照合すると active 銘柄を新規候補と誤判定し重複 quote 取得が発生する）。
  const candidateTickers = bullishStocks
    .map((s) => normalizeHoldingSymbol(s.ticker))
    .filter((ticker) => !existingWatchlist[ticker]?.addedDate);

  let quoteTypeByTicker: ReadonlyMap<string, QuoteTypeLookup>;
  let nameByTicker: ReadonlyMap<string, { name?: string; nameJa?: string }>;
  try {
    const fetched = await fetchQuoteTypesAndNames(candidateTickers);
    quoteTypeByTicker = fetched.quoteTypeByTicker;
    nameByTicker = fetched.nameByTicker;
  } catch (error) {
    console.error(
      "[watchlist] quoteType/社名一括取得に失敗しました。書き込みをスキップします。",
      error,
    );
    console.error("[STEP:watchlist:FAIL:quote]");
    return;
  }

  // Pitfall 3: prune を admit より先に実行する。purchased は admit 側の holdings ゲート
  // （WLST-03 の二重防御）でも除外されるため prune の結果が同一 run 内で打ち消されることはなく、
  // downgraded（当日 中立/弱気）はそもそも bullishStocks に含まれない。expired された銘柄が
  // 当日強気なら新規候補として第2ゲートを経て再登録される（D-05 の re-admission）。
  const pruned = pruneWatchlist(existingWatchlist, highlightedStocks, PORTFOLIO_HOLDINGS, dateKey);
  const result = admitBullishStocks(
    pruned,
    bullishStocks,
    quoteTypeByTicker,
    nameByTicker,
    PORTFOLIO_HOLDINGS,
    dateKey,
  );

  await writeFile(WATCHLIST_PATH, JSON.stringify(result, null, 2), "utf-8");

  const active = getActiveWatchlistEntries(result).length;
  const removed = Object.keys(result).length - active;
  console.log(`[watchlist] active=${active}件, removed=${removed}件`);
  console.error("[STEP:watchlist:OK]");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
