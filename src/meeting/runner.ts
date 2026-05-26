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
  StockScoring,
  StockScoreSummary,
  AgentStockScore,
} from "../agents/index.js";
import type { MarketNews } from "../data/news.js";
import { extractAndResearchStocks, type StockResearch } from "../data/research.js";

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

function buildResearchContext(
  researchResults: ReadonlyArray<StockResearch>,
): string {
  if (researchResults.length === 0) {
    return "";
  }

  const researchSection = researchResults
    .map((r) => `### ${r.ticker}\n${r.research}`)
    .join("\n\n");

  return `\n\n## Web調査結果（Google検索による最新情報）
以下は議論で言及された銘柄について、Web検索で取得した最新の事実情報です。この情報を踏まえて判断してください。

${researchSection}`;
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

async function getPostResearchReview(
  agent: AgentProfile,
  researchResults: ReadonlyArray<StockResearch>,
  marketContext: string,
  presentations: ReadonlyArray<AgentAnalysis>,
): Promise<MeetingComment> {
  const researchContext = buildResearchContext(researchResults);

  const ownAnalysis = presentations.find((p) => p.agentId === agent.id);
  const ownAnalysisText = ownAnalysis
    ? `\n\n## あなたの先ほどの分析\n${ownAnalysis.analysis}`
    : "";

  const prompt = `あなたはRound 1で分析を行い、その中でいくつかの銘柄を推奨しました。
その後、推奨銘柄についてWeb検索による詳細調査が行われました。

調査結果を精読し、あなたの専門的視点から以下を回答してください：

1. 調査結果を踏まえても引き続き推奨できる銘柄はどれか？その根拠は？
2. 調査結果を受けて推奨を撤回・格下げすべき銘柄はあるか？理由は？
3. 調査で新たに判明した重要な事実（好材料・リスク）があれば指摘

## 市場データ
${marketContext}
${ownAnalysisText}
${researchContext}

簡潔に（500文字以内）、最も重要なポイントに絞って回答してください。`;

  const comment = await generateText(agent.systemPrompt, prompt);
  return {
    agentId: agent.id,
    agentName: agent.name,
    comment,
  };
}

async function getAgentScoring(
  agent: AgentProfile,
  tickers: ReadonlyArray<string>,
  marketContext: string,
  researchResults: ReadonlyArray<StockResearch>,
  discussion: ReadonlyArray<MeetingComment>,
): Promise<StockScoring> {
  const researchContext = buildResearchContext(researchResults);
  const discussionContext = discussion
    .map((d) => `**${d.agentName}**: ${d.comment}`)
    .join("\n\n");

  const tickerList = tickers.join(", ");

  const prompt = `あなたはこれまでの市場分析、Web調査結果、およびチームディスカッションを踏まえて、以下の銘柄それぞれに対して10段階で投資評価を行ってください。

## 評価対象銘柄
${tickerList}

## 市場データ
${marketContext}
${researchContext}

## チームディスカッション
${discussionContext}

## 評価基準（10段階）
- 10: 極めて強い買い（確信度最高）
- 8-9: 強い買い
- 6-7: やや強気
- 5: 中���
- 3-4: やや弱気
- 1-2: 強い売り/警戒

## 出力形式（厳守）
各銘柄について以下の形式で1行ずつ出力してください。余計な説明は不要です。
TICKER|スコア(1-10の整数)|理由(30文字以内)

例:
AAPL|6|好決算だがバリュエーション高め
7203.T|8|EV戦略転換と円安で業績上振れ期待`;

  const result = await generateText(agent.systemPrompt, prompt);

  const scores: AgentStockScore[] = result
    .split("\n")
    .filter((line) => line.includes("|"))
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      const ticker = parts[0] ?? "";
      const score = Math.min(10, Math.max(1, parseInt(parts[1] ?? "5", 10)));
      const reason = parts[2] ?? "";
      return { ticker, score: isNaN(score) ? 5 : score, reason };
    })
    .filter((s) => tickers.some((t) => s.ticker.includes(t) || t.includes(s.ticker)));

  return {
    agentId: agent.id,
    agentName: agent.name,
    agentRole: agent.role,
    scores,
  };
}

