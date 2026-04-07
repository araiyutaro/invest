import { generateText } from "../gemini.js";
import {
  fundamentalsAgent,
  tenbaggerAgent,
  macroAgent,
  technicalAgent,
  riskManagerAgent,
  moderatorAgent,
} from "../agents/index.js";
import type { AgentProfile, AgentAnalysis, MeetingComment } from "../agents/index.js";
import type { MarketNews } from "../data/news.js";
import type { StockData } from "./data.js";

const analysisAgents: ReadonlyArray<AgentProfile> = [
  fundamentalsAgent,
  tenbaggerAgent,
  macroAgent,
  technicalAgent,
  riskManagerAgent,
];

export interface PortfolioReport {
  readonly date: string;
  readonly portfolioSummary: string;
  readonly analyses: ReadonlyArray<AgentAnalysis>;
  readonly discussion: ReadonlyArray<MeetingComment>;
  readonly finalReport: string;
}

interface PortfolioContext {
  readonly portfolioSummary: string;
  readonly marketDataSummary: string;
  readonly news: MarketNews;
  readonly stocks: ReadonlyArray<StockData>;
}

function buildPortfolioContext(ctx: PortfolioContext): string {
  const stockDetails = ctx.stocks
    .map((s) => {
      const sign = s.change >= 0 ? "+" : "";
      const mcap = s.marketCap ? `$${(s.marketCap / 1e9).toFixed(1)}B` : "N/A";
      const pe = s.peRatio ? s.peRatio.toFixed(1) : "N/A";
      const high52 = s.fiftyTwoWeekHigh ? `$${s.fiftyTwoWeekHigh.toFixed(2)}` : "N/A";
      const low52 = s.fiftyTwoWeekLow ? `$${s.fiftyTwoWeekLow.toFixed(2)}` : "N/A";

      return `**${s.nameJa}（${s.symbol}）** - ${s.sector}
  現在価格: $${s.price.toFixed(2)} (${sign}${s.changePercent.toFixed(2)}%)
  PER: ${pe} | 時価総額: ${mcap}
  52週高値: ${high52} | 52週安値: ${low52}`;
    })
    .join("\n\n");

  return `## 保有ポートフォリオ銘柄データ
${stockDetails}

## 本日の市場データ
${ctx.marketDataSummary}

## 米国市場ニュース
${ctx.news.usMarket}

## マクロ経済環境
${ctx.news.macro}

## セクター動向
${ctx.news.sectors}

## 決算・業績
${ctx.news.earnings}`;
}

async function getPortfolioAnalysis(
  agent: AgentProfile,
  context: string,
): Promise<AgentAnalysis> {
  const prompt = `あなたはユーザーが保有する以下のポートフォリオ銘柄を分析するタスクを担当しています。
各銘柄について、あなたの専門的視点から以下を評価してください。

${context}

各銘柄について以下の形式で分析してください：
1. **現状評価**: 現在の株価・バリュエーション・業績に対するあなたの見解
2. **判断**: 「買い増し」「保持」「一部売却」「全売却」のいずれか
3. **短期見通し（1ヶ月）**: 株価の方向性とその根拠
4. **中期見通し（6ヶ月）**: 株価の方向性とその根拠
5. **リスク評価**: 1（低リスク）〜5（高リスク）の5段階

最後にポートフォリオ全体のバランスについてもコメントしてください。`;

  const analysis = await generateText(agent.systemPrompt, prompt);
  return {
    agentId: agent.id,
    agentName: agent.name,
    agentRole: agent.role,
    analysis,
  };
}

async function getPortfolioDiscussion(
  agent: AgentProfile,
  analyses: ReadonlyArray<AgentAnalysis>,
  context: string,
): Promise<MeetingComment> {
  const otherAnalyses = analyses
    .filter((p) => p.agentId !== agent.id)
    .map((p) => `### ${p.agentRole}（${p.agentName}）\n${p.analysis}`)
    .join("\n\n");

  const prompt = `以下は保有ポートフォリオに対する他のチームメンバーの分析です。
あなたの専門的視点から、特に重要な同意点・異議・補足をコメントしてください。

## ポートフォリオデータ
${context}

## 他メンバーの分析
${otherAnalyses}

簡潔に（500文字以内）、最も重要なポイントに絞ってコメントしてください。`;

  const comment = await generateText(agent.systemPrompt, prompt);
  return {
    agentId: agent.id,
    agentName: agent.name,
    comment,
  };
}

async function generatePortfolioFinalReport(
  analyses: ReadonlyArray<AgentAnalysis>,
  discussion: ReadonlyArray<MeetingComment>,
  context: string,
): Promise<string> {
  const analysisContent = analyses
    .map((a) => `### ${a.agentRole}（${a.agentName}）\n${a.analysis}`)
    .join("\n\n");

  const discussionContent = discussion
    .map((d) => `**${d.agentName}**: ${d.comment}`)
    .join("\n\n");

  const prompt = `以下は保有ポートフォリオに対する各専門家の分析とディスカッションです。
これらを統合し、投資家向けの最終ポートフォリオレポートを作成してください。

## ポートフォリオデータ
${context}

## 各エージェントの分析
${analysisContent}

## ディスカッション
${discussionContent}

以下の構成で最終レポートを作成してください。
重要: テーブルは使わないでください。箇条書きリスト形式で記述してください。

### 1. ポートフォリオ総合評価
- ポートフォリオ全体の健全性を3行でまとめる

### 2. 各銘柄の評価サマリー
各銘柄について以下の形式で記述：
- **銘柄名（ティッカー）** [判断: 買い増し/保持/一部売却/全売却]
  - エージェント間のコンセンサス、株価見通し、主要リスクを2-3文で

### 3. リバランス提案
- ポートフォリオ全体のバランスを改善するための具体的な提案

### 4. 注意すべきイベント・カタリスト
- 今後1ヶ月以内に各銘柄に影響を与える可能性のあるイベント

### 5. リスクシナリオ
- ポートフォリオ全体に影響する最悪のシナリオと対策

### 6. アクションアイテム
- 今日、投資家がすべき具体的なアクションを箇条書きで記述`;

  return generateText(moderatorAgent.systemPrompt, prompt);
}

export async function runPortfolioMeeting(
  ctx: PortfolioContext,
): Promise<PortfolioReport> {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const context = buildPortfolioContext(ctx);

  console.log("  Portfolio Round 1: 各エージェントがポートフォリオを分析中...");
  const analyses = await Promise.all(
    analysisAgents.map((agent) => getPortfolioAnalysis(agent, context)),
  );

  console.log("  Portfolio Round 2: ディスカッション中...");
  const discussion = await Promise.all(
    analysisAgents.map((agent) =>
      getPortfolioDiscussion(agent, analyses, context),
    ),
  );

  console.log("  モデレーターがポートフォリオレポートを作成中...");
  const finalReport = await generatePortfolioFinalReport(
    analyses,
    discussion,
    context,
  );

  return {
    date: today,
    portfolioSummary: ctx.portfolioSummary,
    analyses,
    discussion,
    finalReport,
  };
}
