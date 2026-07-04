import { normalizeHoldingSymbol } from "../portfolio/holding-news.js";
import type { NewsCuration, MeetingResult } from "./types.js";

/**
 * ティッカー一致の注記。verdict は highlightedStocks 由来。
 * scoredTickers のみ一致（highlightedStocks 非該当）の場合は verdict なし (D-05)。
 */
export interface DigestTickerMatch {
  readonly symbol: string;
  readonly verdict?: "強気" | "中立" | "弱気";
}

/** テーマキーワード一致の注記（D-06）。 */
export interface DigestThemeMatch {
  readonly keyword: string;
}

/**
 * 1記事あたりのクロスリファレンス結果。
 * ticker一致がある場合は themeMatches は常に空（D-04: early-continue）。
 */
export interface DigestCrossRef {
  readonly tickerMatches: ReadonlyArray<DigestTickerMatch>;
  readonly themeMatches: ReadonlyArray<DigestThemeMatch>;
}

/** 記事IDをキーとするクロスリファレンスマップ。一致0件の記事はキーとして存在しない。 */
export type DigestCrossRefMap = Record<string, DigestCrossRef>;

/** 1記事あたりのティッカー一致キャップ（D-10）。 */
const MAX_TICKER_MATCHES_PER_ARTICLE = 2;
/** 1記事あたりのテーマ一致キャップ（D-10）。 */
const MAX_THEME_MATCHES_PER_ARTICLE = 1;

/**
 * タイトルに候補文字列のいずれかが含まれるか大小文字区別なしで判定する。
 * holding-news.ts:105-111 の titleIncludesAny を移植（D-15と同じ再利用方針）。
 */
function titleIncludesAny(
  title: string,
  candidates: ReadonlyArray<string>,
): boolean {
  const lowerTitle = title.toLowerCase();
  return candidates.some((c) => lowerTitle.includes(c.toLowerCase()));
}

/**
 * sectorRecommendations[].sector の実データ形式（例: "Healthcare (XLV)"）から
 * 末尾の括弧付きティッカーを除去してテーマキーワードを抽出する（Pitfall 1 / Assumption A3）。
 * 括弧除去後に空文字になるキーワードは呼び出し側でフィルタされる。
 */
function extractThemeKeyword(sector: string): string {
  return sector.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/**
 * ダイジェスト記事とミーティング結果を決定論的に照合する（XREP-01）。
 * ティッカー一致（highlightedStocks優先、scoredTickersを補助集合として使用）を最優先とし、
 * ティッカー不一致の場合のみタイトルのみを対象にテーマキーワード照合にフォールバックする (D-01〜D-04)。
 * 純関数・副作用なし・throwしない (D-11)。一致0件の記事はマップのキーとして存在しない。
 */
export function buildDigestCrossRefMap(
  curation: NewsCuration,
  meetingResult: MeetingResult,
): DigestCrossRefMap {
  const verdictByTicker = new Map<string, "強気" | "中立" | "弱気">(
    meetingResult.highlightedStocks.map((s) => [
      normalizeHoldingSymbol(s.ticker),
      s.verdict,
    ]),
  );
  const scoredTickerSet = new Set(
    meetingResult.roundSummary.scoredTickers.map(normalizeHoldingSymbol),
  );
  const sectorKeywords = meetingResult.sectorRecommendations
    .map((s) => extractThemeKeyword(s.sector))
    .filter((keyword) => keyword.length > 0);

  const map: Record<string, DigestCrossRef> = {};

  for (const article of curation.articles) {
    const tickerMatches: DigestTickerMatch[] = [];
    for (const ticker of article.tickers) {
      const norm = normalizeHoldingSymbol(ticker);
      if (verdictByTicker.has(norm)) {
        tickerMatches.push({ symbol: norm, verdict: verdictByTicker.get(norm) });
      } else if (scoredTickerSet.has(norm)) {
        tickerMatches.push({ symbol: norm });
      }
    }

    if (tickerMatches.length > 0) {
      map[article.id] = {
        tickerMatches: tickerMatches.slice(0, MAX_TICKER_MATCHES_PER_ARTICLE),
        themeMatches: [],
      };
      continue;
    }

    const matchedKeyword = sectorKeywords.find((keyword) =>
      titleIncludesAny(article.title, [keyword]),
    );
    if (matchedKeyword !== undefined) {
      map[article.id] = {
        tickerMatches: [],
        themeMatches: [{ keyword: matchedKeyword }].slice(
          0,
          MAX_THEME_MATCHES_PER_ARTICLE,
        ),
      };
    }
  }

  return map;
}
