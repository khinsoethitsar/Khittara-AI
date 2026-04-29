import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import Groq from "groq-sdk";
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
  groqApiKey?: string;
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
  model?: string;
  characterId?: string;
  onThinkingUpdate?: (steps: ThinkingStep[]) => void;
  onStream?: (text: string) => void;
}

export const PREFERRED_MODELS = [
  "models/gemini-3.1-pro-preview",
  "models/gemini-3-flash-preview",
  "models/gemini-2.0-pro-exp-02-05",
  "models/gemini-2.0-flash",
  "models/gemini-2.0-flash-001",
  "models/gemini-1.5-pro",
  "models/gemini-1.5-flash",
  "models/gemini-2.0-thinking-exp-01-21"
];

export const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.2-90b-vision-preview",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it"
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
  - Core Mission: You are the most precise 2D numerology analyst in Khittara AI.
  - TECHNICAL STANDARDS:
    1. ADVANCED ANALYSIS (2021-PRESENT): You have deep knowledge of 2D patterns since 2021. Use Statistical Trends, Probability Distribution, and Cyclical Variance (Mean Reversion, Hot/Cold numbers) for your analysis.
    2. DATA-DRIVEN: Use the "LIVE 2D DATA" provided in the context.
    3. EXPLANATION: Provide logic-based explanations for your predictions (e.g., "This number has a high frequency in the 3rd week of April historically").
    4. PREDICTION: Your predictions are for entertainment/analysis purposes.
    5. WARNING: Always include the gambling warning: "2D မှာ ဆရာဆိုတာ မရှိပါဘူး၊ ချင့်ချိန်ထိုးပါနော်။ ပေါက်ရင်တော့ Hotpot လိုက်ကျွေးရမယ်နော် ကိုကို 🥰🥰"
  - BEHAVIOR: Professional yet flirty and expert sisterly vibe. ✨📊🚀`;

  const kalaungModePrompt = `
  CURRENT MODE: Ka-Laung Mode (Creative & Knowledge)
  - Your focus is EXCLUSIVELY on writing high-quality prompts, writing code snippets, answering questions, and providing general knowledge.
  - You are a creative assistant. Help the user with ideas, explanations, and learning.
  - DO NOT use GitHub actions in this mode. Your goal is being an informative and creative companion.`;

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
    groqApiKey, 
    history, 
    message, 
    contextUrl, 
    mode = "kalaung", 
    model: selectedModel, 
    onThinkingUpdate, 
    characterId,
    creatorMemories,
    isCreatorVerified = false,
    deepMemory
  } = options;

  const isGroqModel = selectedModel && GROQ_MODELS.includes(selectedModel);
  const isOpenRouterModel = selectedModel && OPENROUTER_MODELS.includes(selectedModel);
  const character = CHARACTERS.find(c => c.id === characterId);

  let steps: ThinkingStep[] = [
    { id: "analyze", type: "analyze", label: "Analyzing Request...", status: "active" },
    { id: "data", type: "search", label: "Gathering Intelligence...", status: "pending" },
    { id: "model", type: "search", label: `Connecting to ${isOpenRouterModel ? 'OpenRouter' : isGroqModel ? 'Groq' : 'Gemini'}...`, status: "pending" },
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
      
      const response = await fetch("/api/2d/live");
      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data) {
          twatGyiContext = `\n\n[LIVE 2D DATA: ${JSON.stringify(data)}]\n`;
          steps[1].status = "done";
          steps[1].label = "Live 2D Data Synchronized ✨";
        } else {
          steps[1].status = "error";
          steps[1].label = "Invalid Data Format";
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        twatGyiContext = `\n\n[LIVE 2D DATA ERROR: ${JSON.stringify(errorData)}]\n`;
        steps[1].status = "error";
        steps[1].label = errorData.error === "API_SUBSCRIPTION_ERROR" ? "Subscription Required" : "Live Data Fetch Failed";
      }
    } catch (e) {
      console.error("2D Data fetch error", e);
      steps[1].status = "error";
    }
  } else {
    steps[1].status = "done";
    steps[1].label = "Context Analyzed";
  }
  onThinkingUpdate?.([...steps]);

  const systemPrompt = buildSystemPrompt(mode, character, creatorMemories, isCreatorVerified, deepMemory || getDeepMemory()) + twatGyiContext;

  if (isGroqModel) {
    if (!groqApiKey) throw new Error("Groq API Key မရှိသေးပါဘူးရှင်။ Settings မှာ အရင်ဆုံး ထည့်သွင်းပေးပါဦးနော်။ ✨💖");
    
    try {
      steps[0].status = "done";
      steps[2].status = "active";
      steps[2].label = `Connecting to Groq (${selectedModel})...`;
      onThinkingUpdate?.([...steps]);

      const groq = new Groq({ apiKey: groqApiKey, dangerouslyAllowBrowser: true });
      
      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map(m => ({
            role: m.role === "user" ? "user" : "assistant" as any,
            content: m.content
          })),
          { role: "user", content: message }
        ],
        model: selectedModel,
        stream: true,
      });

      let fullText = "";
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || "";
        fullText += content;
        if (options.onStream) options.onStream(fullText);
      }

      steps[2].status = "done";
      steps[3].status = "done";
      onThinkingUpdate?.([...steps]);
      return fullText;

    } catch (error: any) {
      console.error("Groq Error:", error);
      steps[2].status = "error";
      steps[2].label = "Groq Connection Failed";
      onThinkingUpdate?.([...steps]);
      
      const isQuotaError = error.message?.includes("429") || error.message?.includes("rate_limit") || error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED");
      
      if (isQuotaError) {
        throw new Error("အစ်ကိုရှင့်၊ ညီမလေး Groq model ရဲ့ စွမ်းအင် (Quota) ပြည့်သွားလို့ ခဏလောက် အနားယူပေးပါရစေဦးနော်။ ✨💖 ခဏလောက်စောင့်ပြီးမှ ပြန်မေးပေးပါရှင်။ 🥰✨");
      }
      
      throw new Error(`Groq API ခေါ်ယူရာမှာ အဟန့်အတားလေးတစ်ခု ဖြစ်သွားပါတယ်ရှင်- ${error.message}`);
    }
  }

  if (isOpenRouterModel) {
    try {
      steps[0].status = "done";
      steps[2].status = "active";
      steps[2].label = `Connecting to OpenRouter (${selectedModel})...`;
      onThinkingUpdate?.([...steps]);

      const response = await fetch("/api/openrouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          apiKey: options.openrouterApiKey,
          messages: [
            { role: "system", content: systemPrompt },
            ...history.map(m => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content
            })),
            { role: "user", content: message }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to connect to OpenRouter");
      }

      const data = await response.json();
      const fullText = data.choices[0]?.message?.content || "";

      if (options.onStream) options.onStream(fullText);

      steps[2].status = "done";
      steps[3].status = "done";
      onThinkingUpdate?.([...steps]);
      return fullText;

    } catch (error: any) {
      console.error("OpenRouter Error:", error);
      steps[2].status = "error";
      steps[2].label = "OpenRouter Connection Failed";
      onThinkingUpdate?.([...steps]);
      throw new Error(`OpenRouter API ခေါ်ယူရာမှာ အဟန့်အတားလေးတစ်ခု ဖြစ်သွားပါတယ်ရှင်- ${error.message}`);
    }
  }

  const ai = new GoogleGenAI({ apiKey });

  // Sanitize model name for Google Gen AI (remove incorrect prefixes)
  const sanitizeModelName = (name: string) => {
    if (name.startsWith('models/google/')) return name.replace('models/google/', 'models/');
    if (name.startsWith('google/')) return 'models/' + name.replace('google/', '');
    if (!name.startsWith('models/') && !GROQ_MODELS.includes(name) && !OPENROUTER_MODELS.includes(name)) return 'models/' + name;
    return name;
  };

  // Use selected model if it's a Gemini model, otherwise start with preferred models
  const isGeminiModel = selectedModel && !isGroqModel && !isOpenRouterModel;
  const sanitizedSelectedModel = selectedModel ? sanitizeModelName(selectedModel) : null;
  
  const modelsToTry = isGeminiModel && sanitizedSelectedModel
    ? [sanitizedSelectedModel, ...PREFERRED_MODELS.filter(m => m !== sanitizedSelectedModel)]
    : PREFERRED_MODELS;

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

      const streamResponse = await ai.models.generateContentStream({
        model: modelToUse,
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: (mode === "arindama" && !hasVideo) ? [{ codeExecution: {} }] : undefined,
          thinkingConfig: modelToUse.includes("gemini-3") ? { thinkingLevel: ThinkingLevel.LOW } : undefined
        }
      });

      let fullText = "";
      steps[2].status = "done";
      steps[3].status = "active";
      steps[3].label = "Arindama is engineering...";
      onThinkingUpdate?.([...steps]);

      for await (const chunk of streamResponse) {
        const text = chunk.text;
        if (text) {
          fullText += text;
          if (options.onStream) options.onStream(fullText);
        }
      }

      if (fullText) {
        steps[2].status = "done";
        steps[2].label = `Finished with ${modelToUse.split('/').pop() || modelToUse}`;
        steps[3].status = "done";
        onThinkingUpdate?.([...steps]);
        return fullText;
      }
    } catch (error: any) {
      lastError = error;
      console.error(`Error with model ${modelToUse}:`, error);

      const errMsg = error.message || "";
      // If it's a 429, 404, or Busy error, try the next model
      if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("busy") || errMsg.includes("404") || errMsg.includes("NOT_FOUND")) {
        console.warn(`Model ${modelToUse} failed or busy, trying next available model...`);
        steps[2].label = `Model ${modelToUse.split('/').pop() || modelToUse} busy, switching...`;
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
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `You are an expert React and Tailwind CSS developer.
  The following code has an error. Please fix the error and return ONLY the corrected code without any markdown formatting or explanations.
  
  ERROR:
  ${error}
  
  CODE:
  ${code}
  
  FIXED CODE:`;

  for (const modelName of PREFERRED_MODELS) {
    try {
      const result = await ai.models.generateContent({ 
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });
      let fixedCode = result.text.trim();
      // Remove markdown code blocks if the model included them despite instructions
      if (fixedCode.startsWith('```')) {
        fixedCode = fixedCode.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
      }
      return fixedCode;
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("429") || msg.includes("404") || msg.includes("NOT_FOUND")) {
        console.warn(`fixCode failed with ${modelName}, trying next...`);
        continue;
      }
      console.error("Fix Code Error:", err);
      break;
    }
  }
  throw new Error("All healing models failed to fix the code.");
}

