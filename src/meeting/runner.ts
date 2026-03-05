import { generateText } from "../gemini.js";
import {
  fundamentalsAgent,
  tenbaggerAgent,
  macroAgent,
  technicalAgent,
  riskManagerAgent,
  moderatorAgent,
} from "../agents/index.js";
import type {
  AgentProfile,
  AgentAnalysis,
  MeetingComment,
  MeetingRound,
  MeetingRecord,
} from "../agents/index.js";
import type { MarketNews } from "../data/news.js";

interface MarketDataContext {
  readonly marketDataSummary: string;
  readonly news: MarketNews;
}

const analysisAgents: ReadonlyArray<AgentProfile> = [
  fundamentalsAgent,
  tenbaggerAgent,
  macroAgent,
  technicalAgent,
  riskManagerAgent,
];

function buildMarketContext(context: MarketDataContext): string {
  return `## 本日の市場データ
${context.marketDataSummary}

## 米国市場ニュース
${context.news.usMarket}

## 日本市場ニュース
${context.news.japanMarket}

## マクロ経済環境
${context.news.macro}

## セクター動向
${context.news.sectors}

## 決算・業績
${context.news.earnings}`;
}

async function getAgentAnalysis(
  agent: AgentProfile,
  marketContext: string,
): Promise<AgentAnalysis> {
  const prompt = `以下の市場データとニュースを分析し、あなたの専門的視点から投資判断に役立つ分析を提供してください。

${marketContext}

あなたの分析を、以下の構成で述べてください：
1. 全体的な市場認識
2. あなたの専門領域からの注目ポイント
3. 具体的な銘柄やセクターの推奨（あれば）
4. 注意すべきリスクや懸念点`;

  const analysis = await generateText(agent.systemPrompt, prompt);
  return {
    agentId: agent.id,
    agentName: agent.name,
    agentRole: agent.role,
    analysis,
  };
}

async function getDiscussionComments(
  agent: AgentProfile,
  presentations: ReadonlyArray<AgentAnalysis>,
  marketContext: string,
): Promise<MeetingComment> {
  const otherAnalyses = presentations
    .filter((p) => p.agentId !== agent.id)
    .map((p) => `### ${p.agentRole}（${p.agentName}）\n${p.analysis}`)
    .join("\n\n");

  const prompt = `以下は他のチームメンバーの分析です。あなたの専門的視点から、同意する点、異議がある点、補足したい点をコメントしてください。特に他のメンバーが見落としている点や、あなたの専門領域から見た別の角度を提供してください。

## 市場データ
${marketContext}

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

async function generateFinalSummary(
  rounds: ReadonlyArray<MeetingRound>,
  marketContext: string,
): Promise<string> {
  const meetingContent = rounds
    .map((round) => {
      const presentations = round.presentations
        .map((p) => `### ${p.agentRole}\n${p.analysis}`)
        .join("\n\n");
      const discussion = round.discussion
        .map((d) => `**${d.agentName}**: ${d.comment}`)
        .join("\n\n");
      return `## ${round.topic}\n\n${presentations}\n\n### ディスカッション\n${discussion}`;
    })
    .join("\n\n---\n\n");

  const prompt = `以下はチームミーティングの全内容です。これを踏まえて、投資家向けの最終レポートを作成してください。

## 市場データ
${marketContext}

## ミーティング内容
${meetingContent}

以下の構成で最終レポートを作成してください。
重要: テーブルは使わないでください。箇条書きリスト形式で記述してください。

### 1. エグゼクティブサマリー
- 今日の市場の全体像を3行でまとめる

### 2. 注目銘柄リスト
以下の形式で各銘柄を箇条書きで記述してください：

重要: NVIDIA、Apple、Microsoft、Google、Amazon、Tesla等の誰でも知っている大型株は避け、中小型株を中心に推奨してください。時価総額が小さく、まだ市場に十分認知されていない銘柄を優先してください。

#### 強気（買い推奨）
- **銘柄名（ティッカー）** [時価総額]: 推奨理由を1-2文で簡潔に

#### 中立（様子見）
- **銘柄名（ティッカー）** [時価総額]: 理由を1-2文で簡潔に

#### 弱気（警戒）
- **銘柄名（ティッカー）** [時価総額]: 警戒理由を1-2文で簡潔に

### 3. セクター推奨ランキング
- 1位から順に箇条書きで、セクター名と理由を記述

### 4. 今週の注目イベント
- 日付とイベント名を箇条書きで記述

### 5. リスク要因
- 各リスクを箇条書きで記述

### 6. アクションアイテム
- 今日、投資家がすべき具体的なアクションを箇条書きで記述`;

  return generateText(moderatorAgent.systemPrompt, prompt);
}

export async function runMeeting(
  context: MarketDataContext,
): Promise<MeetingRecord> {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const marketContext = buildMarketContext(context);

  console.log("Round 1: 各エージェントが分析を発表中...");

  const presentations = await Promise.all(
    analysisAgents.map((agent) => getAgentAnalysis(agent, marketContext)),
  );

  console.log("Round 2: ディスカッション中...");

  const discussion = await Promise.all(
    analysisAgents.map((agent) =>
      getDiscussionComments(agent, presentations, marketContext),
    ),
  );

  const round: MeetingRound = {
    topic: "本日の市場分析と投資戦略",
    presentations,
    discussion,
  };

  console.log("モデレーターが最終レポートを作成中...");

  const finalSummary = await generateFinalSummary([round], marketContext);

  return {
    date: today,
    marketDataSummary: context.marketDataSummary,
    rounds: [round],
    finalSummary,
  };
}
