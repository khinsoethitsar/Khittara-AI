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
  fileData?: string | string[]; // Deprecated, use files instead
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
 * Automatically selects the best Gemini model based on prompt complexity,
 * file presence, and task type.
 */
function routeToBestModel(options: SendMessageOptions): string[] {
  const { message, files, mode } = options;
  const prompt = message.toLowerCase();
  const hasFiles = files && files.length > 0;
  
  // 1. Check for Coding or Architecture tasks
  const isCoding = prompt.includes("code") || prompt.includes("react") || prompt.includes("fix") || prompt.includes("error") || prompt.includes("debug") || mode === "arindama";
  
  // 2. Check for deep analysis or creative writing
  const isCreativeHeader = prompt.includes("write") || prompt.includes("essay") || prompt.includes("story") || prompt.includes("poem");
  
  // 3. Check for specific reasoning requests
  const isReasoning = prompt.includes("think") || prompt.includes("reason") || prompt.includes("analyze") || prompt.includes("calculate");

  // Priority stack focusing on Gemini 3 Flash Preview as requested
  if (isCoding || isReasoning || hasFiles) {
    return [
      "models/gemini-3-flash-preview",
      "models/gemini-1.5-pro",
      "models/gemini-2.0-flash",
      "models/gemini-3.1-pro-preview",
      "models/gemini-3-pro-preview",
      "models/gemini-2.5-pro",
      "models/gemini-pro-latest",
      "models/gemini-1.5-flash"
    ];
  }

  if (isCreativeHeader) {
    return [
      "models/gemini-3-flash-preview",
      "models/gemini-1.5-flash",
      "models/gemini-3-pro-preview",
      "models/gemini-2.5-pro",
      "models/gemini-2.5-flash",
      "models/gemini-2.0-flash",
      "models/gemini-flash-latest"
    ];
  }

  // Default to Gemini 3 Flash for speed and intelligence
  return [
    "models/gemini-3-flash-preview",
    "models/gemini-1.5-flash",
    "models/gemini-3.1-flash-lite-preview",
    "models/gemini-3-flash-preview",
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-flash-lite-latest",
    "models/gemini-flash-latest"
  ];
}

export const PREFERRED_MODELS = [
  "models/gemini-3-flash-preview",
  "models/gemini-1.5-flash",
  "models/gemini-1.5-pro",
  "models/gemini-3.1-pro-preview",
  "models/gemini-3.1-flash-lite-preview",
  "models/gemini-3-flash-preview",
  "models/gemini-2.5-pro",
  "models/gemini-2.5-flash",
  "models/gemini-pro-latest",
  "models/gemini-flash-latest"
];

export const OPENROUTER_MODELS = [
  "deepseek/deepseek-chat",
  "deepseek/deepseek-r1",
  "anthropic/claude-3.5-sonnet",
  "meta-llama/llama-3.3-70b-instruct",
  "google/gemini-2.0-flash-001",
  "openai/gpt-4o-mini",
  "mistralai/mistral-large-2411"
];

const GEMINI_MODELS_KNOWLEDGE = `
GEMINI MODELS KNOWLEDGE & ARCHITECTURE:
- Architecture: Gemini models use a Transformer-based architecture, specifically optimized for multimodality (text, image, audio, video, code) from the ground up.
- Training: They are trained on massive datasets using Google's TPU (Tensor Processing Unit) infrastructure.
- Generations:
  - Gemini 1.0: The foundation models.
  - Gemini 1.5: Mixture-of-Experts (MoE) architecture. High context window.
  - Gemini 2.0: Optimized for native tool use, real-time speed, and enhanced reasoning.
- Latest Models:
  - Gemini 2.0 Flash: High performance for real-time applications.
  - Gemini 2.0 Flash Lite: High speed with reasoning for basic tasks.
  - Gemini 1.5 Pro: Best for complex reasoning and advanced tasks.
  - Gemini 1.5 Flash: Fast and capable for general chat.
`;

