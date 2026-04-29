import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../lib/gemini-types";
import { getApiKey } from "../lib/store";

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

const MEMORY_EXTRACTION_PROMPT = `
Act as a Memory Extraction Engine for a digital assistant named "Ka-Laung". 

Your task is to analyze the conversation history between the user (အစ်ကို/အစ်မ) and the AI (Ka-Laung). Extract key facts, user preferences, ongoing projects, and personal details that are worth remembering for future sessions.

### EXTRACTION RULES:
1. Extract "Permanent Facts" (e.g., User's name, job, core interests).
2. Extract "Active Context" (e.g., Current coding project, a specific problem they are solving right now).
3. Extract "Sentiment & Tone" (e.g., Is the user feeling frustrated? Are they happy today?).
4. DO NOT include temporary greetings or irrelevant small talk.
5. Identify any updates to previous facts (e.g., if the user changed their tech stack from React to Next.js).

### OUTPUT FORMAT:
You must return only a valid JSON object in the following structure:
{
  "user_profile": {
    "name": "string",
    "interests": ["string"],
    "preferences": ["string"]
  },
  "current_context": {
    "active_project": "string",
    "recent_topics": ["string"],
    "unresolved_issues": ["string"]
  },
  "last_interaction_mood": "string"
}
`;

export async function extractMemory(history: ChatMessage[], existingMemory?: UserMemory): Promise<UserMemory | null> {
  const apiKey = getApiKey();
  if (!apiKey || history.length < 2) return null;

  const ai = new GoogleGenAI({ apiKey });
  
  const conversationText = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  const existingMemoryText = existingMemory ? JSON.stringify(existingMemory, null, 2) : "No existing memory.";

  const prompt = `
${MEMORY_EXTRACTION_PROMPT}

### INPUT DATA:
- Current Conversation History:
${conversationText}

- Existing Memory (if any):
${existingMemoryText}
`;

  const modelsToTry = ["gemini-2.0-flash", "gemini-3-flash-preview", "gemini-flash-latest", "gemini-1.5-flash-latest"];

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({ 
        model: modelName,
        contents: prompt,
        config: { 
          responseMimeType: "application/json"
        }
      });
      
      const responseText = response.text;
      if (!responseText) continue;
      return JSON.parse(responseText) as UserMemory;
    } catch (error: any) {
      const errorMsg = error.message || "";
      const isQuotaError = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("busy");
      const isNotFoundError = errorMsg.includes("404") || errorMsg.includes("not found") || errorMsg.includes("NOT_FOUND");
      
      if ((isQuotaError || isNotFoundError) && modelsToTry.indexOf(modelName) < modelsToTry.length - 1) {
        console.warn(`Memory extraction failed with ${modelName} (${isNotFoundError ? '404' : '429'}), trying next...`);
        continue;
      }
      console.error(`Memory Extraction Error with ${modelName}:`, error);
      break;
    }
  }
  return null;
}
