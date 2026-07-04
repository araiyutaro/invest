import { normalizeHoldingSymbol } from "./holding-news.js";
import type { PortfolioAnalysis } from "../meeting/types.js";

/**
 * data/urgency-history.json の1日1銘柄分のスナップショット。
 * D-02: 保存フィールドは symbol/nameJa/urgent/decision の4つのみ。
 * rationale/riskNote/previousDecision/decisionChanged は保存しない（二重情報源防止）。
 */
export interface HoldingUrgencySnapshot {
  readonly symbol: string;
  readonly nameJa: string;
  readonly urgent: boolean;
  readonly decision: "保持" | "買増" | "一部売却" | "全売却";
}

/**
 * data/urgency-history.json のトップレベル形状。
 * D-01: 日付キー（YYYY-MM-DD）のオブジェクトとし、同日は上書き（配列ではなくキー代入で重複を構造的に防止）。
 */
export type UrgencyHistoryFile = Record<string, ReadonlyArray<HoldingUrgencySnapshot>>;

/**
 * D-02, D-10: PortfolioAnalysis.holdings から最小4フィールドを決定論的に抽出する。
 * symbol は normalizeHoldingSymbol で正規化してから保存する。
 * 純関数: throw なし、I/O なし。入力 analysis は変更しない。
 */
export function extractUrgencySnapshots(
  analysis: PortfolioAnalysis,
): ReadonlyArray<HoldingUrgencySnapshot> {
  throw new Error("not implemented");
}

/**
 * D-04: 同日ガードは日付キー上書き。immutable spread で history を一切 mutate しない。
 * オブジェクトの同一キー代入なので重複は構造的に不可能。
 */
export function appendUrgencySnapshot(
  history: UrgencyHistoryFile,
  dateKey: string,
  snapshots: ReadonlyArray<HoldingUrgencySnapshot>,
): UrgencyHistoryFile {
  throw new Error("not implemented");
}

/**
 * D-06: 書き込み前の date キー検証。Step 4 デプロイと同一の正規表現。
 * "__proto__" のような prototype-pollution 狙いのキーも構造的に拒否する。
 */
export function isValidDateKey(dateKey: string): boolean {
  throw new Error("not implemented");
}
