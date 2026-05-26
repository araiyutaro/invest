export interface AgentProfile {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly systemPrompt: string;
}

export interface AgentAnalysis {
  readonly agentId: string;
  readonly agentName: string;
  readonly agentRole: string;
  readonly analysis: string;
}

export interface MeetingComment {
  readonly agentId: string;
  readonly agentName: string;
  readonly comment: string;
}

export interface MeetingRound {
  readonly topic: string;
  readonly presentations: ReadonlyArray<AgentAnalysis>;
  readonly discussion: ReadonlyArray<MeetingComment>;
}

export interface StockResearchResult {
  readonly ticker: string;
  readonly companyName: string;
  readonly research: string;
}

export interface AgentStockScore {
  readonly ticker: string;
  readonly score: number;
  readonly reason: string;
}

export interface StockScoring {
  readonly agentId: string;
  readonly agentName: string;
  readonly agentRole: string;
  readonly scores: ReadonlyArray<AgentStockScore>;
}

export interface StockScoreSummary {
  readonly ticker: string;
  readonly averageScore: number;
  readonly verdict: "強気" | "中立" | "弱気";
  readonly agentScores: ReadonlyArray<{
    readonly agentRole: string;
    readonly score: number;
    readonly reason: string;
  }>;
}

export interface MeetingRecord {
  readonly date: string;
  readonly marketDataSummary: string;
  readonly rounds: ReadonlyArray<MeetingRound>;
  readonly researchResults: ReadonlyArray<StockResearchResult>;
  readonly postResearchReviews: ReadonlyArray<MeetingComment>;
  readonly scoreSummaries: ReadonlyArray<StockScoreSummary>;
  readonly finalSummary: string;
}
