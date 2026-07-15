import type { WatchlistEntry } from "./watchlist.js";
import type { PortfolioHolding } from "./holdings.js";
import type { TechnicalSnapshot } from "../data/technicals.js";

/**
 * D-14: WatchlistEntry[] を PortfolioHolding[] 形状に決定論的にマップする、
 * buildHoldingNewsMap（holding-news.ts）へ無改変で渡すための唯一のアダプタ。
 * entry.ticker は Phase 28 が normalizeHoldingSymbol 済みで保存している前提のため
 * 再正規化しない。sector は常に "" 固定（マッチングロジック未使用）。
 * matchAliases は省略する（D-15: 人手キュレーション不採用）。
 * [Rule 1 - Bug fix] name/nameJa は entry.ticker にフォールバックする（空文字列は不可）。
 * PortfolioHolding.nameJa は string 型必須のため undefined を渡せないが、空文字列を渡すと
 * holding-news.ts の titleIncludesAny が `"".includes("")===true` で常に真になり、
 * 日本語社名を持たない全銘柄が任意の記事タイトルに誤マッチする（全銘柄が name一致扱いになる
 * 構造的バグ）。ticker フォールバックなら記事タイトルへの偶発一致リスクが実質ゼロ。
 * WR-05: `??` は undefined のみ防ぎ `""` を素通しする。name/nameJa は yahoo-finance2 の
 * longName/shortName 由来（write-watchlist.ts）で空文字列混入が排除されていないため、
 * trim 判定で空文字列・空白のみの文字列も ticker にフォールバックする。
 * 純関数: throw なし、I/O なし。入力 entries は変更しない。
 */
export function toPortfolioHoldingShape(
  entries: ReadonlyArray<WatchlistEntry>,
): ReadonlyArray<PortfolioHolding> {
  return entries.map((entry) => ({
    symbol: entry.ticker,
    name: entry.name?.trim() ? entry.name : entry.ticker,
    nameJa: entry.nameJa?.trim() ? entry.nameJa : entry.ticker,
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

/**
 * D-09: マジックナンバー分散を禁止し、チャンクサイズ・チャンク間待機をこの1箇所のみで定義する。
 * 目安: 並列4〜5 / チャンク間200〜500ms（29-RESEARCH.md Pattern 2）。
 */
export const CHUNK_SIZE = 5;
export const CHUNK_DELAY_MS = 300;

/**
 * D-09: tmp/technicals.json の形状（Pattern 3: 同日キャッシュ read-through）。
 */
export interface TechnicalsCacheFile {
  readonly generatedAt: string;
  readonly snapshots: ReadonlyArray<TechnicalSnapshot>;
}

/**
 * 配列を固定サイズのチャンク配列に分割する純関数。
 * 純関数: throw なし、I/O なし。入力 items を mutate しない。
 */
export function chunk<T>(
  items: ReadonlyArray<T>,
  size: number,
): ReadonlyArray<ReadonlyArray<T>> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** チャンク間の待機ヘルパー。 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * D-09: tickers をチャンク分割し、チャンク単位で Promise.all 並列取得、チャンク間に待機を挟む。
 * atomic unit は必ず引数 fetchOne（Plan 02 で技術指標の単数取得関数を渡す）——
 * 技術指標の複数一括取得関数への依存は import も呼び出しも一切しない（Pitfall 1）。
 * D-17: fetchOne が null を返した ticker は結果配列から omit する（null 埋め・プレースホルダ禁止、
 * 既存 technicals.json 契約と同一）。fetchOne 自身が per-ticker try/catch を持つ前提だが、
 * WR-07: 万一 reject しても per-ticker try/catch で null 扱いにして omit するため、
 * Promise.all のチャンク単位分離・蓄積済み結果は破壊されない（TRAC-03/D-10）。
 */
export async function fetchChunked(
  tickers: ReadonlyArray<string>,
  fetchOne: (symbol: string) => Promise<TechnicalSnapshot | null>,
  delayMs: number = CHUNK_DELAY_MS,
): Promise<ReadonlyArray<TechnicalSnapshot>> {
  const results: TechnicalSnapshot[] = [];
  const batches = chunk(tickers, CHUNK_SIZE);
  for (let i = 0; i < batches.length; i++) {
    const batchResults = await Promise.all(
      // 明示ラムダで map の (element, index, array) 引数流入も防ぐ（IN-02）
      batches[i].map(async (symbol) => {
        try {
          return await fetchOne(symbol);
        } catch {
          // WR-07: reject は null（omit）として扱い、他 ticker・他チャンクの結果を保全する
          return null;
        }
      }),
    );
    results.push(...batchResults.filter((r): r is TechnicalSnapshot => r !== null));
    if (i < batches.length - 1) {
      await sleep(delayMs);
    }
  }
  return results;
}
