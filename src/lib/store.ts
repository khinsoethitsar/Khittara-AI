
import { ChatMessage } from "./gemini-types";

export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  dueDate?: string; // ISO 8601
  createdAt: string;
  updatedAt: string;
}

const PROMPTS_KEY = "kalaung_prompts";
const API_KEY_KEY = "kalaung_gemini_key";
const OPENROUTER_API_KEY_KEY = "kalaung_openrouter_key";
const GROQ_API_KEY_KEY = "kalaung_groq_key";
const LANG_KEY = "kalaung_lang";
const KB_KEY = "kalaung_knowledge_base";
const MODE_KEY = "kalaung_ai_mode";
const OPENAI_API_KEY_KEY = "kalaung_openai_key";
const EVOLUTION_KEY = "kalaung_evolution_directives";
const GITHUB_TOKEN_KEY = "kalaung_github_token";
const CHAT_HISTORY_KEY = "kalaung_chat_history";
const MODEL_KEY = "kalaung_model";
const REPO_INFO_KEY = "kalaung_repo_info";
const FONT_SIZE_KEY = "kalaung_font_size";
const UI_DENSITY_KEY = "kalaung_ui_density";
const TASKS_KEY = "kalaung_tasks";
const MEMORY_KEY = "kalaung_deep_memory";
const PLAYGROUND_CODE_KEY = "kalaung_playground_code";
const STAGED_ACTIONS_KEY = "kalaung_staged_actions";
const BACKGROUND_IMAGE_KEY = "kalaung_background_image";
const ACTIVE_SESSION_ID_KEY = "kalaung_active_session_id";
const PREVIEW_ERROR_KEY = "kalaung_preview_error";

export interface UserMemory {
  user_profile: {
    name: string;
    interests: string[];
    preferences: string[];
  };
  current_context: {
    active_project: string;
    recent_topics: string[];
    unresolved_issues: string[];
  };
  last_interaction_mood: string;
}

const isStorageAvailable = () => {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
};

export function getChatHistory(): ChatSession[] {
  if (!isStorageAvailable()) return [];
  try {
    const stored = localStorage.getItem(CHAT_HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  } catch {
    return [];
  }
}

export function saveChatSession(session: ChatSession) {
  if (!isStorageAvailable()) return;
  try {
    const history = getChatHistory();
    
    // Prune logic: LocalStorage limit is usually 5MB. 
    // We should be aggressive about removing large base64 data from history.
    
    // 1. Prune the current session's messages if they are too large
    session.messages.forEach(m => {
      if (m.files) {
        m.files.forEach(f => {
          if (f.data && f.data.length > 200 * 1024) { // 200KB limit for LocalStorage
            f.data = "";
          }
        });
      }
    });

    const index = history.findIndex(s => s.id === session.id);
    if (index !== -1) {
      history[index] = session;
    } else {
      history.unshift(session);
    }

    // 2. Aggressive pruning of all sessions
    let historyJson = JSON.stringify(history);
    
    if (historyJson.length > 3 * 1024 * 1024) {
      // If history > 3MB, strip ALL file data from ALL sessions
      history.forEach(s => {
        s.messages.forEach(m => {
          if (m.files) {
            m.files.forEach(f => {
              f.data = "";
            });
          }
        });
      });
    }

    // 3. Final safety check: if still too large, remove oldest sessions
    while (JSON.stringify(history).length > 4 * 1024 * 1024 && history.length > 1) {
      history.pop();
    }

    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
  } catch (e) { 
    console.error("Failed to save chat history:", e);
    // If it fails even after pruning, try clearing oldest history entirely
    try {
      const history = getChatHistory();
      if (history.length > 1) {
        // Remove half of the history if we hit a hard quota limit
        const half = Math.floor(history.length / 2);
        const pruned = history.slice(0, half);
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(pruned));
      } else {
        // If even one session is too big, we have to clear it
        localStorage.removeItem(CHAT_HISTORY_KEY);
      }
    } catch (innerE) {
      console.error("Critical storage failure:", innerE);
    }
  }
}

export function deleteChatSession(id: string) {
  if (!isStorageAvailable()) return;
  try {
    const history = getChatHistory();
    const filtered = history.filter(s => s.id !== id);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(filtered));
  } catch (e) { console.error(e); }
}

