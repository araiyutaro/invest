export interface StockPick {
  readonly ticker: string;
  readonly direction: "強気" | "中立" | "弱気";
  readonly rationale: string;
}

export interface StockScore {
  readonly ticker: string;
  readonly score: number;
  readonly reason: string;
}

export interface AnalystRound1Output {
  readonly agentId: string;
  readonly agentRole: string;
  readonly analysis: string;       // 4セクション構成の詳細散文（各セクション200〜400文字）
  readonly summary: string;
  readonly highlights: ReadonlyArray<string>;
  readonly risks: ReadonlyArray<string>;
  readonly picks: ReadonlyArray<StockPick>;
  readonly sectorView: string;
}

export interface AnalystRound2Output {
  readonly agentId: string;
  readonly discussion: string;     // 他アナリストへの明示的相互参照を含む散文（800〜1500文字）
  readonly comment: string;
  readonly agreements: ReadonlyArray<string>;
  readonly disagreements: ReadonlyArray<string>;
}

export interface AnalystRound3Output {
  readonly agentId: string;
  readonly agentRole: string;
  readonly scores: ReadonlyArray<StockScore>;
}

export interface MeetingResult {
  readonly date: string;
  readonly generatedAt: string;
  readonly marketOverview: {
    readonly summary: string;
    readonly trend: "上昇" | "下降" | "混合";
    readonly keyIndices: ReadonlyArray<{
      readonly name: string;
      readonly changePercent: number;
    }>;
  };
  readonly sectorRecommendations: ReadonlyArray<{
    readonly rank: number;
    readonly sector: string;
    readonly rationale: string;
    readonly outlook: "強気" | "中立" | "弱気";
  }>;
  readonly highlightedStocks: ReadonlyArray<{
    readonly ticker: string;
    readonly averageScore: number;
    readonly verdict: "強気" | "中立" | "弱気";
    readonly summary: string;
    readonly agentScores: ReadonlyArray<{
      readonly agentRole: string;
      readonly score: number;
      readonly reason: string;
    }>;
    readonly nominatedBy: ReadonlyArray<string>;
  }>;
  readonly riskWarnings: ReadonlyArray<{
    readonly severity: "高" | "中" | "低";
    readonly description: string;
  }>;
  readonly actionItems: ReadonlyArray<string>;
  readonly weeklyEvents: ReadonlyArray<{
    readonly date: string;
    readonly event: string;
    readonly impact: "高" | "中" | "低";
  }>;
  readonly indexInvestorAdvice: string;
  readonly roundSummary: {
    readonly round1Count: number;
    readonly round2Count: number;
    readonly round3Count: number;
    readonly scoredTickers: ReadonlyArray<string>;
  };
}

export interface WebSearchResult {
  readonly ticker: string;
  readonly researchSummary: string;
  readonly positiveFindings: ReadonlyArray<string>;
  readonly negativeFindings: ReadonlyArray<string>;
  readonly keyArticles: ReadonlyArray<{
    readonly title: string;
    readonly summary: string;
  }>;
  readonly researchedAt: string;
}

export interface ReevaluationOutput {
  readonly agentId: string;
  readonly agentRole: string;
  readonly reevaluations: ReadonlyArray<{
    readonly ticker: string;
    readonly originalScore: number;
    readonly revisedScore: number;
    readonly comment: string;
    readonly changed: boolean;
  }>;
}

export interface HoldingEvaluation {
  readonly symbol: string;
  readonly nameJa: string;
  readonly decision: "保持" | "買増" | "一部売却" | "全売却";
  readonly rationale: string;
  readonly riskNote?: string;
  /**
   * LLM出力（alias-transform正規化済み: urgent/urgency/isUrgent/urgentFlagの表記揺れを吸収）。
   * 省略時は false（D-08/D-10）。決算ミス・訴訟・規制変更・大型契約・ガイダンス引下げ等の
   * 重大材料を確認した場合のみ true とする運用。
   */
  readonly urgent: boolean;
  /**
   * TS側で付与（前日スナップショットとの決定論的比較、D-11）。
   * LLMの生出力には決して存在しない（schemas.ts の transform で strip される）。
   */
  readonly previousDecision?: "保持" | "買増" | "一部売却" | "全売却";
  /**
   * TS側で付与（D-11）。undefined = 前日データ欠損等で比較不能、false = 比較した結果変化なし。
   * 「比較できなかった」と「変化がなかった」を区別する（D-14）。
   */
  readonly decisionChanged?: boolean;
}

export interface WatchlistJudgment {
  readonly ticker: string;
  readonly todayAction: "buy" | "wait";
  readonly rationale: string;
  readonly signals: readonly string[];
  /**
   * TS側で付与（D-08）。テクニカルスナップショットの as-of 時刻を透過するのみで、
   * LLMの生出力には決して存在しない（schemas.ts の transform で strip される）。
   */
  readonly asOf?: string;
  /**
   * TS側で決定論的に導出（D-13、deriveMarket: `.T` サフィックス判定）。
   * LLMの生出力には決して存在しない（schemas.ts の transform で strip される）。
   */
  readonly market?: "US" | "JP";
  /**
   * TS側で付与（前日スナップショットとの決定論的比較、D-11、D-15）。
   * LLMの生出力には決して存在しない（schemas.ts の transform で strip される）。
   */
  readonly previousAction?: "buy" | "wait";
  /**
   * TS側で付与（D-11）。undefined = 前日データ欠損等で比較不能、false = 比較した結果変化なし。
   * 「比較できなかった」と「変化がなかった」を区別する（D-14 と同じ規律）。
   */
  readonly actionChanged?: boolean;
  /**
   * TS側で付与（D-20）。テクニカルスナップショット欠落銘柄の陽性 skip レコードにのみ設定する。
   * 省略時（undefined）は通常判定済みを意味する。
   */
  readonly status?: "skipped";
}

export interface WatchlistJudgmentFile {
  readonly date: string;
  readonly generatedAt: string;
  readonly judgments: readonly WatchlistJudgment[];
}

export interface PortfolioAnalysis {
  readonly date: string;
  readonly generatedAt: string;
  readonly overallComment: string;
  readonly holdings: ReadonlyArray<HoldingEvaluation>;
  readonly rebalanceActions: ReadonlyArray<string>;
}

export interface CuratedArticle {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly publishedAt: string; // ISO 8601, tmp/news.jsonのプールから解決済み（Date型ではない — Pitfall 3）
  readonly market: "us" | "japan" | "global";
  readonly importance: "high" | "medium" | "low";
  readonly commentary: string;
  readonly tickers: ReadonlyArray<string>;
  readonly tickerNames?: Readonly<Record<string, string>>; // symbol -> 会社名の任意マップ（D-04, 加法的）
}

export interface NewsCuration {
  readonly date: string;
  readonly generatedAt: string;
  readonly leadIn: string; // CURA-09: 「今日の市場を動かすもの」リード文
  readonly articles: ReadonlyArray<CuratedArticle>;
}