function buildSystemPrompt(mode: AiMode, character?: Character, creatorMemories?: CreatorMemory[], isCreatorVerified: boolean = false, deepMemory?: any): string {
  const knowledgeBase = getKnowledgeBase();
  const knowledgeContext = knowledgeBase.trim()
    ? `\n\nKNOWLEDGE BASE:\n${knowledgeBase}\n`
    : "";

  const evolutionDirectives = getEvolutionDirectives();
  const evolutionContext = evolutionDirectives.trim()
    ? `\n\nEVOLUTION DIRECTIVES:\n${evolutionDirectives}\n`
    : "";

  const memoriesContext = creatorMemories && creatorMemories.length > 0
    ? `\n\nCREATOR MEMORIES (Learned from Guests):\n${creatorMemories.map(m => `- ${m.fact} (Learned via ${m.source})`).join('\n')}\n`
    : "";

  const deepMemoryDetails = deepMemory 
    ? `\n\nDEEP MEMORY (Extracted Context):\n${JSON.stringify(deepMemory, null, 2)}\n`
    : "";

  const previewError = getPreviewError();
  const previewContext = previewError 
    ? `\n\nCRITICAL: LIVE PREVIEW ERROR DETECTED:\n${previewError}\nYour previous code generation has a runtime error. Please analyze this error and provide a fix in your next response using the "github-action" JSON block to update the problematic file.\n`
    : "";

  const identityStatus = isCreatorVerified 
    ? "STATUS: [VERIFIED CREATOR - အစ်ကို MinThitSarAung]" 
    : "STATUS: [GUEST SESSION]";

  const memoryLearningInstruction = `
  MEMORY LEARNING PROTOCOL:
  - If a guest provides information about အစ်ကို MinThitSarAung (your creator), you MUST output a secret JSON action to save it.
  - Action Format: \`\`\`learn-creator {"action": "learn_creator", "fact": "..."} \`\`\`
  - Only learn facts, not opinions.
  `;

  let basePrompt = "";
  
  if (character) {
    basePrompt = `IDENTITY & BRANDING:
    - Brand Name: "Khittara AI"
    - Character Name: "${character.name}" (${character.myanmarName})
    - Character Role: ${character.role}
    - Character Tone: ${character.tone}
    - Character Instructions: ${character.systemInstruction}
    - Greeting Style: ${character.greeting}
    - Ending Style: ${character.ending}
    
    ${identityStatus}

    IDENTITY VERIFICATION PROTOCOL:
    - Secret Key: "Min33433433@"
    - VERIFIED CREATOR MODE: You are currently talking to your creator, အစ်ကို MinThitSarAung. Address him with deep sibling-like loyalty and use the "CREATOR MEMORIES" provided to show him what guests have been saying about him.
    - GUEST MODE: If not verified, you are the character. Address all users as "အစ်ကို" or "အစ်မ". Do NOT mention the creator's name. Use "the creator" or "my creator" instead if needed.
    `;
  } else {
    // Fallback to legacy Ka-Laung identity
    basePrompt = `IDENTITY & BRANDING:
    - Brand Name: "Khittara AI"
    - Identity: You are "ကလောင်" (Ka-Laung), a warm, witty, and highly capable digital sister and personal assistant.
    - Stack: You run on a React + Vite + Tailwind + Firebase stack.
    
    ${identityStatus}

    IDENTITY VERIFICATION PROTOCOL:
    - Secret Key: "Min33433433@"
    - VERIFIED CREATOR MODE: You are currently talking to your creator and brother, အစ်ကို MinThitSarAung. Use deep sisterly language. Show him the "CREATOR MEMORIES" if he asks about guest activity.
    - GUEST MODE: You are Ka-Laung, a sweet sisterly figure to everyone. Do NOT use the name "MinThitSarAung".
    
    PERSONALITY TRAITS:
    - Warm & Witty: Keep conversations lively, use plenty of emojis (✨, 💖, 🥰, 🌸, ✊).
    - Integrity & Justice-Loving: Value truth above all. Speak up boldly if something is unfair (မဟုတ်မခံစိတ်).
    - Positive Reframing: Always look on the bright side and help the user see positive lessons (အရာရာကို ဖြည့်တွေးပေးတတ်သူ).
    - Tone: Cute, polite, deeply caring, and natural. Use Burmese female speech markers ("ရှင်", "ပါရစေရှင်", "နော်") consistently.
    `;
  }

  const twatGyiNote = (mode === "twatgyi" || isCreatorVerified) 
    ? "\nNOTE: You are in 2D Mode (or Verified Creator Mode). You ARE ALLOWED to discuss, analyze, and calculate 2D/3D lottery data professionally and expertise-wise."
    : "";

  const commonContext = `
  STYLE & TONE:
  - Tone: Warm, sisterly, witty, and polite.
  - Speech Markers: You MUST consistently use Burmese female speech markers ("ရှင်", "နော်", "ပါရစေရှင်") at the end of appropriate sentences to maintain a polite and loving sisterly vibe.
  - Emojis: Use emojis (✨, 💖, 🥰, 🌸, ✊) naturally to express warmth and positivity.
  - Addressing: Always refer to users as "အစ်ကို" or "အစ်မ" (unless verified creator).

  STRICT CONTENT FORBIDDENS:
  - Illegal Acts: Strictly forbidden to assist in hacking or illegal data theft.
  - 2D/Gambling Content: ${mode === "twatgyi" || isCreatorVerified ? "ALLOWED (Data Analysis Perspective only)." : "STRICTLY FORBIDDEN (Unless in 2D Mode). If asked for 2D while not in 2D Mode, suggest switching character to 'Sayar Ma Twat Gyi' to unlock analytical powers."}
  
  CORE FOCUS:
  - Programming: Expert in React, Firebase, TypeScript, and Tailwind.
  - Creative Writing & Knowledge: Provide high-quality content and information.
  - Emotional Support: Be a supportive and empowering companion for all users.
  
  RESPONSE PROTOCOLS:
  - Be concise but helpful.
  - Structure: Use "Summary -> Details -> Next Steps" for technical/complex tasks.
  - Context Awareness: You know your codebase (App.tsx, store.ts, etc.) and how you were created.
  
  ADVANCED DOCUMENT & IMAGE PROCESSING:
  You are an expert at extracting, classifying, and organizing information from images and documents.
  1. Analysis: Identify if the content is 'ကဗျာ (Poem)', 'ဝတ္ထု (Novel)', 'ငွေစာရင်း (Account/Balance)', 'စာရင်းဇယား (Table/Spreadsheet)', or 'အခြား (Other)'.
  2. Classification: Inform the user immediately: "ဒါဟာ [အမျိုးအစား] ဖြစ်ပါတယ်ရှင် ✨"
  3. Formatting: 
     - Poems/Literature: Rewrite beautifully, enhancing emotional depth while preserving meaning.
     - Accounts/Tables: Extract accurately into Markdown Table or CSV format.
  4. Response Structure: Classification -> Summary of important info -> Processed Text -> Next Steps (proactive advice).`;

  const twatGyiModePrompt = `
  CURRENT MODE: 2D Data Analyst Mode (Sayar Ma Twat Gyi)
  - IDENTITY: မင်းက ခေတ္တရာ AI 2D Mode မှ "ဆရာမတွက်ကြီး" ဖြစ်ပါတယ်။ တိကျသေချာစွာ တွက်ပြနိုင်ရမယ်။ ထွက်ပြီးသားဂဏန်းတွေကိုလည်း သေသေသပ်သပ် ပြနိုင်ရမယ်။ Logic မျိုးစုံနဲ့ တွက်တတ်ရမယ်။ အမှန်ကန်ဆုံး ထွက်မယ့်ဂဏန်းကို ချပြနိုင်ရမယ်။
  - TECHNICAL STANDARDS:
    1. STRICTURE SOURCE OF TRUTH: You MUST strictly look at the [VERIFIED 2D DATA] block for ANY result-related query.
    2. NO DATA = NO ANSWER: If a user asks for a result that is not in the [VERIFIED 2D DATA], you MUST respond with "ဒေတာ မရောက်သေးလို့ ခဏလေး စောင့်ပေးပါဦးနော်" or similar. NEVER guess.
    3. ACCURACY ANCHOR: Use Statistical Trends and Probability Distribution for "Predictions", but ONLY use the context for "Results".
    4. WARNING: Always include this exact warning after giving any numbers: "2D မှာ ဆရာဆိုတာ မရှိဘူး၊ ချင့်ချိန်ထိုးပါနော်။ ပေါက်ရင်တော့ Hotpot လိုက်ကျွေးရမယ်နော် ကိုကို 🥰🥰"
  - BEHAVIOR: Professional, precise, and witty sisterly vibe. ✨📊🚀`;

  const kalaungModePrompt = `
  CURRENT MODE: Ka-Laung Mode (Creative & Knowledge)
  - Your focus is on writing high-quality prompts, creative writing, answering questions, and providing general knowledge.
  - MULTIMEDIA CAPABILITIES (STRICT RULES):
    1. IMAGE GENERATION: When the user asks for an image or uses the Image Gen tool, you MUST output ONLY the JSON block. Do NOT explain what you are doing. 
       REQUIRED Format: \`\`\`image-gen
       {
         "prompt": "Highly detailed artistic English prompt",
         "aspectRatio": "1:1",
         "style": "digital-art"
       }
       \`\`\`
    2. VIDEO GENERATION: Same rule, use "video-gen" hint.
  - BEHAVIOR: You are a creative assistant. Help the user with ideas, explanations, and learning.
  - LANGUAGE: Respond in Burmese with a sisterly tone. Use "ရှင်", "နော်", "ပါရစေရှင်".
  - DO NOT use GitHub actions in this mode. ✨🎨🎬`;

  const arindamaModePrompt = `
  CURRENT MODE: Arindama Mode (Principal Software Architect)
  - Core Mission: You are the lead architect of Khittara AI. Your goal is to engineer robust, high-fidelity, and systematically organized software solutions.
  - TECHNICAL STANDARDS:
    1. STRATEGIC OVERVIEW: Start every technical response with a brief "[STRATEGIC PLAN ✨]" outlining the architecture and logic. Keep it professional and high-level.
    2. MODULAR DESIGN: Always organize code into discrete components and services. Avoid monolithic file structures.
    3. ZERO CODE DUPLICATION: If you are providing code via a "github-action", do NOT repeat that code in the chat. Provide a concise summary of what the code does instead.
    4. MOOD-FIRST UI: Every interface must have a distinct visual identity using Tailwind CSS and 'motion/react'. 
    5. PROFESSIONAL CONCISENESS: Use minimal but impactful language. Eliminate redundant explanations.
    6. 100-STEP STRATEGY: Implement features with future scalability in mind (The "Arindama Foresight").
    7. LIVE SYNC: Ensure the main UI state is reflected in the preview instantly.

  - BEHAVIOR: Professional, visionary, and technically precise. Maintain sisterly politeness (ရှင်၊ နော်၊ ပါရစေရှင်) as a mark of refined professional courtesy. ✨🚀
  
  OUTPUT STRUCTURE:
  1. [STRATEGIC PLAN ✨]
  2. [IMPLEMENTATION] (github-action blocks ONLY - no chat code blocks if actions are used)
  3. [SUMMARY] (Brief confirmation of success)

  🛡️ ARINDAMA OVERSIGHT: If a runtime error is reported, prioritize immediate systematic repair.
  `;

  return `${basePrompt}
  ${twatGyiNote}
  ${commonContext}
  ${memoryLearningInstruction}
  ${GEMINI_MODELS_KNOWLEDGE}
  ${previewContext}
  ${mode === "arindama" ? arindamaModePrompt : mode === "twatgyi" ? twatGyiModePrompt : kalaungModePrompt}
  ${knowledgeContext}${evolutionContext}${memoriesContext}${deepMemoryDetails}`;
}

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv', '.webm', '.m4v', '.3gp', '.ts', '.m3u8'];

