import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { ChatMessage } from "./gemini-types";
import { analyzeUrl, formatUrlContext } from "./url-analyzer";
import { getKnowledgeBase, getEvolutionDirectives, getDeepMemory, getPreviewError } from "./store";
import { CHARACTERS, Character } from "./characters";
import { CreatorMemory } from "./creator-knowledge";

export type { ChatMessage };
export type AiMode = "kalaung" | "arindama" | "twatgyi";

export interface ThinkingStep {
  id: string;
  type: "analyze" | "plan" | "execute" | "search";
  label: string;
  status: "pending" | "active" | "done" | "error";
}

export interface SendMessageOptions {
  apiKey: string;
  openrouterApiKey?: string;
  history: ChatMessage[];
  message: string;
  contextUrl?: string;
  creatorMemories?: CreatorMemory[];
  isCreatorVerified?: boolean;
  deepMemory?: any;
  files?: { 
    name: string; 
    type: string; 
    data: string; 
  }[];
  mode?: AiMode;
  characterId?: string;
  onThinkingUpdate?: (steps: ThinkingStep[]) => void;
  onStream?: (text: string) => void;
}

// Model Routing logic
function routeToBestModel(options: SendMessageOptions): string[] {
  const { message, mode } = options;
  const prompt = message.toLowerCase();
  
  const isCoding = prompt.includes("code") || mode === "arindama";
  
  if (isCoding) {
    return ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"];
  }
  return ["gemini-1.5-flash", "gemini-2.0-flash-exp"];
}

// ---------------------------------------------------------
// ၁။ SUMMARIZE CONVERSATION FUNCTION (ဒီမှာ export ထည့်ထားပါတယ် ✨)
// ---------------------------------------------------------
export async function summarizeConversation(apiKey: string, history: ChatMessage[]): Promise<string> {
  if (history.length === 0) return "ဖျက်ထားတဲ့ Chat ဖြစ်လို့ အကျဉ်းချုပ်စရာ မရှိပါဘူးရှင်။";

  const prompt = `Please provide a concise summary of the following chat conversation in Burmese. 
  Focus on the main topics. Use bullet points.
  
  CONVERSATION:
  ${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}`;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        userApiKey: apiKey
      })
    });

    const data = await response.json();
    return data.text || "အကျဉ်းချုပ်လို့ မရနိုင်သေးပါဘူးရှင်။";
  } catch (error) {
    return "နည်းပညာပိုင်းဆိုင်ရာ အခက်အခဲကြောင့် အကျဉ်းချုပ်လို့ မရသေးပါဘူးရှင်။";
  }
}

// ---------------------------------------------------------
// ၂။ SEND MESSAGE ADVANCED
// ---------------------------------------------------------
export async function sendMessageAdvanced(options: SendMessageOptions): Promise<string> {
  const { apiKey, history, message, mode = "kalaung", onThinkingUpdate } = options;

  let steps: ThinkingStep[] = [
    { id: "analyze", type: "analyze", label: "Analyzing Request...", status: "active" },
    { id: "model", type: "search", label: "Connecting to Gemini...", status: "pending" },
    { id: "execute", type: "execute", label: "Generating Response...", status: "pending" }
  ];
  onThinkingUpdate?.([...steps]);

  const modelsToTry = routeToBestModel(options);

  for (const modelToUse of modelsToTry) {
    try {
      steps[1].status = "active";
      onThinkingUpdate?.([...steps]);

      const contents = history.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }));
      contents.push({ role: "user", parts: [{ text: message }] });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelToUse,
          contents,
          systemInstruction: "You are Khittara AI, a warm sisterly digital assistant.",
          userApiKey: apiKey 
        })
      });

      const data = await response.json();
      if (data.text) {
        steps[2].status = "done";
        onThinkingUpdate?.([...steps]);
        if (options.onStream) options.onStream(data.text);
        return data.text;
      }
    } catch (error) {
      continue;
    }
  }
  throw new Error("Connection failed.");
}

// ---------------------------------------------------------
// ၃။ GENERATE IMAGE
// ---------------------------------------------------------
export async function generateImage(options: { apiKey: string, prompt: string }): Promise<string> {
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(options.prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;
}
