import { generateText } from "../../gemini.js";
import type { RawNewsArticle, MarketNews } from "./types.js";
import type { FinnhubNews } from "./finnhub.js";

const SYSTEM_PROMPT = `あなたは金融ニュースアナリストです。提供された実際のニュース記事に基づいて、投資家向けの分析レポートを作成してください。

重要なルール:
- 提供されたニュース記事の内容に基づいて分析してください
- 記事に書かれていない情報を捏造しないでください
- 具体的な企業名、数値、データポイントを含めてください
- 日本語で回答してください`;

function formatArticlesForPrompt(
  articles: ReadonlyArray<RawNewsArticle>,
): string {
  if (articles.length === 0) {
    return "（実際のニュース記事は取得できませんでした。あなたの最新の知識に基づいて分析してください。）";
  }

  return articles
    .map(
      (article, i) =>
        `[${i + 1}] ${article.title}\n出典: ${article.source}\n${article.summary}`,
    )
    .join("\n\n");
}

interface AnalysisConfig {
  readonly key: keyof MarketNews;
  readonly prompt: string;
  readonly articles: ReadonlyArray<RawNewsArticle>;
}

function buildAnalysisConfigs(
  finnhubNews: FinnhubNews,
  japanNews: ReadonlyArray<RawNewsArticle>,
): ReadonlyArray<AnalysisConfig> {
  const allFinnhub = [...finnhubNews.general, ...finnhubNews.merger];

  return [
    {
      key: "usMarket",
      prompt: `以下の実際のニュース記事に基づいて、米国株式市場の最新動向をまとめてください。主要指数の動き、注目銘柄、市場のセンチメントを含めてください。`,
      articles: finnhubNews.general.slice(0, 15),
    },
    {
      key: "japanMarket",
      prompt: `以下の実際のニュース記事に基づいて、日本株式市場の最新動向をまとめてください。日経平均・TOPIXの動き、注目銘柄、為替の影響、海外投資家の動向を含めてください。`,
      articles: japanNews,
    },
    {
      key: "macro",
      prompt: `以下の実際のニュース記事に基づいて、現在のマクロ経済環境をまとめてください。FRBの金融政策、インフレ動向、雇用統計、GDP、日銀の政策など主要な経済指標とイベントを含めてください。`,
      articles: allFinnhub.slice(0, 15),
    },
    {
      key: "sectors",
      prompt: `以下の実際のニュース記事に基づいて、現在注目すべきセクターとその理由をまとめてください。AI・半導体、エネルギー、ヘルスケア、金融など各セクターの見通しと、成長が期待されるテーマを具体的に説明してください。`,
      articles: allFinnhub.slice(0, 15),
    },
    {
      key: "earnings",
      prompt: `以下の実際のニュース記事に基づいて、直近の主要企業の決算発表と業績見通しをまとめてください。サプライズがあった企業、ガイダンスの上方/下方修正、市場の反応を含めてください。米国と日本の両方をカバーしてください。`,
      articles: [
        ...finnhubNews.merger.slice(0, 10),
        ...japanNews.filter(
          (a) =>
            a.title.includes("決算") ||
            a.title.includes("業績") ||
            a.title.includes("増益") ||
            a.title.includes("減益"),
        ),
      ],
    },
  ];
}

export async function generateAllAnalyses(
  finnhubNews: FinnhubNews,
  japanNews: ReadonlyArray<RawNewsArticle>,
): Promise<MarketNews> {
  const configs = buildAnalysisConfigs(finnhubNews, japanNews);

  const results = await Promise.all(
    configs.map(async ({ key, prompt, articles }) => {
      try {
        const articleText = formatArticlesForPrompt(articles);
        const fullPrompt = `${prompt}\n\n--- 以下がニュース記事です ---\n\n${articleText}`;
        const analysis = await generateText(SYSTEM_PROMPT, fullPrompt);
        return { key, analysis };
      } catch (error) {
        console.error(`Failed to analyze ${key}:`, error);
        return { key, analysis: "分析の生成に失敗しました" };
      }
    }),
  );

  const newsMap = Object.fromEntries(
    results.map(({ key, analysis }) => [key, analysis]),
  );
  return newsMap as unknown as MarketNews;
}
