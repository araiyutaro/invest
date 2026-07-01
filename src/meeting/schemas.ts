import { z } from "zod";
import type { MeetingResult, WebSearchResult, ReevaluationOutput, PortfolioAnalysis } from "./types.js";

export const stockPickSchema = z.object({
  ticker: z.string(),
  direction: z.enum(["強気", "中立", "弱気"]),
  rationale: z.string(),
});

export const stockScoreSchema = z.object({
  ticker: z.string(),
  score: z.number().int().min(1).max(10),
  reason: z.string(),
});

export const analystRound1OutputSchema = z.object({
  agentId: z.string(),
  agentRole: z.string(),
  analysis: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()),
  risks: z.array(z.string()),
  picks: z.array(stockPickSchema),
  sectorView: z.string(),
});

export const analystRound2OutputSchema = z.object({
  agentId: z.string(),
  discussion: z.string(),
  comment: z.string(),
  agreements: z.array(z.string()),
  disagreements: z.array(z.string()),
});

export const analystRound3OutputSchema = z.object({
  agentId: z.string(),
  agentRole: z.string(),
  scores: z.array(stockScoreSchema),
});

export const meetingResultSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.string(),
  marketOverview: z.object({
    summary: z.string(),
    trend: z.enum(["上昇", "下降", "混合"]),
    keyIndices: z.array(
      z.object({
        name: z.string(),
        changePercent: z.number(),
      }),
    ),
  }),
  sectorRecommendations: z.array(
    z.object({
      rank: z.number(),
      sector: z.string(),
      rationale: z.string(),
      outlook: z.enum(["強気", "中立", "弱気"]),
    }),
  ),
  highlightedStocks: z.array(
    z.object({
      ticker: z.string(),
      averageScore: z.number().min(1).max(10),
      verdict: z.enum(["強気", "中立", "弱気"]),
      summary: z.string(),
      agentScores: z.array(
        z.object({
          agentRole: z.string(),
          score: z.number().int().min(1).max(10),
          reason: z.string(),
        }),
      ),
      nominatedBy: z.array(z.string()),
    }),
  ),
  riskWarnings: z.array(
    z.object({
      severity: z.enum(["高", "中", "低"]),
      description: z.string(),
    }),
  ),
  actionItems: z.array(z.string()),
  weeklyEvents: z.array(
    z.object({
      date: z.string(),
      event: z.string(),
      impact: z.enum(["高", "中", "低"]),
    }),
  ),
  indexInvestorAdvice: z.string(),
  roundSummary: z.object({
    round1Count: z.number(),
    round2Count: z.number(),
    round3Count: z.number(),
    scoredTickers: z.array(z.string()),
  }),
});

export function validateMeetingResult(data: unknown): MeetingResult {
  return meetingResultSchema.parse(data) as MeetingResult;
}

export const webSearchResultSchema = z.object({
  ticker: z.string(),
  researchSummary: z.string(),
  positiveFindings: z.array(z.string()),
  negativeFindings: z.array(z.string()),
  keyArticles: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
    }),
  ),
  researchedAt: z.string(),
});

export const reevaluationOutputSchema = z.object({
  agentId: z.string(),
  agentRole: z.string(),
  reevaluations: z.array(
    z.object({
      ticker: z.string(),
      originalScore: z.number().int().min(1).max(10),
      revisedScore: z.number().int().min(1).max(10),
      comment: z.string(),
      changed: z.boolean(),
    }),
  ),
});

export function validateWebSearchResult(data: unknown): WebSearchResult {
  return webSearchResultSchema.parse(data) as WebSearchResult;
}

export function validateReevaluationOutput(data: unknown): ReevaluationOutput {
  return reevaluationOutputSchema.parse(data) as ReevaluationOutput;
}

const decisionEnum = z.enum(["保持", "買増", "一部売却", "全売却"]);

const rawHoldingSchema = z.object({
  symbol: z.string(),
  nameJa: z.string().optional(),
  decision: decisionEnum.optional(),
  action: decisionEnum.optional(),
  rationale: z.string().optional(),
  reason: z.string().optional(),
  riskNote: z.string().optional(),
  keyMetric: z.string().optional(),
  riskLevel: z.string().optional(),
}).passthrough();

export const holdingEvaluationSchema = rawHoldingSchema.transform((raw) => {
  const riskParts = [raw.keyMetric, raw.riskLevel].filter((v): v is string => Boolean(v));
  const riskNote = raw.riskNote ?? (riskParts.length > 0 ? riskParts.join(" / ") : undefined);
  return {
    symbol: raw.symbol,
    nameJa: raw.nameJa ?? "",
    decision: raw.decision ?? raw.action ?? "保持",
    rationale: raw.rationale ?? raw.reason ?? "",
    ...(riskNote !== undefined ? { riskNote } : {}),
  };
});

const rawPortfolioSchema = z.object({
  date: z.string(),
  generatedAt: z.string().optional(),
  overallComment: z.string().optional(),
  portfolioSummary: z.string().optional(),
  holdings: z.array(holdingEvaluationSchema),
  rebalanceActions: z.array(z.string()).optional(),
}).passthrough();

export const portfolioAnalysisSchema = rawPortfolioSchema.transform((raw) => ({
  date: raw.date,
  generatedAt: raw.generatedAt ?? "",
  overallComment: raw.overallComment ?? raw.portfolioSummary ?? "",
  holdings: raw.holdings,
  rebalanceActions: raw.rebalanceActions ?? [],
}));

export function validatePortfolioAnalysis(data: unknown): PortfolioAnalysis {
  return portfolioAnalysisSchema.parse(data) as PortfolioAnalysis;
}
