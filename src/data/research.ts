import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);

export interface StockResearch {
  readonly ticker: string;
  readonly companyName: string;
  readonly research: string;
}

export async function researchStock(ticker: string): Promise<StockResearch> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }] as never,
  });

  const prompt = `以下の銘柄について、投資判断に必要な最新情報を調査してください。

銘柄: ${ticker}

以下の観点で調査し、日本語で簡潔にまとめてください：
1. 企業概要（事業内容、時価総額、業界でのポジション）
2. 直近の業績・決算情報（売上、利益、成長率）
3. 最新ニュース・材料（直近1-2週間の重要なニュース）
4. アナリスト評価・目標株価（あれば）
5. リスク要因（競合、規制、財務上の懸念）
6. 株価の最近の動き（直近のトレンド）

事実に基づいた情報のみを記載し、不確かな情報は含めないでください。`;

  const result = await model.generateContent(prompt);
  const research = result.response.text();

  return {
    ticker,
    companyName: ticker,
    research,
  };
}

export async function extractAndResearchStocks(
  analyses: ReadonlyArray<string>,
): Promise<ReadonlyArray<StockResearch>> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
  });

  const combinedAnalyses = analyses.join("\n\n---\n\n");

  const extractionPrompt = `以下のアナリスト分析から、アナリストが具体的な推奨銘柄・注目銘柄・警戒銘柄として個別に取り上げている中小型株のティッカーシンボルを抽出してください。

${combinedAnalyses}

以下のルールに厳密に従ってください：

【抽出対象】
- アナリストが個別の推奨銘柄として具体的に取り上げた中小型株（買い推奨、様子見、警戒のいずれも含む）
- 中小型株（米国: 時価総額$20B以下、日本: 時価総額2兆円以下）

【除外対象（絶対に含めないこと）】
- 市場環境やマクロ分析の文脈で言及されただけの大型株（NVDA, AAPL, MSFT, GOOGL, AMZN, META, TSLA, TSM, 7203.T等）
- セクターやインデックス（S&P500, TOPIX, 日経平均等）
- ETF（SPY, QQQ, VOO等）
- 銘柄名だけ一言触れた程度で、具体的な分析や判断が伴っていないもの

【出力形式】
- ティッカーシンボルのみをカンマ区切りで出力（例: SOUN, 6254.T, MWA）
- 日本株の場合は証券コード+.T の形式（例: 6758.T）
- 最大15銘柄まで
- 該当銘柄が見つからない場合は "NONE" とだけ出力`;

  const result = await model.generateContent(extractionPrompt);
  const tickersText = result.response.text().trim();

  if (tickersText === "NONE" || tickersText.length === 0) {
    return [];
  }

  const tickers = tickersText
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t !== "NONE")
    .slice(0, 15);

  if (tickers.length === 0) {
    return [];
  }

  console.log(`  -> リサーチ対象銘柄: ${tickers.join(", ")}`);

  const results = await Promise.all(tickers.map((ticker) => researchStock(ticker)));

  return results;
}
