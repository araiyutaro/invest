import { normalizeHoldingSymbol } from "./holding-news.js";
import { filterEtfStocks, type QuoteTypeLookup } from "./etf-exclusion.js";
import { isValidDateKey } from "./urgency-history.js";
import type { MeetingResult } from "../meeting/types.js";
import type { PortfolioHolding } from "./holdings.js";

/**
 * ウォッチリストからの除外理由（D-02 の正準 enum）。
 * REQUIREMENTS.md の値を採用する（research ARCHITECTURE の
 * verdict-downgrade/entered-portfolio という表記は採用しない）。
 */
export type WatchlistRemovedReason = "downgraded" | "purchased" | "expired";

/**
 * ウォッチリストから除外された1回分のエピソード記録。
 * 除外してもレコードは削除せず、history に追記して保持する（WLST-05, D-05）。
 * すべて YYYY-MM-DD 文字列（isValidDateKey で検証, D-03）。
 */
export interface WatchlistRemovalEpisode {
  readonly addedDate: string;
  readonly lastVerdictDate: string;
  readonly removedReason: WatchlistRemovedReason;
  readonly removedDate: string;
}

/**
 * ウォッチリスト1銘柄分のレコード。
 * D-06: 「active フィールド + history 配列」方式を採用する（episode 配列方式ではない）。
 * addedDate が存在すれば active、undefined なら除外済み（isActive 参照）。
 * ticker キーは normalizeHoldingSymbol で正規化済みの値と同一である前提。
 */
export interface WatchlistEntry {
  readonly ticker: string;
  readonly name?: string;
  readonly nameJa?: string;
  readonly addedDate?: string;
  readonly lastVerdictDate?: string;
  readonly history: ReadonlyArray<WatchlistRemovalEpisode>;
}

/**
 * data/watchlist.json のトップレベル形状。キーは normalizeHoldingSymbol 済み ticker。
 */
export type WatchlistFile = Record<string, WatchlistEntry>;

/**
 * admitBullishStocks に渡す新規候補の社名付きシェイプ。
 * name/nameJa は CLI ラッパーが batch quote() の longName/shortName から埋める（D-04/D-22）。
 */
export interface WatchlistCandidate {
  readonly ticker: string;
  readonly name?: string;
  readonly nameJa?: string;
}

/**
 * 失効までの暦日数（named constant, D-08/D-09）。マジックナンバー分散を禁止し、
 * この一箇所のみで定義する。
 */
export const EXPIRY_CALENDAR_DAYS = 30;

/**
 * WatchlistEntry が現在アクティブ（ウォッチリストに追跡中）かどうかを判定する。
 * addedDate が存在すれば active、undefined（除外済み・history のみ）なら非 active（D-06）。
 * 純関数・throw-free。
 */
export function isActive(entry: WatchlistEntry): boolean {
  return entry.addedDate !== undefined;
}

/**
 * WatchlistFile からアクティブなエントリのみを配列として返す。
 * Phase 29/30 が依存する安定シグネチャ（D-06）。純関数・throw-free・入力を mutate しない。
 */
export function getActiveWatchlistEntries(
  watchlist: WatchlistFile,
): ReadonlyArray<WatchlistEntry> {
  return Object.values(watchlist).filter(isActive);
}

/**
 * 名前情報（name/nameJa）を既存エントリ優先で補完する（既存優先、無ければ candidate 側を採用）。
 */
function mergeNameFields(
  existing: WatchlistEntry | undefined,
  candidateName: { readonly name?: string; readonly nameJa?: string } | undefined,
): { readonly name?: string; readonly nameJa?: string } {
  return {
    name: existing?.name ?? candidateName?.name,
    nameJa: existing?.nameJa ?? candidateName?.nameJa,
  };
}

/**
 * 当日 verdict 強気（ETF除外後）の銘柄をウォッチリストに admit（登録/再確認）する。
 * D-21: 新規候補は filterEtfStocks（第2ゲート）を必ず経由し、fail-closed（lookup 失敗は除外）を
 * 担保する。既に active な ticker は登録時に第2ゲート検証済み（D-22）のためバイパスし、
 * reconfirm（lastVerdictDate 更新）のみ行う — CLI は active 銘柄を quote() 対象から除外する
 * （D-22）ため、第2ゲートに通すと lookup 欠落 → fail-closed 除外となり lastVerdictDate が
 * 凍結して 31 日目に誤って expired される（WLST-01 の reconfirm 要件違反）。
 * WLST-03: PORTFOLIO_HOLDINGS（holdings 引数）に含まれる銘柄は admit 候補から除外する
 * （prune 側の purchased ゲートだけに依存しない二重防御。これがないと「保有中 + 当日強気」の
 * 未登録 ticker が active 登録され、翌 run の prune と隔日振動する）。
 * D-17: spread-merge（urgency-history.ts の冪等パターン踏襲）により同日複数回呼んでも結果が同一。
 * D-05: 除外済み（history あり・addedDate なし）の ticker が再度強気なら history を保持したまま
 * 新しい active エピソードとして再アクティブ化する。
 * D-23: quote() を一切呼ばない。ネットワーク非依存の純関数・throw-free・入力を mutate しない。
 * today は引数で受け取り、関数内で Date.now() や JST 再導出をしない（決定論性, D-13 の思想）。
 */
