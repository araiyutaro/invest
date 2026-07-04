import type { CuratedArticle, NewsCuration, MeetingResult } from "./types.js";

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

/**
 * ダイジェスト記事とミーティング結果を決定論的に照合する（XREP-01）。
 * TODO(Task 2): 実装は GREEN フェーズで追加する。現時点ではRED確認用のスタブ。
 */
export function buildDigestCrossRefMap(
  curation: NewsCuration,
  meetingResult: MeetingResult,
): DigestCrossRefMap {
  void curation;
  void meetingResult;
  return {};
}
