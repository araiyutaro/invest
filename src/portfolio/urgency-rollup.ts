import { isValidDateKey } from "./urgency-history.js";
import type { HoldingUrgencySnapshot, UrgencyHistoryFile } from "./urgency-history.js";

/**
 * D-02: 窓内で検出された判断変化1件分。date は変化後（after側）の記録日。
 */
export interface DecisionChangeEvent {
  readonly date: string;
  readonly from: HoldingUrgencySnapshot["decision"];
  readonly to: HoldingUrgencySnapshot["decision"];
}

/**
 * D-03/D-05: 1銘柄分の週次ロールアップ。urgentDates/decisionChanges のいずれかが
 * 1件以上ある銘柄のみが WeeklyUrgencyRollup.symbols に含まれる。
 */
export interface WeeklySymbolRollup {
  readonly symbol: string;
  readonly nameJa: string;
  readonly urgentDates: ReadonlyArray<string>;
  readonly decisionChanges: ReadonlyArray<DecisionChangeEvent>;
}

/**
 * D-01: 7暦日ウィンドウ [windowStart, windowEnd] の集計結果。
 */
export interface WeeklyUrgencyRollup {
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly daysCovered: number;
  readonly symbols: ReadonlyArray<WeeklySymbolRollup>;
}

export function computeWeeklyUrgencyRollup(
  _history: UrgencyHistoryFile,
  _anchorDate: string,
): WeeklyUrgencyRollup {
  throw new Error("not implemented");
}

export function formatDateKeyShort(_dateKey: string): string {
  throw new Error("not implemented");
}