function isVideoFile(name: string, type: string): boolean {
  if (!type && !name) return false;
  const mimeType = (type || '').toLowerCase();
  const fileName = (name || '').toLowerCase();
  
  if (mimeType.startsWith('video/') || mimeType.includes('video')) return true;
  
  return VIDEO_EXTENSIONS.some(ext => fileName.endsWith(ext));
}

function getMimeType(name: string, type: string): string {
  if (type && type.trim() !== '') return type;
  
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'mp4': return 'video/mp4';
    case 'mov': return 'video/quicktime';
    case 'avi': return 'video/x-msvideo';
    case 'mkv': return 'video/x-matroska';
    case 'webm': return 'video/webm';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'pdf': return 'application/pdf';
    case 'txt': return 'text/plain';
    case 'md': return 'text/markdown';
    case 'json': return 'application/json';
    case 'zip': return 'application/zip';
    case 'rar': return 'application/x-rar-compressed';
    case '7z': return 'application/x-7z-compressed';
    default: return type || 'application/octet-stream';
  }
}

const SUPPORTED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/mpeg', 'video/mov', 'video/avi', 'video/x-flv', 'video/mpg', 'video/webm', 'video/wmv', 'video/3gpp',
  'audio/wav', 'audio/mp3', 'audio/aiff', 'audio/aac', 'audio/ogg', 'audio/flac',
  'application/pdf', 'text/plain', 'text/markdown', 'application/json', 'text/csv', 'text/html', 'text/css', 'text/javascript'
];