export function getSavedPrompts(): SavedPrompt[] {
  if (!isStorageAvailable()) return [];
  try {
    const stored = localStorage.getItem(PROMPTS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  } catch {
    return [];
  }
}

export function savePrompt(prompt: SavedPrompt) {
  if (!isStorageAvailable()) return;
  try {
    const prompts = getSavedPrompts();
    prompts.unshift(prompt);
    localStorage.setItem(PROMPTS_KEY, JSON.stringify(prompts));
  } catch (e) { console.error(e); }
}

export function getApiKey(): string {
  if (!isStorageAvailable()) return "";
  try {
    const savedKey = localStorage.getItem(API_KEY_KEY);
    if (savedKey) return savedKey;

    // Fallback to Vite env
    const viteKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (viteKey && viteKey !== "MY_GEMINI_API_KEY") return viteKey;

    // Fallback to process.env
    // @ts-ignore
    const procKey = typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined;
    if (procKey && procKey !== "MY_GEMINI_API_KEY") return procKey;

    return "";
  } catch {
    return "";
  }
}

export function setApiKey(key: string) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(API_KEY_KEY, key);
  } catch (e) { console.error(e); }
}

export function getGroqApiKey(): string {
  if (!isStorageAvailable()) return "";
  try {
    const savedKey = localStorage.getItem(GROQ_API_KEY_KEY);
    if (savedKey) return savedKey;

    const viteKey = import.meta.env.VITE_GROQ_API_KEY;
    if (viteKey && viteKey !== "MY_GROQ_API_KEY") return viteKey;

    return "";
  } catch {
    return "";
  }
}

export function setGroqApiKey(key: string) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(GROQ_API_KEY_KEY, key);
  } catch (e) { console.error(e); }
}

export function getOpenRouterApiKey(): string {
  if (!isStorageAvailable()) return "";
  try {
    const savedKey = localStorage.getItem(OPENROUTER_API_KEY_KEY);
    if (savedKey) return savedKey;
    return "";
  } catch {
    return "";
  }
}

export function setOpenRouterApiKey(key: string) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(OPENROUTER_API_KEY_KEY, key);
  } catch (e) { console.error(e); }
}

export function getOpenAiApiKey(): string {
  if (!isStorageAvailable()) return "";
  try {
    return localStorage.getItem(OPENAI_API_KEY_KEY) || "";
  } catch {
    return "";
  }
}

export function setOpenAiApiKey(key: string) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(OPENAI_API_KEY_KEY, key);
  } catch (e) { console.error(e); }
}

export function getAiMode(): "kalaung" | "arindama" | "twatgyi" {
  if (!isStorageAvailable()) return "kalaung";
  try {
    return (localStorage.getItem(MODE_KEY) as "kalaung" | "arindama" | "twatgyi") || "kalaung";
  } catch {
    return "kalaung";
  }
}

export function setAiMode(mode: "kalaung" | "arindama" | "twatgyi") {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch (e) { console.error(e); }
}

export function getKnowledgeBase(): string {
  if (!isStorageAvailable()) return "";
  try {
    return localStorage.getItem(KB_KEY) || "";
  } catch {
    return "";
  }
}

export function setKnowledgeBase(kb: string) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(KB_KEY, kb);
  } catch (e) { console.error(e); }
}

export function addToKnowledgeBase(fact: string) {
  if (!isStorageAvailable()) return;
  try {
    const current = getKnowledgeBase();
    const updated = current.trim() ? `${current}\n- ${fact}` : `- ${fact}`;
    setKnowledgeBase(updated);
  } catch (e) { console.error(e); }
}

export function getEvolutionDirectives(): string {
  if (!isStorageAvailable()) return "";
  try {
    return localStorage.getItem(EVOLUTION_KEY) || "";
  } catch {
    return "";
  }
}

export function setEvolutionDirectives(directives: string) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(EVOLUTION_KEY, directives);
  } catch (e) { console.error(e); }
}

export function getGithubToken(): string {
  if (!isStorageAvailable()) return "";
  try {
    return localStorage.getItem(GITHUB_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setGithubToken(token: string) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(GITHUB_TOKEN_KEY, token);
  } catch (e) { console.error(e); }
}

export function getModel(): string {
  if (!isStorageAvailable()) return "models/gemini-2.0-flash";
  try {
    let model = localStorage.getItem(MODEL_KEY);
    if (!model) return "models/gemini-2.0-flash";
    
    // Sanitize: Remove incorrect prefixes often found in OpenRouter or auto-completions
    if (model.startsWith('models/google/')) model = model.replace('models/google/', 'models/');
    if (model.startsWith('google/')) model = 'models/' + model.replace('google/', '');

    // Check if it's a Groq model (llama, mixtral, gemma2)
    const isGroq = model.includes("llama") || model.includes("mixtral") || model.includes("gemma2");
    
    if (!isGroq && !model.startsWith("models/")) {
      return `models/${model}`;
    }
    return model;
  } catch {
    return "models/gemini-2.0-flash";
  }
}

export function setModel(model: string) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(MODEL_KEY, model);
  } catch (e) { console.error(e); }
}