function computeScoreSummaries(
  scorings: ReadonlyArray<StockScoring>,
  tickers: ReadonlyArray<string>,
): ReadonlyArray<StockScoreSummary> {
  return tickers.map((ticker) => {
    const agentScores: StockScoreSummary["agentScores"][number][] = [];

    for (const scoring of scorings) {
      const found = scoring.scores.find(
        (s) => s.ticker === ticker || s.ticker.includes(ticker) || ticker.includes(s.ticker),
      );
      if (found) {
        agentScores.push({
          agentRole: scoring.agentRole,
          score: found.score,
          reason: found.reason,
        });
      }
    }

    const totalScore = agentScores.reduce((sum, s) => sum + s.score, 0);
    const averageScore = agentScores.length > 0 ? totalScore / agentScores.length : 5;

    const verdict: StockScoreSummary["verdict"] =
      averageScore >= 7 ? "\u5F37\u6C17" : averageScore >= 4 ? "\u4E2D\u7ACB" : "\u5F31\u6C17";

    return {
      ticker,
      averageScore: Math.round(averageScore * 10) / 10,
      verdict,
      agentScores,
    };
  }).sort((a, b) => b.averageScore - a.averageScore);
}

async function generateFinalSummary(
  rounds: ReadonlyArray<MeetingRound>,
  marketContext: string,
  researchResults: ReadonlyArray<StockResearch>,
  scoreSummaries: ReadonlyArray<StockScoreSummary>,
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

  const researchContext = buildResearchContext(researchResults);

  const scoringContext = scoreSummaries.length > 0
    ? `\n\n## エージェント合議スコアリング結果（Web調査後・10段階評価）
以下は各エージェントがWeb調査結果を踏まえて独立に評価した結果です。この結果を注目銘柄リストの分類に必ず反映してください。

${scoreSummaries.map((s) => {
  const agentDetails = s.agentScores
    .map((a) => `  - ${a.agentRole}: ${a.score}/10（${a.reason}）`)
    .join("\n");
  return `### ${s.ticker}【平均 ${s.averageScore}/10 → ${s.verdict}】\n${agentDetails}`;
}).join("\n\n")}`
    : "";

  const prompt = `以下はチームミーティングの全内容です。これを踏まえて、投資家向けの最終レポートを作成してください。

重要:
- Web調査結果とエージェント合議スコアリングが提供されています。
- 注目銘柄リストの強気/中立/弱気の分類は、必ずスコアリング結果に基づいてください（平均7以上=強気、4-6.9=中立、4未満=弱気）。
- 各銘柄の推奨理由には、Web調査で確認された事実を含めてください。

## 市場データ
${marketContext}
${researchContext}
${scoringContext}

## ミーティング内容
${meetingContent}

以下の構成で最終レポートを作成してください。
重要: テーブルは使わないでください。箇条書きリスト形式で記述してください。

### 1. エグゼクティブサマリー
- 今日の市場の全体像を3行でまとめる

### 2. 注目銘柄リスト
以下の形式で各銘柄を箇条書きで記述してください：

重要: NVIDIA、Apple、Microsoft、Google、Amazon、Tesla等の誰でも知っている大型株は避け、中小型株を中心に推奨してください。時価総額が小さく、まだ市場に十分認知されていない銘柄を優先してください。
重要: 各銘柄にはエージェント合議スコア（平均点）を明記してください。

#### 強気（買い推奨）- 平均スコア7.0以上
- **銘柄名（ティッカー）** [平均スコア X.X/10]: Web調査を踏まえた推奨理由を1-2文で簡潔に

#### 中立（様子見）- 平均スコア4.0〜6.9
- **銘柄名（ティッカー）** [平均スコア X.X/10]: 理由を1-2文で簡潔に

