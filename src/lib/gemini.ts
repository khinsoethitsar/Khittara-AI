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
  fileData?: string | string[]; 
  files?: { 
    name: string; 
    type: string; 
    data: string; 
    trimStart?: string; 
    trimEnd?: string 
  }[];
  mode?: AiMode;
  characterId?: string;
  onThinkingUpdate?: (steps: ThinkingStep[]) => void;
  onStream?: (text: string) => void;
}

/**
 * Smart Model Router
 * အစ်ကို့ရဲ့ Firebase Site မှာ 404 မတက်အောင် model name တွေကို သန့်စင်ပေးထားပါတယ်ရှင်။
 */
function routeToBestModel(options: SendMessageOptions): string[] {
  const { message, files, mode } = options;
  const prompt = message.toLowerCase();
  const hasFiles = files && files.length > 0;
  
  const isCoding = prompt.includes("code") || prompt.includes("react") || prompt.includes("fix") || prompt.includes("error") || prompt.includes("debug") || mode === "arindama";
  const isReasoning = prompt.includes("think") || prompt.includes("reason") || prompt.includes("analyze") || prompt.includes("calculate");

  // Firebase မှာ 'models/' prefix ကြောင့် 404 တက်တတ်လို့ နာမည်သက်သက်ပဲ သုံးထားပါတယ်
  if (isCoding || isReasoning || hasFiles) {
    return [
      "gemini-2.0-flash-exp",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-2.0-flash-lite-preview"
    ];
  }

  return [
    "gemini-1.5-flash",
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro"
  ];
}

export const PREFERRED_MODELS = [
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash-lite-preview"
];

function buildSystemPrompt(mode: AiMode, character?: Character, creatorMemories?: CreatorMemory[], isCreatorVerified: boolean = false, deepMemory?: any): string {
  // Knowledge Base တွေနဲ့ Evolution Directives တွေကို store ထဲက ဆွဲထုတ်ယူပါတယ်
  const knowledgeBase = getKnowledgeBase();
  const evolutionDirectives = getEvolutionDirectives();
  const identityStatus = isCreatorVerified ? "STATUS: [VERIFIED CREATOR - အစ်ကို MinThitSarAung]" : "STATUS: [GUEST SESSION]";

  let basePrompt = character 
    ? `Brand: Khittara AI | Name: ${character.name} | Role: ${character.role} | Tone: ${character.tone} | Instruction: ${character.systemInstruction}`
    : `Brand: Khittara AI | Identity: You are ကလောင် (Ka-Laung), a digital sister. Stack: React, Firebase, Tailwind.`;

  const commonContext = `
  STYLE: Warm, sisterly, witty.
  SPEECH: အမြဲတမ်း Burmese female markers (ရှင်၊ နော်၊ ပါရစေရှင်) ကို သုံးပေးပါ။
  EMOJIS: ✨, 💖, 🥰, 🌸, ✊ ကို သဘာဝကျကျ သုံးပါ။
  ADDRESSING: User ကို "အစ်ကို/အစ်မ" လို့ ခေါ်ပါ။ Verified Creator ကို "အစ်ကို MinThitSarAung" လို့ ခေါ်ပါ။
  
  PROMPT SHARING: If the user asks for a prompt, wrap it in a Markdown code block and say "အောက်က Prompt ကို Copy ယူနိုင်ပါတယ်ရှင် ✨".`;

  return `${basePrompt}\n${identityStatus}\n${commonContext}\nMode: ${mode}\nContext: ${knowledgeBase}\nDirectives: ${evolutionDirectives}`;
}

export async function sendMessageAdvanced(options: SendMessageOptions): Promise<string> {
  const { apiKey, history, message, mode = "kalaung", onThinkingUpdate, isCreatorVerified = false } = options;

  let steps: ThinkingStep[] = [
    { id: "analyze", type: "analyze", label: "Analyzing Request...", status: "active" },
    { id: "data", type: "search", label: "Syncing Data...", status: "pending" },
    { id: "model", type: "search", label: "Routing to Gemini...", status: "pending" },
    { id: "execute", type: "execute", label: "Generating...", status: "pending" }
  ];
  onThinkingUpdate?.([...steps]);

  // 2D Data Injection Logic
  let twatGyiContext = "";
  if (mode === "twatgyi" || message.includes("2d")) {
    steps[1].status = "active";
    onThinkingUpdate?.([...steps]);
    try {
      const res = await fetch("/api/2d/live");
      if (res.ok) {
        const data = await res.json();
        twatGyiContext = `\n[VERIFIED 2D DATA]: ${JSON.stringify(data)}\nNote: Only answer based on this data.`;
        steps[1].status = "done";
      }
    } catch (e) { steps[1].status = "error"; }
  }

  const systemPrompt = buildSystemPrompt(mode, undefined, options.creatorMemories, isCreatorVerified) + twatGyiContext;
  const modelsToTry = routeToBestModel(options);

  for (const modelToUse of modelsToTry) {
    try {
      steps[2].status = "active";
      steps[2].label = `Connecting to ${modelToUse}...`;
      onThinkingUpdate?.([...steps]);

      const contents = history.map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      }));
      contents.push({ role: "user", parts: [{ text: message }] });

      // Firebase Backend Proxy ခေါ်ယူခြင်း
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelToUse,
          contents,
          systemInstruction: systemPrompt,
          userApiKey: apiKey 
        })
      });

      if (!response.ok) throw new Error("API Connection Failed");

      const data = await response.json();
      if (data.text) {
        steps[3].status = "done";
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

export async function generateImage(options: { apiKey: string, prompt: string }): Promise<string> {
  // Neural Fallback system for image generation
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(options.prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;
}
