import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(apiKey);

export interface ChatMessage {
  readonly role: "user" | "model";
  readonly parts: ReadonlyArray<{ readonly text: string }>;
}

export async function generateText(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-pro-preview",
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
    model: "gemini-3.1-pro-preview",
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
