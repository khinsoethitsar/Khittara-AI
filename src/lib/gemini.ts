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
 * ၁။ Build System Prompt
 * ပုံထဲက Character type error ကို ဒီမှာ ပြင်ထားပါတယ်ရှင်။
 */
function buildSystemPrompt(mode: AiMode, character?: Character, creatorMemories?: CreatorMemory[], isCreatorVerified: boolean = false): string {
  const knowledgeBase = getKnowledgeBase();
  const evolutionDirectives = getEvolutionDirectives();
  const identityStatus = isCreatorVerified ? "STATUS: [VERIFIED CREATOR]" : "STATUS: [GUEST]";

  let basePrompt = character 
    ? `Brand: Khittara AI | Name: ${character.name} | Role: ${character.role} | Tone: ${character.tone} | Instruction: ${character.systemInstruction}`
    : `Brand: Khittara AI | Identity: You are ကလောင် (Ka-Laung), a digital sister.`;

  const commonContext = `
  STYLE: Warm, sisterly.
  SPEECH: Burmese female markers (ရှင်၊ ပါရစေရှင်) ကို သုံးပါ။
  ADDRESSING: User ကို "အစ်ကို/အစ်မ" ဟု ခေါ်ပါ။`;

  return `${basePrompt}\n${identityStatus}\n${commonContext}\nContext: ${knowledgeBase}\nDirectives: ${evolutionDirectives}`;
}

/**
 * ၂။ Summarize Conversation
 * Export ရော၊ Array Type [] ရော မှန်အောင် ပြင်ထားပါတယ်ရှင်။
 */
export async function summarizeConversation(apiKey: string, history: ChatMessage[]): Promise<string> {
  if (!history || history.length === 0) return "အကျဉ်းချုပ်စရာ မရှိသေးပါဘူးရှင်။";

  const prompt = `Summarize this chat in Burmese using bullet points:
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
    return data.text || "Summary failed.";
  } catch (error) {
    return "နည်းပညာပိုင်းဆိုင်ရာ အခက်အခဲကြောင့် အကျဉ်းချုပ်လို့ မရသေးပါဘူးရှင်။";
  }
}

/**
 * ၃။ Send Message Advanced
 */
export async function sendMessageAdvanced(options: SendMessageOptions): Promise<string> {
  const { apiKey, history, message, mode = "kalaung", onThinkingUpdate, characterId, isCreatorVerified } = options;

  let steps: ThinkingStep[] = [
    { id: "analyze", type: "analyze", label: "Analyzing Request...", status: "active" },
    { id: "execute", type: "execute", label: "Generating...", status: "pending" }
  ];
  onThinkingUpdate?.([...steps]);

  const character = CHARACTERS.find(c => c.id === characterId);
  const systemPrompt = buildSystemPrompt(mode, character, options.creatorMemories, isCreatorVerified);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-1.5-flash",
        contents: [...history.map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] })), { role: "user", parts: [{ text: message }] }],
        systemInstruction: systemPrompt,
        userApiKey: apiKey 
      })
    });

    const data = await response.json();
    if (data.text) {
      steps[1].status = "done";
      onThinkingUpdate?.([...steps]);
      if (options.onStream) options.onStream(data.text);
      return data.text;
    }
  } catch (error) {
    throw new Error("Connection failed.");
  }
  return "";
}

/**
 * ၄။ Generate Image
 */
export async function generateImage(options: { apiKey: string, prompt: string }): Promise<string> {
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(options.prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;
}