export function getSavedRepoInfo(): { owner: string; repo: string } {
  if (!isStorageAvailable()) return { owner: "", repo: "" };
  try {
    const stored = localStorage.getItem(REPO_INFO_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return { owner: "", repo: "" };
  } catch {
    return { owner: "", repo: "" };
  }
}

export function saveRepoInfo(info: { owner: string; repo: string }) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(REPO_INFO_KEY, JSON.stringify(info));
  } catch (e) { console.error(e); }
}

export function getFontSize(): number {
  if (!isStorageAvailable()) return 16;
  try {
    const size = localStorage.getItem(FONT_SIZE_KEY);
    return size ? parseInt(size, 10) : 16;
  } catch {
    return 16;
  }
}

export function setFontSize(size: number) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(FONT_SIZE_KEY, size.toString());
  } catch (e) { console.error(e); }
}

export function getUiDensity(): number {
  if (!isStorageAvailable()) return 16;
  try {
    const density = localStorage.getItem(UI_DENSITY_KEY);
    return density ? parseInt(density, 10) : 16;
  } catch {
    return 16;
  }
}

export function setUiDensity(density: number) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(UI_DENSITY_KEY, density.toString());
  } catch (e) { console.error(e); }
}

export function getTasks(): Task[] {
  if (!isStorageAvailable()) return [];
  try {
    const stored = localStorage.getItem(TASKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch (e) {
    console.error("Error saving tasks to localStorage:", e);
  }
}

export function getDeepMemory(): UserMemory | null {
  if (!isStorageAvailable()) return null;
  try {
    const stored = localStorage.getItem(MEMORY_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function setDeepMemory(memory: UserMemory) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch (e) {
    console.error("Error saving memory to localStorage:", e);
  }
}

export function getPlaygroundCode(): string | null {
  if (!isStorageAvailable()) return null;
  try {
    return localStorage.getItem(PLAYGROUND_CODE_KEY);
  } catch {
    return null;
  }
}

export function setPlaygroundCode(code: string) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(PLAYGROUND_CODE_KEY, code);
    // Dispatch custom event for real-time reactivity in the same tab
    window.dispatchEvent(new CustomEvent('playground-update', { 
      detail: { code } 
    }));
  } catch (e) {
    console.error("Error saving playground code:", e);
  }
}

export function getBackgroundImage(): string | null {
  if (!isStorageAvailable()) return null;
  try {
    return localStorage.getItem(BACKGROUND_IMAGE_KEY);
  } catch {
    return null;
  }
}

export function setBackgroundImage(url: string | null) {
  if (!isStorageAvailable()) return;
  try {
    if (url) {
      localStorage.setItem(BACKGROUND_IMAGE_KEY, url);
    } else {
      localStorage.removeItem(BACKGROUND_IMAGE_KEY);
    }
  } catch (e) {
    console.error("Error saving background image:", e);
  }
}

export function getActiveSessionId(): string | null {
  if (!isStorageAvailable()) return null;
  try {
    return localStorage.getItem(ACTIVE_SESSION_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveSessionId(id: string | null) {
  if (!isStorageAvailable()) return;
  try {
    if (id) {
      localStorage.setItem(ACTIVE_SESSION_ID_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_SESSION_ID_KEY);
    }
  } catch (e) {
    console.error("Error saving active session id:", e);
  }
}

export function getStagedActions(): any[] {
  if (!isStorageAvailable()) return [];
  try {
    const stored = localStorage.getItem(STAGED_ACTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function setStagedActionsStore(actions: any[]) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(STAGED_ACTIONS_KEY, JSON.stringify(actions));
    window.dispatchEvent(new CustomEvent('staged-actions-update', { 
      detail: { actions } 
    }));
  } catch (e) {
    console.error("Error saving staged actions:", e);
  }
}

export function getPreviewError(): string | null {
  if (!isStorageAvailable()) return null;
  try {
    return localStorage.getItem(PREVIEW_ERROR_KEY);
  } catch {
    return null;
  }
}

export function setPreviewError(error: string | null) {
  if (!isStorageAvailable()) return;
  try {
    if (error) {
      localStorage.setItem(PREVIEW_ERROR_KEY, error);
    } else {
      localStorage.removeItem(PREVIEW_ERROR_KEY);
    }
    window.dispatchEvent(new CustomEvent('preview-error-update', { 
      detail: { error } 
    }));
  } catch (e) {
    console.error("Error saving preview error:", e);
  }
}
