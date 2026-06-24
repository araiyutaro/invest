import { z } from "zod";
import type { MeetingResult } from "./types.js";

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
  summary: z.string(),
  highlights: z.array(z.string()),
  risks: z.array(z.string()),
  picks: z.array(stockPickSchema),
  sectorView: z.string(),
});

export const analystRound2OutputSchema = z.object({
  agentId: z.string(),
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
  date: z.string(),
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
