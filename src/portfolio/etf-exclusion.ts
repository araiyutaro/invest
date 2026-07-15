import type { MeetingResult } from "../meeting/types.js";

/**
 * yahoo-finance2 の quote() 結果から得られる1銘柄分の quoteType 照合結果。
 * D-01/D-13: "ok" と "failed" を判別可能ユニオンで区別し、
 * 「非EQUITYと判定された」と「lookup自体に失敗した」を混同しないようにする（Pitfall 3対策）。
 */
export type QuoteTypeLookup =
  | { readonly status: "ok"; readonly quoteType: string }
  | { readonly status: "failed" };

/**
 * filterEtfStocks の返り値。kept は EQUITY と判定された銘柄、
 * excluded は除外された銘柄とその理由（D-13の監査ログの根拠）。
 */
export interface EtfExclusionResult {
  readonly kept: ReadonlyArray<MeetingResult["highlightedStocks"][number]>;
  readonly excluded: ReadonlyArray<{
    readonly ticker: string;
    readonly reason: "etf" | "lookup-failed";
    readonly quoteType?: string;
  }>;
}

/**
 * D-04: allowlist 方式の判定基準。quoteType がこの値と一致する銘柄のみ通過する。
 * ETF / MUTUALFUND / INDEX 等の非EQUITY型はすべて除外される（denylistではない）。
 */
const ALLOWED_QUOTE_TYPE = "EQUITY";

/**
 * D-01/D-04: highlightedStocks を quoteType に基づき決定論的にフィルタする純関数。
 * quoteType === "EQUITY" の銘柄のみ kept に残し（D-04 allowlist）、
 * lookup 失敗（map未登録 or status:"failed"）の銘柄は fail-closed で除外する（D-01）。
 * ネットワーク・ファイルI/Oを一切持たず、入力 stocks / quoteTypeByTicker を mutate しない。
 */
export function filterEtfStocks(
  stocks: MeetingResult["highlightedStocks"],
  quoteTypeByTicker: ReadonlyMap<string, QuoteTypeLookup>,
): EtfExclusionResult {
  const kept: Array<MeetingResult["highlightedStocks"][number]> = [];
  const excluded: Array<{
    ticker: string;
    reason: "etf" | "lookup-failed";
    quoteType?: string;
  }> = [];

  for (const stock of stocks) {
    const lookup = quoteTypeByTicker.get(stock.ticker);
    if (!lookup || lookup.status === "failed") {
      // D-01: fail-closed — lookup失敗は疑わしきは除外
      excluded.push({ ticker: stock.ticker, reason: "lookup-failed" });
      continue;
    }
    if (lookup.quoteType !== ALLOWED_QUOTE_TYPE) {
      // D-04: allowlist — EQUITY以外はすべて除外
      excluded.push({ ticker: stock.ticker, reason: "etf", quoteType: lookup.quoteType });
      continue;
    }
    kept.push(stock);
  }

  return { kept, excluded };
}
