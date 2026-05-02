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

  const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash"];

  for (const modelToUse of modelsToTry) {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelToUse,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          userApiKey: apiKey,
          systemInstruction: "You are a JSON-only memory extraction engine. Return ONLY valid JSON."
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const data = await response.json();
      if (!data.text) continue;
      
      // Attempt to find and parse JSON in case model added markdown wrapping
      let jsonStr = data.text.trim();
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/^```json\n/, "").replace(/\n```$/, "");
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```\n/, "").replace(/\n```$/, "");
      }
      
      return JSON.parse(jsonStr) as UserMemory;
    } catch (error: any) {
      console.warn(`Memory Extraction Attempt with ${modelToUse} failed:`, error.message);
      if (modelsToTry.indexOf(modelToUse) < modelsToTry.length - 1) continue;
      break;
    }
  }
  return null;
}
