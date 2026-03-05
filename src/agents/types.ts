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

export interface MeetingRecord {
  readonly date: string;
  readonly marketDataSummary: string;
  readonly rounds: ReadonlyArray<MeetingRound>;
  readonly finalSummary: string;
}