export function admitBullishStocks(
  watchlist: WatchlistFile,
  bullishStocks: MeetingResult["highlightedStocks"],
  quoteTypeByTicker: ReadonlyMap<string, QuoteTypeLookup>,
  nameByTicker: ReadonlyMap<string, { readonly name?: string; readonly nameJa?: string }>,
  holdings: ReadonlyArray<PortfolioHolding>,
  today: string,
): WatchlistFile {
  // WLST-03: 保有銘柄を admit 候補から除外する（防御的深層化）
  const held = new Set(holdings.map((h) => normalizeHoldingSymbol(h.symbol)));

  // 防御的に verdict==="強気" のみを対象にする（呼び出し側の絞り込みを信用しない）
  const bullishOnly = bullishStocks.filter(
    (s) => s.verdict === "強気" && !held.has(normalizeHoldingSymbol(s.ticker)),
  );

  // 既に active な ticker は reconfirm のみ（第2ゲートバイパス, D-22）。
  // prune 直後（同一実行内）に除外された銘柄はこの時点で非 active のため
  // reconfirm パスには乗らない（prune → admit の優先順は保たれる）。
  const isAlreadyActive = (ticker: string): boolean =>
    watchlist[normalizeHoldingSymbol(ticker)]?.addedDate !== undefined;
  const reconfirms = bullishOnly.filter((s) => isAlreadyActive(s.ticker));
  const newCandidates = bullishOnly.filter((s) => !isAlreadyActive(s.ticker));

  // D-21: 新規候補のみ filterEtfStocks（第2ゲート）を通し、kept のみを登録候補とする。
  // fail-closed は filterEtfStocks 自身が担保するため、ここでは変更せずそのまま呼ぶ。
  const { kept } = filterEtfStocks(newCandidates, quoteTypeByTicker);

  return [...reconfirms, ...kept].reduce<WatchlistFile>((acc, stock) => {
    const key = normalizeHoldingSymbol(stock.ticker);
    const existing = acc[key];
    const names = mergeNameFields(existing, nameByTicker.get(stock.ticker));

    const entry: WatchlistEntry = {
      ticker: key,
      name: names.name,
      nameJa: names.nameJa,
      addedDate: existing?.addedDate ?? today,
      lastVerdictDate: today,
      history: existing?.history ?? [],
    };

    return { ...acc, [key]: entry };
  }, watchlist);
}

/**
 * 暦日差を計算する（Date のミリ秒差から算出する軽量ロジック、D-07: 営業日/祝日カレンダー非依存）。
 */
function calendarDaysBetween(fromDateKey: string, toDateKey: string): number {
  return Math.round(
    (Date.parse(toDateKey) - Date.parse(fromDateKey)) / 86_400_000,
  );
}

/**
 * 現 active エピソードを WatchlistRemovalEpisode として history 末尾に append し、
 * active フィールド（addedDate/lastVerdictDate）を除去した新エントリを返す（WLST-05/D-05）。
 * レコード削除ではなく、history への追記による除外を行う。
 */
function removeEntry(
  entry: WatchlistEntry,
  reason: WatchlistRemovedReason,
  today: string,
): WatchlistEntry {
  const episode: WatchlistRemovalEpisode = {
    addedDate: entry.addedDate ?? today,
    lastVerdictDate: entry.lastVerdictDate ?? today,
    removedReason: reason,
    removedDate: today,
  };

  return {
    ticker: entry.ticker,
    name: entry.name,
    nameJa: entry.nameJa,
    addedDate: undefined,
    lastVerdictDate: undefined,
    // 手編集・旧フォーマットのファイルで history が欠落していても throw しない（防御的ガード）
    history: [...(entry.history ?? []), episode],
  };
}

/**
 * アクティブなウォッチリスト銘柄を3トリガー（downgraded/purchased/expired）で判定し、
 * 該当するものを除外する。優先順位は purchased > downgraded > expired（Pitfall 3 / D-05）。
 * 除外は「レコード削除」ではなく history への追記（WLST-05/D-05）。
 * D-12: purchased 判定は PORTFOLIO_HOLDINGS（holdings 引数）が正準ソース。
 * D-11: 当日 highlightedStocks に一切登場しない active 銘柄は現状維持（lastVerdictDate 据え置き）。
 * D-07: expired 判定は暦日ベースの単純計算（営業日/祝日カレンダー非依存）。
 * 純関数・throw-free・入力を mutate しない。
 */
export function pruneWatchlist(
  watchlist: WatchlistFile,
  todaysHighlighted: MeetingResult["highlightedStocks"],
  holdings: ReadonlyArray<PortfolioHolding>,
  today: string,
): WatchlistFile {
  const purchasedTickers = new Set(
    holdings.map((h) => normalizeHoldingSymbol(h.symbol)),
  );
  const highlightedByTicker = new Map(
    todaysHighlighted.map((s) => [normalizeHoldingSymbol(s.ticker), s] as const),
  );

  return Object.entries(watchlist).reduce<WatchlistFile>((acc, [key, entry]) => {
    if (!isActive(entry)) {
      return { ...acc, [key]: entry };
    }

    if (purchasedTickers.has(key)) {
      return { ...acc, [key]: removeEntry(entry, "purchased", today) };
    }

    const todaysStock = highlightedByTicker.get(key);
    if (todaysStock && (todaysStock.verdict === "中立" || todaysStock.verdict === "弱気")) {
      return { ...acc, [key]: removeEntry(entry, "downgraded", today) };
    }

    // isValidDateKey で日付形式を防御的に検証してから暦日差を計算する（D-03 の検証再利用）
    if (
      entry.lastVerdictDate &&
      isValidDateKey(entry.lastVerdictDate) &&
      isValidDateKey(today) &&
      calendarDaysBetween(entry.lastVerdictDate, today) > EXPIRY_CALENDAR_DAYS
    ) {
      return { ...acc, [key]: removeEntry(entry, "expired", today) };
    }

    // 現状維持（no-mention: lastVerdictDate 据え置き, D-11）
    return { ...acc, [key]: entry };
  }, watchlist);
}