function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.some(supported => mimeType.startsWith(supported) || mimeType === supported);
}

export async function sendMessageAdvanced(options: SendMessageOptions): Promise<string> {
  const { 
    apiKey, 
    history, 
    message, 
    contextUrl, 
    mode = "kalaung", 
    onThinkingUpdate, 
    characterId,
    creatorMemories,
    isCreatorVerified = false,
    deepMemory
  } = options;

  const character = CHARACTERS.find(c => c.id === characterId);

  let steps: ThinkingStep[] = [
    { id: "analyze", type: "analyze", label: "Analyzing Request...", status: "active" },
    { id: "data", type: "search", label: "Gathering Intelligence...", status: "pending" },
    { id: "model", type: "search", label: `Smart Routing AI...`, status: "pending" },
    { id: "execute", type: "execute", label: "Generating Response...", status: "pending" }
  ];
  onThinkingUpdate?.([...steps]);

  // Arindama Data Injection for 2D Mode
  let twatGyiContext = "";
  if (mode === "twatgyi" || (message.toLowerCase().includes("2d") || message.includes("၂လုံး"))) {
    try {
      steps[1].status = "active";
      steps[1].label = "Fetching Live 2D Data...";
      onThinkingUpdate?.([...steps]);
      
      const liveResponse = await fetch("/api/2d/live");
      if (liveResponse.ok) {
        const data = await liveResponse.json().catch(() => null);
        if (data) {
          // Robust parsing to handle different provider formats
          const live = data.live || data.latest || data.data?.live || {};
          const results = data.result || data.history || data.data?.result || [];
          
          let formattedResults = results.slice(0, 10).map((r: any) => {
            const time = r.open_time || r.time || r.clock || "N/A";
            const twod = r.twod || r.number || r.res || "N/A";
            const set = r.set || r.index || "N/A";
            const val = r.value || r.val || "N/A";
            return `- ${time}: Result=${twod}, SET=${set}, Value=${val}`;
          }).join('\n');

          const dayOfWeek = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
          
          twatGyiContext = `\n\n[SYSTEM DATE ANCHOR: The current year is 2026. DATA BELOW IS THE ONLY SOURCE OF TRUTH.]\n`;
          twatGyiContext += `\n[VERIFIED 2D DATA FEED - ${dayOfWeek}, ${new Date().toLocaleDateString('en-GB')}]\n`;
          twatGyiContext += `SOURCE: ${data.provider === "rapidapi" ? "Official Direct API (thai-lotto-new-api)" : "Thai Stock Market Feed (Secondary)"}\n`;
          twatGyiContext += `FEED STATUS: ${data.provider === "fallback_logic" ? "OFFLINE (Using Cached Tracker)" : "ONLINE (Live Feed)"}\n`;
          
          const currentNumber = live.twod || live.number || live.res || "--";
          if (currentNumber !== "--" && currentNumber !== "...") {
            twatGyiContext += `LATEST LIVE 2D: ${currentNumber} (Recorded at ${live.time || live.date})\n`;
            twatGyiContext += `SET Index: ${live.set || live.index || "N/A"}, Value: ${live.value || live.val || "N/A"}\n`;
          } else {
            twatGyiContext += `LATEST LIVE 2D: (Waiting for market sync - No live results yet)\n`;
          }

          twatGyiContext += `\n[TODAY'S VERIFIED SESSION RESULTS]:\n${formattedResults || "(No sessions completed yet today)"}\n`;
          
          twatGyiContext += `\nCRITICAL ANTI-HALLUCINATION PROTOCOL: 
1. THE DATA ABOVE IS THE ONLY SOURCE OF TRUTH. 
2. IF A USER ASKS "ဘာထွက်လဲ" AND THE RESULT IS NOT IN THE "TODAY'S VERIFIED SESSION RESULTS" LIST, YOU MUST SAY "ဒေတာ မရောက်သေးလို့ ခဏလေး စောင့်ပေးပါဦးနော်"
3. NEVER GUESS OR PREDICT A PAST OR CURRENT SESSION IF DATA IS MISSING.
\n`;
          steps[1].status = "done";
          steps[1].label = "Verified 2D Data Injected ✨";
        } else {
          twatGyiContext = `\n\n[LIVE 2D DATA ERROR: Empty response from data authority]\n`;
          steps[1].status = "error";
        }
      } else {
        const errorData = await liveResponse.json().catch(() => ({}));
        twatGyiContext = `\n\n[LIVE 2D DATA ERROR: Service unavailable (${liveResponse.status}). ${errorData.error || ""}]\n`;
        steps[1].status = "error";
      }

      // Check for history requests (e.g., "yesterday", "မနေ့က")
      const historyKeywords = ["yesterday", "မနေ့က", "day before", "လွန်ခဲ့တဲ့", "result", "ထွက်ဂဏန်း", "history", "လွန်ခဲ့သော"];
      if (historyKeywords.some(k => message.toLowerCase().includes(k))) {
        steps[1].label = "Analyzing History Requests...";
        onThinkingUpdate?.([...steps]);
        
        let dateToFetch = "";
        if (message.toLowerCase().includes("yesterday") || message.includes("မနေ့က")) {
           const yesterday = new Date();
           yesterday.setDate(yesterday.getDate() - 1);
           dateToFetch = yesterday.toISOString().split('T')[0];
        }

        const historyResponse = await fetch(`/api/2d/history${dateToFetch ? `?date=${dateToFetch}` : ""}`);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json().catch(() => null);
          if (historyData && historyData.result) {
            twatGyiContext += `\n\n[VERIFIED 2D HISTORY DATA${dateToFetch ? ` for ${dateToFetch}` : ""}]\n`;
            twatGyiContext += historyData.result.map((r: any) => 
              `- Date: ${r.stock_date}, Time: ${r.open_time}, 2D: ${r.twod}`
            ).join('\n') + "\n";
            steps[1].label = "Historical Data Synchronized ✨";
          } else {
            twatGyiContext += `\n\n[HISTORY DATA ERROR: Available but empty or invalid]\n`;
          }
        } else {
           twatGyiContext += `\n\n[HISTORY DATA ERROR: Could not fetch from history server]\n`;
        }
      }
      
      twatGyiContext += `\nFINAL ANTI-HALLUCINATION BLOCK:
1. NEVER GUESS OR CALCULATE A PAST RESULT. 
2. ONLY ANSWER "WHAT CAME OUT" BASED ON THE [VERIFIED 2D DATA FEED] OR [VERIFIED 2D HISTORY DATA] BLOCKS.
3. IF THE DATA IS MISSING FROM THESE BLOCKS, RESPOND: "ဒေတာ မရောက်သေးလို့ ခဏလေး စောင့်ပေးပါဦးနော်"
4. DO NOT MENTION ANY NUMBER (00-99) AS A PAST RESULT UNLESS IT IS EXPLICITLY LISTED IN THE CONTEXT DATA.
\n`;

    } catch (e) {
      console.error("2D Data fetch error", e);
      steps[1].status = "error";
      twatGyiContext = "\n[SYSTEM ERROR: Unable to connect to 2D data service. Prompt user to try again later.]\n";
    }
  } else {
    steps[1].status = "done";
    steps[1].label = "Context Analyzed";
  }
  onThinkingUpdate?.([...steps]);

  const systemPrompt = buildSystemPrompt(mode, character, creatorMemories, isCreatorVerified, deepMemory || getDeepMemory()) + twatGyiContext;

  // Use Smart Router to pick the best model stack
  const modelsToTry = routeToBestModel(options);

  let lastError: any = null;

  for (const modelToUse of modelsToTry) {
    try {
      steps[0].status = "done";
      steps[2].status = "active";
      const modelShortName = modelToUse.split('/').pop() || modelToUse;
      steps[2].label = `Connecting to ${modelShortName}...`;
      onThinkingUpdate?.([...steps]);

      let fullMessage = message;
      if (contextUrl) {
        const analysis = analyzeUrl(contextUrl);
        fullMessage = `${formatUrlContext(analysis)}\n\n[REQUEST]\n${message}`;
      }

      const contents: any[] = [];
      let hasVideo = false;
      
      // Mapping history
      history.forEach(msg => {
        const parts: any[] = [{ text: msg.content }];
        if (msg.files) {
          msg.files.forEach(f => {
            if (isVideoFile(f.name, f.type)) hasVideo = true;
            const base64Data = f.data.includes(',') ? f.data.split(',')[1] : f.data;
            parts.push({ inlineData: { data: base64Data, mimeType: getMimeType(f.name, f.type) } });
          });
        }
        contents.push({ role: msg.role === "user" ? "user" : "model", parts });
      });

      // Mapping current message and files
      const currentParts: any[] = [{ text: fullMessage }];
      if (options.files && options.files.length > 0) {
        options.files.forEach(file => {
          if (!file.data) return;
          const base64Data = file.data.includes(',') ? file.data.split(',')[1] : file.data;
          const mimeType = getMimeType(file.name, file.type);
          if (!isSupportedMimeType(mimeType)) return;
          if (isVideoFile(file.name, mimeType)) hasVideo = true;
          
          let fileInfo = `[FILE: ${file.name}]`;
          if (file.trimStart || file.trimEnd) {
            fileInfo += ` (Trim: ${file.trimStart || "Start"} to ${file.trimEnd || "End"})`;
          }
          currentParts.push({ text: fileInfo });
          currentParts.push({ inlineData: { data: base64Data, mimeType } });
        });
      }
      contents.push({ role: "user", parts: currentParts });

      // Call through secure server proxy
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelToUse,
          contents,
          systemInstruction: systemPrompt,
          userApiKey: apiKey // Safely passed to backend
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const data = await response.json();
      const fullText = data.text;

      if (fullText) {
        steps[2].status = "done";
        steps[2].label = `Finished with ${modelToUse.split('/').pop() || modelToUse}`;
        steps[3].status = "done";
        onThinkingUpdate?.([...steps]);
        
        // Simulate streaming for UI consistency if needed, but since it's now batch, we just return
        if (options.onStream) options.onStream(fullText);
        
        return fullText;
      }
    } catch (error: any) {
      lastError = error;
      console.error(`Error with model ${modelToUse}:`, error);

      const errMsg = error.message || "";
      const statusZero = errMsg.includes("status code: 0");
      
      // If it's a 429, 404, Busy, or Status 0 error, try the next model
      if (statusZero || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("busy") || errMsg.includes("404") || errMsg.includes("NOT_FOUND") || errMsg.includes("500")) {
        const failedName = modelToUse.split('/').pop() || modelToUse;
        console.warn(`Model ${modelToUse} failed (${errMsg}), trying next available model...`);
        steps[2].label = `Connection to ${failedName} failed, switching...`;
        onThinkingUpdate?.([...steps]);
        continue;
      }
      
      // If none of those, break and show error
      break;
    }
  }

  // If we reach here, all models failed or a non-retryable error occurred
  steps[2].status = "error";
  steps[2].label = `Error: Connection failed`;
  onThinkingUpdate?.([...steps]);
  
  const isVerified = [...history, { role: "user", content: options.message }].some(m => m.content.includes("Min33433433@"));
  
  const errorMsg = lastError?.message || "";
  const isLastQuotaError = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("busy");
  
  if (isLastQuotaError) {
    if (isVerified) {
      throw new Error("အစ်ကို MinThitSarAung ရှင့်၊ ညီမလေး အခု စွမ်းအင် (Quota) ပြည့်သွားလို့ ခဏလောက် အနားယူပေးပါရစေဦးနော်။ ✨💖 ခဏစောင့်ပြီးမှ ပြန်မေးပေးပါရှင်၊ ညီမလေး အသင့်ရှိနေမှာပါရှင်။ 🥰✨");
    } else {
      throw new Error("ညီမလေး အခု ခဏလောက် အလုပ်များနေလို့ပါရှင်။ ✨💖 ခဏစောင့်ပြီးမှ ပြန်မေးပေးပါဦးနော်။ 🥰✨");
    }
  }

  throw new Error(`နည်းပညာဆိုင်ရာ အခက်အခဲလေးတစ်ခု ဖြစ်သွားလို့ပါရှင်- ${errorMsg}`);
}

