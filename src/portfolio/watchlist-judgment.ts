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
 * WR-02: 「throw なし」契約を関数自身が担保する defense-in-depth。prevJudgments が
 * 型に反して非配列・null 要素・非文字列 ticker を含んでも throw せず、不正要素は
 * 比較対象から除外する（呼び出し元の検証だけに依存しない — 前日比較は enrichment で
 * あり、不正な prev が当日出力を壊してはならない）。
 */
export function attachActionChanges<
  T extends { readonly ticker: string; readonly todayAction: "buy" | "wait" },
>(
  judgments: ReadonlyArray<T>,
  prevJudgments: ReadonlyArray<T> | null,
): ReadonlyArray<T & { previousAction?: "buy" | "wait"; actionChanged?: boolean }> {
  if (prevJudgments === null || !Array.isArray(prevJudgments)) {
    return judgments.map((j) => ({ ...j }));
  }

  const prevByTicker = new Map(
    prevJudgments
      .filter(
        (j): j is T =>
          typeof j === "object" && j !== null && typeof (j as { ticker?: unknown }).ticker === "string",
      )
      .map((j) => [normalizeHoldingSymbol(j.ticker), j] as const),
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
 * WR-04: 銘柄キー照合（normalizeHoldingSymbol: trim + toUpperCase）と同じ表記揺れ耐性を
 * 持たせるため、trim + ケースインセンシティブで判定する。schema は ticker を正規化しない
 * ため、LLM が `7203.t` や末尾空白付きでエコーしても US に誤分類しない。
 */
export function deriveMarket(ticker: string): "US" | "JP" {
  return /\.T$/i.test(ticker.trim()) ? "JP" : "US";
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
