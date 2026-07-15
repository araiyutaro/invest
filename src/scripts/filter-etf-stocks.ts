import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import YahooFinance from "yahoo-finance2";
import { filterEtfStocks } from "../portfolio/etf-exclusion.js";
import type { QuoteTypeLookup } from "../portfolio/etf-exclusion.js";
import type { MeetingResult } from "../meeting/types.js";

const TMP_DIR = join(import.meta.dirname, "../../tmp");
const MEETING_RESULT_PATH = join(TMP_DIR, "meeting-result.json");

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/**
 * D-05: quoteType の照合は yahoo-finance2 の batch quote()（配列引数）1回で実施する。
 * per-ticker の逐次/Promise.all 呼び出しは禁止（レート制限リスクの構造的回避）。
 * 応答に含まれない要求 ticker は map 未登録のまま残り、呼び出し元（filterEtfStocks）が
 * fail-closed（lookup-failed）として扱う。batch 呼び出し自体の例外は main() の
 * try/catch へ伝播させ、フィルタ機構全体の故障（D-02 fail-soft）として扱う。
 */
async function fetchQuoteTypes(
  tickers: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, QuoteTypeLookup>> {
  const result = new Map<string, QuoteTypeLookup>();
  if (tickers.length === 0) return result;

  const quotes = await yahooFinance.quote([...tickers]);
  // Array.isArray による防御的パース: yahoo-finance2 の overload は
  // 単一要素配列でも単体オブジェクトを返すブレがあり得るため備える。
  const quoteArray = Array.isArray(quotes) ? quotes : [quotes];
  for (const q of quoteArray) {
    const symbol = (q as { symbol?: string }).symbol;
    const quoteType = (q as { quoteType?: string }).quoteType;
    if (symbol && quoteType) {
      result.set(symbol, { status: "ok", quoteType });
    }
  }

  return result;
}

/**
 * D-06/D-07: tmp/meeting-result.json を読み、単一 batch quote() で quoteType を照合し、
 * ETF除外済みの highlightedStocks で同ファイルをイミュータブルに書き戻す fail-soft CLI。
 * 読み込み・quote 取得のいずれかが失敗した場合は writeFile に到達させず、
 * 元ファイルを維持する（D-02, Pitfall 4）。
 */
export async function main(): Promise<void> {
  let meetingResult: MeetingResult;
  try {
    const raw = await readFile(MEETING_RESULT_PATH, "utf-8");
    meetingResult = JSON.parse(raw) as MeetingResult;
  } catch (error) {
    // D-02: 読み込み/パース自体の失敗はメカニズム全体の故障。ファイルには一切触れず終了。
    console.error(
      "[filter-etf-stocks] FAIL: tmp/meeting-result.json の読み込みに失敗しました。フィルタをスキップします。",
      error,
    );
    process.exitCode = 1;
    return;
  }

  const tickers = meetingResult.highlightedStocks.map((s) => s.ticker);
  if (tickers.length === 0) {
    console.error("[filter-etf-stocks] OK (skip: highlightedStocks 0件)");
    return;
  }

  let quoteTypeByTicker: ReadonlyMap<string, QuoteTypeLookup>;
  try {
    quoteTypeByTicker = await fetchQuoteTypes(tickers);
  } catch (error) {
    // D-02: batch quote() 呼び出し自体の例外はメカニズム故障。元ファイルを維持して終了。
    console.error(
      "[filter-etf-stocks] FAIL: quoteType一括取得に失敗しました。フィルタをスキップします。",
      error,
    );
    process.exitCode = 1;
    return;
  }

  const { kept, excluded } = filterEtfStocks(meetingResult.highlightedStocks, quoteTypeByTicker);

  for (const item of excluded) {
    // D-13: 除外理由（ETF判定 / lookup失敗）を stdout に区別して記録する。
    if (item.reason === "etf") {
      console.log(`ETF除外: ${item.ticker} (quoteType=${item.quoteType})`);
    } else {
      console.log(`ETF除外: ${item.ticker} (quoteType取得失敗, fail-closed)`);
    }
  }

  // D-09: highlightedStocks の要素除去のみ。スキーマにフィールドは追加しない。
  const updated: MeetingResult = { ...meetingResult, highlightedStocks: kept };
  await writeFile(MEETING_RESULT_PATH, JSON.stringify(updated, null, 2), "utf-8");
  console.error(`[filter-etf-stocks] OK: ${excluded.length}件除外, ${kept.length}件残存`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
