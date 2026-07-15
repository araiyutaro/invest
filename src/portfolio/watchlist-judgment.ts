import { normalizeHoldingSymbol } from "./holding-news.js";
import type { WatchlistJudgment } from "../meeting/types.js";

/**
 * confluence ゲート（D-07）: todayAction === "buy" かつ signals が2件未満の場合のみ
 * "wait" へ決定論的に降格する。**必ず transform 後の正準 signals を読む**（raw の alias
 * キーを読まない、Pitfall 3）。スキーマ変換とは別関数として分離し、既に正準化済みの
 * judgment 形状のみを受け取る。
 *
 * 純関数: throw なし、I/O なし。降格時のみ console.warn で理由（signals件数）を出す。
 */
export function applyConfluenceGate(judgment: {
  readonly todayAction: "buy" | "wait";
  readonly signals: readonly string[];
}): { readonly todayAction: "buy" | "wait"; readonly downgraded: boolean } {
  if (judgment.todayAction === "buy" && judgment.signals.length < 2) {
    console.warn(
      `[watchlist-judgment] confluence未達のためwaitへ降格: signals=${judgment.signals.length}件`,
    );
    return { todayAction: "wait", downgraded: true };
  }
  return { todayAction: judgment.todayAction, downgraded: false };
}

/**
 * 当日 judgments と前日スナップショット prevJudgments を突き合わせ、todayAction enum の
 * 等値比較のみで actionChanged を決定論的に計算する（LLM自己申告ではない、D-11/D-15）。
 *
 * decision-diff.ts の attachDecisionChanges と同一の規律で実装する:
 * 当日 judgments を主入力（primary）としてループ駆動し、prevJudgments は Map による
 * ルックアップ専用（secondary）とする。これにより当日のみに存在する銘柄も必ず出力に残る
 * （前日側でループしない）。
 *
 * prevJudgments === null、または当日銘柄が前日リストに存在しない場合は previousAction /
 * actionChanged のプロパティ自体を付与しない（undefined と false を区別する）。
 *
 * 銘柄キー一致は normalizeHoldingSymbol（trim + toUpperCase）で行い、表記揺れに耐える（D-13）。
 *
 * 純関数: throw なし、I/O なし。入力配列は変更しない。
 */
export function attachActionChanges<
  T extends { readonly ticker: string; readonly todayAction: "buy" | "wait" },
>(
  judgments: ReadonlyArray<T>,
  prevJudgments: ReadonlyArray<T> | null,
): ReadonlyArray<T & { previousAction?: "buy" | "wait"; actionChanged?: boolean }> {
  if (prevJudgments === null) {
    return judgments.map((j) => ({ ...j }));
  }

  const prevByTicker = new Map(
    prevJudgments.map((j) => [normalizeHoldingSymbol(j.ticker), j] as const),
  );

  return judgments.map((j) => {
    const prev = prevByTicker.get(normalizeHoldingSymbol(j.ticker));
    if (!prev) {
      return { ...j };
    }
    return {
      ...j,
      previousAction: prev.todayAction,
      actionChanged: prev.todayAction !== j.todayAction,
    };
  });
}

/**
 * ティッカーの市場を決定論的に導出する（D-13）。extract-tickers.ts の `.T` サフィックス
 * 規約に準拠する。
 */
export function deriveMarket(ticker: string): "US" | "JP" {
  return /\.T$/.test(ticker) ? "JP" : "US";
}

/**
 * テクニカルスナップショット欠落銘柄の陽性 skip レコードを生成する（D-20）。
 * 省略ではなく陽性レコード（Pitfall 5）: 判定不能を明示的に記録し、下流のレポート描画が
 * 「今日データが無く判定不能」と「そもそもウォッチリストに存在しない」を区別できるようにする。
 * asOf は付与しない（undefined のまま）。
 */
export function buildSkippedJudgment(ticker: string): WatchlistJudgment {
  return {
    ticker,
    todayAction: "wait",
    rationale: "テクニカルデータ欠落のため判定不能",
    signals: [],
    market: deriveMarket(ticker),
    status: "skipped",
  };
}