#### 弱気（警戒）- 平均スコア4.0未満
- **銘柄名（ティッカー）** [平均スコア X.X/10]: 警戒理由を1-2文で簡潔に

### 3. セクター推奨ランキング
- 1位から順に箇条書きで、セクター名と理由を記述

### 4. 今週の注目イベント
- 日付とイベント名を箇条書きで記述

### 5. リスク要因
- 各リスクを箇条書きで記述

### 6. アクションアイテム
- 今日、投資家がすべき具体的なアクションを箇条書きで記述

### 7. 米国株インデックス戦略
このレポートの読者はポートフォリオの約8割を米国株インデックスファンド（S&P500、全米株式等）で運用しています。
以下の観点でインデックス投資家向けのアドバイスを箇条書きで記述してください：
- **現在の市場環境の評価**: インデックスを保持すべきか、一部現金化を検討すべきか（明確な根拠とともに）
- **今後1〜3ヶ月の見通し**: マクロ環境・金利動向・地政学リスク等を踏まえた方向感
- **積立投資への影響**: 定期積立のタイミング調整が必要かどうか
- **注意すべきイベント**: インデックス全体に影響しうる大型イベント（IPO、FOMC、雇用統計、決算シーズン等）
- **リスクシナリオ**: インデックスが大幅下落する場合のシナリオと、その場合の対応策`;

  return generateText(moderatorAgent.systemPrompt, prompt);
}

export async function runMeeting(
  context: MarketDataContext,
): Promise<MeetingRecord> {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const marketContext = buildMarketContext(context);

  // Round 1: 各エージェントが市場データ+ニュースを基に分析・銘柄推奨
  console.log("Round 1: 各エージェントが分析を発表中...");

  const presentations = await Promise.all(
    analysisAgents.map((agent) => getAgentAnalysis(agent, marketContext)),
  );

  // Round 2: エージェント間のディスカッション（まだWeb調査前）
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

  // Research Round: ディスカッションで推奨された中小型株をWeb調査
  console.log("Research Round: 推奨中小型株のWeb調査中...");

  const allAnalysisTexts = [
    ...presentations.map((p) => p.analysis),
    ...discussion.map((d) => d.comment),
  ];
  const researchResults = await extractAndResearchStocks(allAnalysisTexts);

  console.log(`  -> ${researchResults.length}件の銘柄調査完了`);

  // Post-Research Review: 調査結果を受けて各エージェントが再評価
  let postResearchReviews: ReadonlyArray<MeetingComment> = [];
  const tickers = researchResults.map((r) => r.ticker);

  if (researchResults.length > 0) {
    console.log("Review Round: Web調査結果を踏まえた再評価中...");

    postResearchReviews = await Promise.all(
      analysisAgents.map((agent) =>
        getPostResearchReview(agent, researchResults, marketContext, presentations),
      ),
    );
  }

  // Scoring Round: Web調査+再評価を踏まえて10段階スコアリング
  if (tickers.length > 0) {
    console.log("Scoring Round: 各エージェントが銘柄を10段階評価中...");
  }

  const scorings = tickers.length > 0
    ? await Promise.all(
        analysisAgents.map((agent) =>
          getAgentScoring(agent, tickers, marketContext, researchResults, [
            ...discussion,
            ...postResearchReviews,
          ]),
        ),
      )
    : [];

  const scoreSummaries = computeScoreSummaries(scorings, tickers);

  if (tickers.length > 0) {
    console.log(`  -> ${scoreSummaries.length}銘柄のスコアリング完了`);
  }

  // Final: モデレーターが全情報を踏まえて最終レポート作成
  console.log("モデレーターが最終レポートを作成中...");

  const finalSummary = await generateFinalSummary(
    [round],
    marketContext,
    researchResults,
    scoreSummaries,
  );

  return {
    date: today,
    marketDataSummary: context.marketDataSummary,
    rounds: [round],
    researchResults,
    postResearchReviews,
    scoreSummaries,
    finalSummary,
  };
}
