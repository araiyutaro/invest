import { generateText } from "../gemini.js";

export interface NewsDigest {
  readonly source: string;
  readonly summary: string;
}

export interface MarketNews {
  readonly usMarket: string;
  readonly japanMarket: string;
  readonly macro: string;
  readonly sectors: string;
  readonly earnings: string;
}

const NEWS_COLLECTION_PROMPT = `You are a financial news analyst. Your task is to provide a comprehensive summary of the latest financial news and market developments.

IMPORTANT: Base your analysis on your most recent training data and general market knowledge. Provide analysis that would be relevant for current market conditions.

Respond in Japanese. Be specific with company names, numbers, and data points where possible.`;

export async function fetchMarketNews(): Promise<MarketNews> {
  const queries = [
    {
      key: "usMarket" as const,
      prompt:
        "米国株式市場の最新動向をまとめてください。主要指数の動き、注目銘柄、市場のセンチメントを含めてください。直近のニュースや決算発表があればそれも含めてください。",
    },
    {
      key: "japanMarket" as const,
      prompt:
        "日本株式市場の最新動向をまとめてください。日経平均・TOPIXの動き、注目銘柄、為替の影響、海外投資家の動向を含めてください。",
    },
    {
      key: "macro" as const,
      prompt:
        "現在のマクロ経済環境をまとめてください。FRBの金融政策、インフレ動向、雇用統計、GDP、日銀の政策、米中関係など主要な経済指標とイベントを含めてください。",
    },
    {
      key: "sectors" as const,
      prompt:
        "現在注目すべきセクターとその理由をまとめてください。AI・半導体、エネルギー、ヘルスケア、金融など各セクターの見通しと、成長が期待されるテーマを具体的に説明してください。",
    },
    {
      key: "earnings" as const,
      prompt:
        "直近の主要企業の決算発表と業績見通しをまとめてください。サプライズがあった企業、ガイダンスの上方/下方修正、市場の反応を含めてください。米国と日本の両方をカバーしてください。",
    },
  ];

  const results = await Promise.all(
    queries.map(async ({ key, prompt }) => {
      try {
        const summary = await generateText(NEWS_COLLECTION_PROMPT, prompt);
        return { key, summary };
      } catch (error) {
        console.error(`Failed to fetch news for ${key}:`, error);
        return { key, summary: "取得に失敗しました" };
      }
    }),
  );

  const newsMap = Object.fromEntries(
    results.map(({ key, summary }) => [key, summary]),
  );
  return newsMap as unknown as MarketNews;
}
