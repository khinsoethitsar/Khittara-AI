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

/**
 * Smart Model Router
 */
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
// ၁။ SUMMARIZE CONVERSATION FUNCTION (အစ်ကို့ပုံထဲက Error ကို ဒီမှာ ပြင်ထားပါတယ် ✨)
// ---------------------------------------------------------
export async function summarizeConversation(apiKey: string, history: ChatMessage[]): Promise<string> {
  if (!history || history.length === 0) return "ဖျက်ထားတဲ့ Chat ဖြစ်လို့ အကျဉ်းချုပ်စရာ မရှိပါဘူးရှင်။";

  const prompt = `Please provide a concise summary of the following chat conversation in Burmese. 
  Focus on the main topics discussed and any decisions made. 
  Keep it friendly and professional. Use bullet points for clarity.
  
  CONVERSATION HISTORY:
  ${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
  
  SUMMARY:`;

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

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const data = await response.json();
    return data.text || "အကျဉ်းချုပ်လို့ မရနိုင်သေးပါဘူးရှင်။";
    
  } catch (error) {
    console.error("Summarization Error:", error);
    return "Conversation ကို အကျဉ်းချုပ်လို့ မရနိုင်သေးပါဘူးရှင်။ ခေတ္တစောင့်ပြီး ပြန်လည်ကြိုးစားပေးပါရှင်။";
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
          systemInstruction: "You are Khittara AI, a warm sisterly digital assistant developed by အစ်ကို MinThitSarAung.",
          userApiKey: apiKey 
        })
      });

      if (!response.ok) throw new Error("API Connection Failed");

      const data = await response.json();
      if (data.text) {
        steps[2].status = "done";
        onThinkingUpdate?.([...steps]);
        if (options.onStream) options.onStream(data.text);
        return data.text;
      }
    } catch (error) {
      console.warn(`Model ${modelToUse} failed, trying next...`);
      continue;
    }
  }

  throw new Error("ညီမလေး ခဏလေး အနားယူပါရစေဦးနော်။ နောက်မှ ပြန်မေးပေးပါရှင်။ 🥰");
}

// ---------------------------------------------------------
// ၃။ GENERATE IMAGE
// ---------------------------------------------------------
export async function generateImage(options: { apiKey: string, prompt: string }): Promise<string> {
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(options.prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;
}
