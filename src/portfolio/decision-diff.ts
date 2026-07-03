import { normalizeHoldingSymbol } from "./holding-news.js";
import type { HoldingEvaluation } from "../meeting/types.js";

/**
 * 当日 holdings と前日スナップショット prevHoldings を突き合わせ、decision enum の等値比較のみで
 * decisionChanged を決定論的に計算する（LLM自己申告ではない、PORT-05 / D-11 / D-13）。
 *
 * 当日 holdings を主入力（primary）としてループ駆動し、prevHoldings は Map によるルックアップ専用
 * （secondary）とする — resolvePortfolioHoldingNews と同じ規律（holding-news.ts 56-84行）。
 * これにより当日のみに存在する銘柄（保有リスト変更）も必ず出力に残る（前日側でループしない）。
 *
 * prevHoldings === null、または当日銘柄が前日リストに存在しない場合は previousDecision /
 * decisionChanged のプロパティ自体を付与しない（undefined と false を区別する、D-14）。
 *
 * 銘柄キー一致は normalizeHoldingSymbol（trim + toUpperCase）で行い、表記揺れに耐える（D-13）。
 *
 * 純関数: throw なし、I/O なし。入力配列は変更しない。
 */
export function attachDecisionChanges(
  holdings: ReadonlyArray<HoldingEvaluation>,
  prevHoldings: ReadonlyArray<HoldingEvaluation> | null,
): ReadonlyArray<HoldingEvaluation> {
  if (prevHoldings === null) {
    return holdings.map((h) => ({ ...h }));
  }

  const prevBySymbol = new Map(
    prevHoldings.map((h) => [normalizeHoldingSymbol(h.symbol), h] as const),
  );

  return holdings.map((h) => {
    const prev = prevBySymbol.get(normalizeHoldingSymbol(h.symbol));
    if (!prev) {
      return { ...h };
    }
    return {
      ...h,
      previousDecision: prev.decision,
      decisionChanged: prev.decision !== h.decision,
    };
  });
}
