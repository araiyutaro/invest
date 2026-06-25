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
