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

// keyArticles要素のフェイルソフト化（D-12）: 1記事のフィールド欠落・型不正・非オブジェクト要素が
// 銘柄ファイル全体のparse失敗（＝当該銘柄のリサーチ結果の丸ごとFAIL）に波及しないよう、
// 要素単位で補完・除外する。出力形状は {title, summary}[] のまま不変（D-09）。
// - title / summary が欠落または非文字列 → "" に補完
// - オブジェクトでない要素（文字列・null・配列等） → 除外
const toKeyArticle = (item: unknown): { title: string; summary: string } | null => {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    return null;
  }
  const record = item as Record<string, unknown>;
  return {
    title: typeof record.title === "string" ? record.title : "",
    summary: typeof record.summary === "string" ? record.summary : "",
  };
};

const lenientKeyArticlesSchema = z
  .array(z.unknown())
  .optional()
  .transform((items) =>
    items
      ?.map(toKeyArticle)
      .filter((article): article is { title: string; summary: string } => article !== null),
  );

// rawWebSearchResultSchema: エージェント生成JSONの信頼境界（D-12）。ticker以外は全て
// optionalとし、正準フィールドと発明されがちなエイリアスを併記してpassthroughする。
// tmp/websearch/{ticker}.json（既存候補銘柄）と tmp/portfolio-research/{symbol}.json
// （本フェーズ）の両方が同一WebSearchResult形状を経由する共有バックポート。
const rawWebSearchResultSchema = z
  .object({
    ticker: z.string(),
    researchSummary: z.string().optional(),
    summary: z.string().optional(), // alias for researchSummary
    positiveFindings: z.array(z.string()).optional(),
    findings: z.array(z.string()).optional(), // alias for positiveFindings
    positives: z.array(z.string()).optional(), // alias for positiveFindings
    negativeFindings: z.array(z.string()).optional(),
    negatives: z.array(z.string()).optional(), // alias for negativeFindings
    concerns: z.array(z.string()).optional(), // alias for negativeFindings
    keyArticles: lenientKeyArticlesSchema,
    articles: lenientKeyArticlesSchema, // alias for keyArticles
    researchedAt: z.string().optional(),
    timestamp: z.string().optional(), // alias for researchedAt
    date: z.string().optional(), // alias for researchedAt
  })
  .passthrough();

export const webSearchResultSchema = rawWebSearchResultSchema.transform((raw) => ({
  ticker: raw.ticker,
  researchSummary: raw.researchSummary ?? raw.summary ?? "",
  positiveFindings: raw.positiveFindings ?? raw.positives ?? raw.findings ?? [],
  negativeFindings: raw.negativeFindings ?? raw.negatives ?? raw.concerns ?? [],
  keyArticles: raw.keyArticles ?? raw.articles ?? [],
  researchedAt: raw.researchedAt ?? raw.timestamp ?? raw.date ?? "",
}));

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

// urgent系boolean（LLM出力）の寛容パーサ（WR-01）: 文字列 "true"/"false" の型ドリフトを
// boolean に矯正する。それ以外の型の不正は rawHoldingSchema の parse 失敗として
// lenientHoldingsSchema の要素単位 drop に委ねる。
const lenientBoolean = z
  .union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")])
  .optional();

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
  urgent: lenientBoolean,
  urgency: lenientBoolean, // alias for urgent
  isUrgent: lenientBoolean, // alias for urgent
  urgentFlag: lenientBoolean, // alias for urgent
}).passthrough();

export const holdingEvaluationSchema = rawHoldingSchema.transform((raw) => {
  const riskParts = [raw.keyMetric, raw.riskLevel].filter((v): v is string => Boolean(v));
  const riskNote = raw.riskNote ?? (riskParts.length > 0 ? riskParts.join(" / ") : undefined);
  return {
    symbol: raw.symbol,
    nameJa: raw.nameJa ?? "",
    decision: raw.decision ?? raw.action ?? "保持",
    rationale: raw.rationale ?? raw.reason ?? "",
    urgent: raw.urgent ?? raw.urgency ?? raw.isUrgent ?? raw.urgentFlag ?? false,
    ...(riskNote !== undefined ? { riskNote } : {}),
  };
});

type HoldingEvaluationParsed = z.infer<typeof holdingEvaluationSchema>;

// holdings要素のフェイルソフト化（WR-01。keyArticlesのD-12前例と同型）: 1銘柄の型不正
// （enum外decision・非オブジェクト要素等）が portfolioAnalysisSchema.parse 全体のthrow
// （＝ポートフォリオレポート全体のフォールバック落ち）に波及しないよう、要素単位で
// safeParse し、不正要素のみ console.warn 付きで drop する。
// strip保証（明示的オブジェクトリテラル、...rawなし）と urgent の alias-transform 意味論は
// holdingEvaluationSchema 側のまま不変。
const lenientHoldingsSchema = z.array(z.unknown()).transform((items) =>
  items
    .map((item, index) => {
      const parsed = holdingEvaluationSchema.safeParse(item);
      if (parsed.success) {
        return parsed.data;
      }
      const symbol =
        typeof item === "object" && item !== null && !Array.isArray(item)
          ? (item as Record<string, unknown>).symbol
          : undefined;
      const label = typeof symbol === "string" && symbol !== "" ? symbol : `index ${index}`;
      console.warn(
        `[portfolio-analysis] 不正なholdingをdrop (${label}):`,
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      );
      return null;
    })
    .filter((h): h is HoldingEvaluationParsed => h !== null),
);

const rawPortfolioSchema = z.object({
  date: z.string(),
  generatedAt: z.string().optional(),
  overallComment: z.string().optional(),
  portfolioSummary: z.string().optional(),
  holdings: lenientHoldingsSchema,
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
      // finnhub由来のmerger/business記事はtickerが数値インデックスのため、文字列のみマージする
      tickers:
        typeof source.ticker === "string" && source.ticker !== ""
          ? [...new Set([source.ticker, ...item.tickers])]
          : item.tickers,
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