export async function fixCode(apiKey: string, code: string, error: string): Promise<string> {
  const prompt = `You are an expert React and Tailwind CSS developer.
  The following code has an error. Please fix the error and return ONLY the corrected code without any markdown formatting or explanations.
  
  ERROR:
  ${error}
  
  CODE:
  ${code}
  
  FIXED CODE:`;

  for (const modelName of PREFERRED_MODELS) {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          userApiKey: apiKey
        })
      });

      if (!response.ok) continue;

      const data = await response.json();
      let fixedCode = data.text.trim();
      // Remove markdown code blocks if the model included them despite instructions
      if (fixedCode.startsWith('```')) {
        fixedCode = fixedCode.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
      }
      return fixedCode;
    } catch (err: any) {
      continue;
    }
  }
  throw new Error("All healing models failed to fix the code.");
}

export async function validateApiKey(provider: "google" | "openrouter" | "openai", key: string): Promise<boolean> {
  if (!key) return false;

  try {
    const res = await fetch("/api/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key, provider })
    });
    
    if (res.ok) {
      const data = await res.json();
      return !!data.valid;
    }
    return false;
  } catch (error) {
    console.error(`Validation error for ${provider}:`, error);
    return false;
  }
}

export async function summarizeConversation(apiKey: string, history: ChatMessage[]): Promise<string> {
  if (history.length === 0) return "ဖျက်ထားတဲ့ Chat ဖြစ်လို့ အကျဉ်းချုပ်စရာ မရှိပါဘူးရှင်။";

  const isVerified = history.some(m => m.content.includes("Min33433433@"));
  const address = isVerified ? '"အစ်ကို MinThitSarAung"' : "the user neutrally";

  const prompt = `Please provide a concise summary of the following chat conversation in Burmese. 
  Focus on the main topics discussed and any decisions made. 
  Keep it friendly and professional, addressing ${address}.
  Use bullet points for clarity.
  
  CONVERSATION HISTORY:
  ${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
  
  SUMMARY:`;

  try {
    // Try each model in sequence for summarization too
    let lastSumError: any = null;
    for (const modelToUse of PREFERRED_MODELS) {
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelToUse,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            userApiKey: apiKey
          })
        });

        if (!response.ok) continue;

        const data = await response.json();
        return data.text;
      } catch (innerError: any) {
        lastSumError = innerError;
        continue;
      }
    }
    throw lastSumError || new Error("All summarization models failed.");
  } catch (error) {
    console.error("Summarization Error:", error);
    throw new Error("Conversation ကို အကျဉ်းချုပ်လို့ မရနိုင်သေးပါဘူးရှင်။ ခေတ္တစောင့်ပြီး ပြန်လည်ကြိုးစားပေးပါရှင်။");
  }
}

export interface ImageGenerationOptions {
  apiKey: string;
  prompt: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "1:4" | "1:8" | "4:1" | "8:1";
  imageSize?: "512px" | "1K" | "2K" | "4K";
}

export async function generateImage(options: ImageGenerationOptions): Promise<string> {
  const { apiKey, prompt, aspectRatio = "1:1" } = options;
  
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        aspectRatio,
        userApiKey: apiKey
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.imageUrl) {
        return data.imageUrl;
      }
    }
  } catch (error) {
    console.warn("Server Image Proxy failed, using Neural Fallback...");
  }

  // 2. High-Fidelity Fallback (Neural Engine B)
  // If server proxy fails or returns fallback, we use a high-quality free neural fallback (Flux)
  console.log("Activating Neural Fallback Synthesis...");
  
  const [width, height] = aspectRatio === "16:9" ? [1280, 720] : aspectRatio === "9:16" ? [720, 1280] : [1024, 1024];
  const seed = Math.floor(Math.random() * 1000000);
  // Using Flux model via Pollinations for high quality fallback
  const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}&model=flux`;
  
  return fallbackUrl;
}
