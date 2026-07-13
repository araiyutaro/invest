import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface DailyBar {
  readonly date: string; // YYYY-MM-DD
  readonly close: number;
  readonly volume: number | null;
}

export interface TechnicalSnapshot {
  readonly symbol: string;
  readonly asOf: string; // 最終バーの日付 YYYY-MM-DD
  readonly price: number;
  readonly changePercent: number | null;
  readonly ma20: number | null;
  readonly ma50: number | null;
  readonly ma200: number | null;
  readonly pctFromMa50: number | null;
  readonly pctFromMa200: number | null;
  readonly rsi14: number | null;
  readonly fiftyTwoWeekHigh: number | null;
  readonly fiftyTwoWeekLow: number | null;
  readonly pctFrom52wHigh: number | null;
  readonly volumeRatio: number | null; // 直近出来高 / 過去3ヶ月平均（当日を除く）
  readonly trendLabel: string;
}

export function computeSMA(
  values: ReadonlyArray<number>,
  period: number,
): number | null {
  if (period <= 0 || values.length < period) return null;
  const window = values.slice(-period);
  return window.reduce((acc, v) => acc + v, 0) / period;
}

export function computeRSI(
  closes: ReadonlyArray<number>,
  period = 14,
): number | null {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const seed = changes.slice(0, period);
  const seedGain =
    seed.reduce((acc, c) => acc + Math.max(c, 0), 0) / period;
  const seedLoss =
    seed.reduce((acc, c) => acc + Math.max(-c, 0), 0) / period;
  // Wilder方式の平滑化
  const { gain, loss } = changes.slice(period).reduce(
    (acc, change) => ({
      gain: (acc.gain * (period - 1) + Math.max(change, 0)) / period,
      loss: (acc.loss * (period - 1) + Math.max(-change, 0)) / period,
    }),
    { gain: seedGain, loss: seedLoss },
  );
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
}

export function classifyTrend(input: {
  readonly price: number;
  readonly ma50: number | null;
  readonly ma200: number | null;
  readonly rsi14: number | null;
}): string {
  const { price, ma50, ma200, rsi14 } = input;
  const base =
    ma50 === null || ma200 === null
      ? "トレンド判定不能（移動平均データ不足）"
      : price > ma50 && price > ma200
        ? "上昇トレンド（50日線・200日線の上）"
        : price < ma50 && price < ma200
          ? "下降トレンド（50日線・200日線割れ）"
          : "レンジ/転換点（50日線と200日線の間）";
  const rsiNote =
    rsi14 === null
      ? ""
      : rsi14 >= 70
        ? `・RSI過熱圏(${Math.round(rsi14)})`
        : rsi14 <= 30
          ? `・RSI売られ過ぎ圏(${Math.round(rsi14)})`
          : "";
  return base + rsiNote;
}

function pctFrom(price: number, ref: number | null): number | null {
  if (ref === null || ref === 0) return null;
  return (price / ref - 1) * 100;
}

export function buildSnapshot(
  symbol: string,
  bars: ReadonlyArray<DailyBar>,
): TechnicalSnapshot | null {
  if (bars.length === 0) return null;
  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : null;

  const yearCloses = closes.slice(-252);
  const ma50 = computeSMA(closes, 50);
  const ma200 = computeSMA(closes, 200);
  const rsi14 = computeRSI(closes, 14);
  const high52w = yearCloses.length > 0 ? Math.max(...yearCloses) : null;

  const volumes = bars
    .slice(-64, -1)
    .map((b) => b.volume)
    .filter((v): v is number => v !== null && v > 0);
  const avgVolume =
    volumes.length > 0
      ? volumes.reduce((acc, v) => acc + v, 0) / volumes.length
      : null;

  return {
    symbol,
    asOf: last.date,
    price: last.close,
    changePercent: pctFrom(last.close, prevClose),
    ma20: computeSMA(closes, 20),
    ma50,
    ma200,
    pctFromMa50: pctFrom(last.close, ma50),
    pctFromMa200: pctFrom(last.close, ma200),
    rsi14,
    fiftyTwoWeekHigh: high52w,
    fiftyTwoWeekLow: yearCloses.length > 0 ? Math.min(...yearCloses) : null,
    pctFrom52wHigh: pctFrom(last.close, high52w),
    volumeRatio:
      avgVolume !== null && last.volume !== null && last.volume > 0
        ? last.volume / avgVolume
        : null,
    trendLabel: classifyTrend({ price: last.close, ma50, ma200, rsi14 }),
  };
}

export async function fetchTechnicalSnapshot(
  symbol: string,
): Promise<TechnicalSnapshot | null> {
  try {
    const period1 = new Date(Date.now() - 420 * 24 * 60 * 60 * 1000);
    const result = await yahooFinance.chart(symbol, {
      period1,
      interval: "1d",
    });
    const bars: ReadonlyArray<DailyBar> = result.quotes
      .filter((q) => q.close !== null)
      .map((q) => ({
        date: q.date.toISOString().slice(0, 10),
        close: q.close as number,
        volume: q.volume ?? null,
      }));
    return buildSnapshot(symbol, bars);
  } catch (error) {
    console.error(`Failed to fetch technicals for ${symbol}:`, error);
    return null;
  }
}

export async function fetchTechnicalSnapshots(
  symbols: ReadonlyArray<string>,
): Promise<ReadonlyArray<TechnicalSnapshot>> {
  const results = await Promise.all(symbols.map(fetchTechnicalSnapshot));
  return results.filter((r): r is TechnicalSnapshot => r !== null);
}
