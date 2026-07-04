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

const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * D-01: 日付のみキー（YYYY-MM-DD）を UTC ミリ秒で加算し、再度 YYYY-MM-DD へ変換する。
 * ローカルタイムゾーンの Date getter は一切使わない（Pitfall 1: TZ依存の日ずれ回避）。
 */
function addDaysUtc(dateKey: string, days: number): string {
  const ms = Date.parse(`${dateKey}T00:00:00Z`) + days * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * CR-01: isValidDateKey は正規表現の形状のみ検証するため "2026-13-01" 等の暦日として
 * 実在しない値も通過してしまう。Date.parse に暦日を丸め込ませず（NaN も含め）実在する
 * 暦日のみを受理するため、パース結果を再度 YYYY-MM-DD に戻して往復一致を確認する。
 */
function isRealCalendarDate(dateKey: string): boolean {
  const ms = Date.parse(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(ms)) return false;
  return new Date(ms).toISOString().slice(0, 10) === dateKey;
}

interface TimelineEntry {
  readonly date: string;
  readonly urgent: boolean;
  readonly decision: HoldingUrgencySnapshot["decision"];
}

interface Timeline {
  readonly nameJa: string;
  readonly entries: ReadonlyArray<TimelineEntry>;
}

/**
 * D-01/D-02/D-03/D-04/D-05: data/urgency-history.json を anchorDate を起点とした
 * 7暦日ウィンドウ [anchor-6, anchor]（inclusive）に絞り込み、銘柄別に緊急フラグの
 * 発生日と判断変化イベントを集計する。判断変化は暦日隣接ではなく「記録済み日同士の
 * 隣接」で比較する（D-02）。symbol は Phase 25 で既に正規化済みのため再正規化しない
 * （D-04, normalizeHoldingSymbol は import しない）。
 *
 * 純関数: throw なし、I/O なし。入力 history / 内部配列を一切 mutate しない。
 * Object.keys(history) は isValidDateKey でフィルタしてから使用する（"__proto__" 等の
 * 汚染キーを構造的に拒否 — Pitfall 2）。
 */
export function computeWeeklyUrgencyRollup(
  history: UrgencyHistoryFile,
  anchorDate: string,
): WeeklyUrgencyRollup {
  if (!isValidDateKey(anchorDate) || !isRealCalendarDate(anchorDate)) {
    return { windowStart: anchorDate, windowEnd: anchorDate, daysCovered: 0, symbols: [] };
  }

  const windowStart = addDaysUtc(anchorDate, -(WINDOW_DAYS - 1));
  // WR-04: windowStart と同じ UTC 正規化パスを通す（anchorDate 自体は CR-01 で暦日実在性を
  // 検証済みのためロールオーバーは起きないが、windowStart/windowEnd の計算方式を統一する）。
  const windowEnd = addDaysUtc(anchorDate, 0);

  const matchedDates = Object.keys(history)
    .filter(isValidDateKey)
    .filter((d) => d >= windowStart && d <= windowEnd)
    .sort();

  const timelines = new Map<string, { nameJa: string; entries: TimelineEntry[] }>();

  for (const date of matchedDates) {
    const snapshots = history[date];
    if (!Array.isArray(snapshots)) continue;
    for (const s of snapshots) {
      if (!s || typeof s.symbol !== "string") continue;
      const timeline = timelines.get(s.symbol) ?? { nameJa: s.nameJa, entries: [] as TimelineEntry[] };
      timeline.entries.push({ date, urgent: s.urgent, decision: s.decision });
      timeline.nameJa = s.nameJa;
      timelines.set(s.symbol, timeline);
    }
  }

  const symbols: WeeklySymbolRollup[] = [];
  for (const [symbol, timeline] of timelines) {
    const { nameJa, entries } = timeline as Timeline;
    const urgentDates = entries.filter((e) => e.urgent).map((e) => e.date);
    const decisionChanges: DecisionChangeEvent[] = [];
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].decision !== entries[i - 1].decision) {
        decisionChanges.push({
          date: entries[i].date,
          from: entries[i - 1].decision,
          to: entries[i].decision,
        });
      }
    }
    if (urgentDates.length > 0 || decisionChanges.length > 0) {
      symbols.push({ symbol, nameJa, urgentDates, decisionChanges });
    }
  }

  return {
    windowStart,
    windowEnd,
    daysCovered: matchedDates.length,
    symbols: symbols.sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}

/**
 * D-07: YYYY-MM-DD の日付キーを MM/DD へ変換する純粋な文字列変換。Date オブジェクトを
 * 一切使わない（既存のJST日時フォーマッタはフルISO日時+時刻付き・非ゼロパディングのため
 * この用途には転用不可 — 別途スライスのみで実装する）。
 */
export function formatDateKeyShort(dateKey: string): string {
  return dateKey.slice(5).replace("-", "/");
}