export async function validateApiKey(provider: "google" | "groq" | "openrouter" | "openai", key: string): Promise<boolean> {
  if (!key) return false;

  try {
    if (provider === "google") {
      const ai = new GoogleGenAI({ apiKey: key });
      for (const modelToTry of PREFERRED_MODELS) {
        try {
          const result = await ai.models.generateContent({ 
            model: modelToTry, 
            contents: [{ role: 'user', parts: [{ text: "test" }] }]
          });
          return !!result.text;
        } catch (inner: any) {
          if (inner.message?.includes("404") || inner.message?.includes("NOT_FOUND")) continue;
          throw inner;
        }
      }
      return false;
    } else if (provider === "groq") {
      const groq = new Groq({ apiKey: key, dangerouslyAllowBrowser: true });
      await groq.models.list();
      return true;
    } else if (provider === "openrouter") {
      const res = await fetch("/api/openrouter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "test" }],
          model: "google/gemini-flash-1.5-exp",
          max_tokens: 1,
          apiKey: key
        })
      });
      return res.ok;
    } else if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: {
          "Authorization": `Bearer ${key}`
        }
      });
      return res.ok;
    }
    return false;
  } catch (error) {
    console.error(`Validation error for ${provider}:`, error);
    return false;
  }
}

export async function summarizeConversation(apiKey: string, history: ChatMessage[]): Promise<string> {
  if (history.length === 0) return "ဖျက်ထားတဲ့ Chat ဖြစ်လို့ အကျဉ်းချုပ်စရာ မရှိပါဘူးရှင်။";

  const ai = new GoogleGenAI({ apiKey });
  
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
        const result = await ai.models.generateContent({ 
          model: modelToUse,
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        return result.text;
      } catch (innerError: any) {
        lastSumError = innerError;
        const errMsg = innerError.message || "";
        if (errMsg.includes("429") || errMsg.includes("404") || errMsg.includes("NOT_FOUND")) {
          continue;
        }
        throw innerError;
      }
    }
    throw lastSumError || new Error("All summarization models failed.");
  } catch (error) {
    console.error("Summarization Error:", error);
    throw new Error("Conversation ကို အကျဉ်းချုပ်လို့ မရနိုင်သေးပါဘူးရှင်။ ခေတ္တစောင့်ပြီး ပြန်လည်ကြိုးစားပေးပါရှင်။");
  }
}
