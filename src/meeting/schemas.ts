import { z } from "zod";
import type {
  MeetingResult,
  WebSearchResult,
  ReevaluationOutput,
  PortfolioAnalysis,
  NewsCuration,
  CuratedArticle,
} from "./types.js";

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

// --- News Curation Contract (Phase 15: CURA-02 / CURA-05) ---
// 第1層: 構造検証（curatedArticleRawSchema / rawNewsCurationSchema / validateRawNewsCuration）。
// コア契約（id/market/importance）は厳格検証、それ以外は passthrough + デフォルト補完（D-09）。
// 配列長のハード制約（.min/.max）は書かない — 件数の妥当性は resolveNewsCuration の
// ソフトクランプに委ねる（D-03〜D-05, Pitfall 1）。

const curatedArticleRawSchema = z
  .object({
    id: z.string().min(1),
    market: z.enum(["us", "japan", "global"]),
    importance: z.enum(["high", "medium", "low"]),
    commentary: z.string().optional().default(""),
    tickers: z.array(z.string()).optional().default([]),
    tickerNames: z.record(z.string(), z.string()).optional().default({}),
  })
  .passthrough();

const rawNewsCurationSchema = z
  .object({
    leadIn: z.string().optional().default(""),
    articles: z.array(curatedArticleRawSchema).optional().default([]),
  })
  .passthrough();

export type RawNewsCuration = z.infer<typeof rawNewsCurationSchema>;

/** 第1層: 構造検証。不正enum値・型不一致はここでthrowする（D-09）。 */
export function validateRawNewsCuration(data: unknown): RawNewsCuration {
  return rawNewsCurationSchema.parse(data);
}

/** プールから解決する記事の最小形状（tmp/news.jsonをJSON.parseした後の実データ形状） */
export interface NewsArticlePoolEntry {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly publishedAt: string; // JSON往復後は必ずstring（Pitfall 3）
  readonly ticker?: string;
}

const MAX_ARTICLES = 15;
const MIN_ARTICLES = 10;

/**
 * 第2層: プール参照によるID解決・重複排除・件数ソフトクランプ（D-03/D-04/D-05/D-08/D-10）。
 * いかなる入力でも throw しない（グレースフルデグラデーション、console.warn を使用）。
 */
export function resolveNewsCuration(
  raw: RawNewsCuration,
  pool: ReadonlyArray<NewsArticlePoolEntry>,
  date: string,
  generatedAt: string,
): NewsCuration {
  const poolById = new Map(pool.map((a) => [a.id, a]));
  const seenIds = new Set<string>();
  const resolved: CuratedArticle[] = [];

  for (const item of raw.articles) {
    if (seenIds.has(item.id)) {
      console.warn(`[news-curation] 重複記事IDをdrop: ${item.id}`);
      continue;
    }
    const source = poolById.get(item.id);
    if (!source) {
      console.warn(`[news-curation] 不明な記事IDをdrop: ${item.id}`);
      continue;
    }
    if (item.commentary.trim() === "") {
      console.warn(`[news-curation] 解説コメント欠落によりdrop: ${item.id}`);
      continue;
    }
    seenIds.add(item.id);
    resolved.push({
      id: item.id,
      title: source.title,
      url: source.url,
      source: source.source,
      publishedAt: source.publishedAt,
      market: item.market,
      importance: item.importance,
      commentary: item.commentary,
      tickers: source.ticker ? [...new Set([source.ticker, ...item.tickers])] : item.tickers,
      tickerNames: item.tickerNames,
    });
  }

  let articles = resolved;
  if (articles.length > MAX_ARTICLES) {
    console.warn(`[news-curation] 選定${articles.length}件 > ${MAX_ARTICLES}件、上位${MAX_ARTICLES}件にtruncate`);
    articles = articles.slice(0, MAX_ARTICLES); // Agent自身の重要度順を尊重（D-03, 再ソートしない）
  } else if (articles.length < MIN_ARTICLES) {
    console.warn(`[news-curation] 選定${articles.length}件 < ${MIN_ARTICLES}件（情報量の少ない日として受理）`);
  }

  return { date, generatedAt, leadIn: raw.leadIn, articles };
}
