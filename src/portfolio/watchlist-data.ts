import type { WatchlistEntry } from "./watchlist.js";
import type { PortfolioHolding } from "./holdings.js";
import type { TechnicalSnapshot } from "../data/technicals.js";

/**
 * D-14: WatchlistEntry[] を PortfolioHolding[] 形状に決定論的にマップする、
 * buildHoldingNewsMap（holding-news.ts）へ無改変で渡すための唯一のアダプタ。
 * entry.ticker は Phase 28 が normalizeHoldingSymbol 済みで保存している前提のため
 * 再正規化しない。sector は常に "" 固定（マッチングロジック未使用）。
 * matchAliases は省略する（D-15: 人手キュレーション不採用）。
 * 純関数: throw なし、I/O なし。入力 entries は変更しない。
 */
export function toPortfolioHoldingShape(
  entries: ReadonlyArray<WatchlistEntry>,
): ReadonlyArray<PortfolioHolding> {
  return entries.map((entry) => ({
    symbol: entry.ticker,
    name: entry.name ?? entry.ticker,
    nameJa: entry.nameJa ?? "",
    sector: "",
  }));
}

/**
 * D-11: アクティブ ticker と同日キャッシュ snapshots を突き合わせ、
 * キャッシュヒット集合と新規取得が必要な欠落 ticker を返す。
 * activeTickers・cached の symbol は正規化済みキー同士の比較を前提とする
 * （外部由来 symbol の正規化は呼び出し側 CLI の責務）。
 * 純関数: throw なし、I/O なし。入力を mutate しない。
 */
export function mergeWithCache(
  activeTickers: ReadonlyArray<string>,
  cached: ReadonlyArray<TechnicalSnapshot>,
): { readonly cachedTickers: ReadonlySet<string>; readonly missingTickers: ReadonlyArray<string> } {
  const cachedTickers = new Set(cached.map((s) => s.symbol));
  const missingTickers = activeTickers.filter((t) => !cachedTickers.has(t));
  return { cachedTickers, missingTickers };
}
