import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);

// Heavy analysis: agent analysis, final reports, discussion
const MODEL_HEAVY = "gemini-3.1-flash-lite";
// Light tasks: extraction, scoring, news summarization
const MODEL_LIGHT = "gemini-2.5-flash-lite";

export interface ChatMessage {
  readonly role: "user" | "model";
  readonly parts: ReadonlyArray<{ readonly text: string }>;
}

export async function generateText(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL_HEAVY,
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userMessage);
  return result.response.text();
}

export async function generateTextLight(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL_LIGHT,
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userMessage);
  return result.response.text();
}

export async function generateChat(
  systemPrompt: string,
  history: ReadonlyArray<ChatMessage>,
  userMessage: string,
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL_HEAVY,
    systemInstruction: systemPrompt,
  });

  const chat = model.startChat({
    history: history.map((msg) => ({
      role: msg.role,
      parts: msg.parts.map((p) => ({ text: p.text })),
    })),
  });

  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}
