import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { GoogleGenAI } from "@google/genai";
import { PredictionServiceClient, helpers } from "@google-cloud/aiplatform";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Proxy route for OpenRouter
  app.post("/api/openrouter", async (req, res) => {
    try {
      const { model, messages, stream, apiKey: clientApiKey } = req.body;
      const apiKey = clientApiKey || process.env.OPENROUTER_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "OpenRouter API Key not configured" });
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://khittara.ai",
          "X-Title": "Khittara AI",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model || "google/gemini-2.0-flash-001",
          messages,
          stream
        })
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("OpenRouter Proxy Error:", error);
      res.status(500).json({ error: "Failed to communicate with OpenRouter" });
    }
  });

  // Proxy route for 2D Live Data
  app.get("/api/2d/live", async (req, res) => {
    const now = new Date();
    
    // 1. Try RapidAPI first (as requested by user)
    try {
      const apiKey = process.env.RAPIDAPI_KEY || "d38e47c7c6msh30b60297a36e1d8p1d2272jsnaf54b5a0094e";
      const host = process.env.RAPIDAPI_HOST || "thai-lotto-new-api.p.rapidapi.com";
      
      console.log(`Attempting RapidAPI: ${host}`);
      const response = await fetch(`https://${host}/api/v1/live`, {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": apiKey.trim(),
          "X-RapidAPI-Host": host.trim(),
          "Accept": "application/json",
          "User-Agent": "Khittara-AI/1.0"
        },
        timeout: 10000 // Increased to 10s
      });

      if (response.ok) {
        const data = await response.json();
        return res.json({ provider: "rapidapi", ...data });
      }
      console.warn(`RapidAPI status: ${response.status}`);
    } catch (error) {
      console.warn("RapidAPI error or timeout:", error instanceof Error ? error.message : String(error));
    }

    // 2. Fallback to free API if RapidAPI fails or times out
    try {
      console.log("Attempting fallback to thaistock2d (Free)...");
      const freeResponse = await fetch("https://api.thaistock2d.com/live", {
        headers: { 
          "User-Agent": "Khittara-AI/1.0",
          "Accept": "application/json"
        },
        timeout: 8000 // Increased fallback timeout
      });
      
      if (freeResponse.ok) {
        const data = await freeResponse.json();
        return res.json({ provider: "thaistock2d", ...data });
      }
    } catch (freeError) {
      console.warn("Thaistock2d fallback failed:", freeError instanceof Error ? freeError.message : String(freeError));
    }

    // 3. Final Fallback: Return simulated/offline data
    console.log("All API sources failed. Providing offline fallback data.");
    return res.json({
      provider: "fallback_logic",
      server_time: now.toISOString(),
      live: {
        set: "...",
        value: "...",
        time: formatTime(now),
        twod: "--",
        date: now.toISOString().split('T')[0]
      },
      result: []
    });
  });

  function formatTime(date: Date) {
    return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  }

  // Proxy route for 2D History Data
  app.get("/api/2d/history", async (req, res) => {
    try {
      const { date } = req.query;
      let url = "https://api.thaistock2d.com/history";
      if (date) {
        url = `https://api.thaistock2d.com/history?date=${date}`;
      }

      console.log(`Fetching 2D History Data from: ${url}`);
      const resp = await fetch(url, {
        headers: { 
          "User-Agent": "Khittara-AI/1.0",
          "Accept": "application/json"
        },
        timeout: 10000
      });
      
      const contentType = resp.headers.get("content-type");
      if (resp.ok && contentType && contentType.includes("application/json")) {
        const data = await resp.json();
        return res.json(data);
      }
      
      const content = await resp.text();
      console.warn(`History API Error (${resp.status}):`, content.substring(0, 100));
      res.status(resp.status || 500).json({ error: "History data not found" });
    } catch (error) {
      console.error("2D History Proxy Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Secure Gemini Proxy
  app.post("/api/chat", async (req, res) => {
    try {
      const { model, contents, systemInstruction, userApiKey } = req.body;
      const apiKey = userApiKey || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(401).json({ error: "Gemini API Key is required. Please provide it in settings or environment." });
      }

      // Check if apiKey is a JSON string (Vertex AI Service Account)
      let isVertex = false;
      let vertexKey: any = null;
      try {
        if (apiKey.trim().startsWith('{')) {
          vertexKey = JSON.parse(apiKey);
          if (vertexKey.project_id && vertexKey.private_key) {
            isVertex = true;
          }
        }
      } catch (e) {
        isVertex = false;
      }

      // Standardize model name
      let modelName = model || "gemini-3-flash-preview";
      const cleanModelName = modelName.replace(/^models\//, "");

      if (isVertex) {
        console.log(`[Vertex AI Proxy] Generating content with model: ${cleanModelName}`);
        
        const projectId = vertexKey.project_id;
        const location = vertexKey.location_id || "us-central1"; 
        // Vertex AI Model path: projects/{project}/locations/{location}/publishers/google/models/{model}
        // Use gemini-1.5-flash or gemini-2.0-flash
        const vertexModel = cleanModelName.includes("2.0") ? "gemini-2.0-flash-001" : "gemini-1.5-flash";
        
        const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${vertexModel}`;

        const client = new PredictionServiceClient({
          credentials: {
            client_email: vertexKey.client_email,
            private_key: vertexKey.private_key,
          },
          projectId,
          apiEndpoint: `${location}-aiplatform.googleapis.com`,
        });

        // Map contents to Vertex AI Predict format
        // Vertex AI Gemini REST API expects a slightly different structure than the client SDKs if using raw predict
        // But the PredictionServiceClient can be used or we can use the dedicated Vertex AI SDK.
        // For simplicity and correctness with @google-cloud/aiplatform, we use the REST-style prediction
        
        const instances = [
          helpers.toValue({
            contents,
            system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            generation_config: {
              max_output_tokens: 8192,
              temperature: 0.7,
              top_p: 0.95,
            }
          })
        ];

        const [response] = await client.predict({
          endpoint,
          instances,
        });

        const prediction = helpers.fromValue(response.predictions![0] as any) as any;
        const text = prediction?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
          throw new Error("Empty response from Vertex AI");
        }

        return res.json({ text });
      }

      // Google AI Studio Logic (Default)
      console.log(`[Gemini Proxy] Generating content with model: ${cleanModelName}`);

      const client = new GoogleGenAI({ 
        apiKey
      });
      
      const result = await client.models.generateContent({
        model: `models/${cleanModelName}`,
        contents,
        config: {
          systemInstruction,
        }
      });

      if (!result || !result.text) {
        throw new Error("Empty response from Gemini API");
      }

      res.json({ text: result.text });
    } catch (error: any) {
      const errMsg = error.message || String(error);
      
      // Detailed error logging for debugging (filtered)
      let logMsg = errMsg;
      const secrets = [process.env.GEMINI_API_KEY, process.env.OPENROUTER_API_KEY, process.env.RAPIDAPI_KEY].filter(Boolean);
      secrets.forEach(s => {
        if (s) logMsg = logMsg.replace(new RegExp(s, 'g'), "[HIDDEN]");
      });
      
      console.error("Gemini Proxy Error:", logMsg);

      // Handle specific error codes
      if (errMsg.includes("NOT_FOUND") || errMsg.includes("404")) {
        return res.status(404).json({ 
          error: "Model not found or API version mismatch. Please check your model configuration.",
          details: logMsg 
        });
      }

      res.status(error.status || 500).json({ error: "Gemini Service Error", details: logMsg });
    }
  });

  // Secure Image Synthesis Proxy
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { prompt, aspectRatio, userApiKey } = req.body;
      const apiKey = userApiKey || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(401).json({ error: "API Key required for synthesis." });
      }

      const client = new GoogleGenAI({ apiKey });
      const modelName = "imagen-3.0-generate-001"; // Priority synthesis model

      const result = await client.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          imageConfig: {
            aspectRatio: aspectRatio || "1:1"
          }
        }
      });

      const candidate = result.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            return res.json({ 
              imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
              provider: "imagen"
            });
          }
        }
      }

      // If Imagen fails or is restricted, use the Neural Fallback logic on server
      throw new Error("Imagen synthesis restricted or failed.");
    } catch (error: any) {
      console.warn("Imagen synthesis failed, using Neural Fallback...");
      // Log generic error but not the full trace to avoid leaks
      res.status(200).json({ fallback: true });
    }
  });

  // Secure API Key Validation Proxy
  app.post("/api/validate-key", async (req, res) => {
    try {
      const { apiKey, provider } = req.body;
      if (!apiKey) return res.status(400).json({ error: "Key required" });

      // Check for Vertex AI JSON
      if (apiKey.trim().startsWith('{')) {
        try {
          const vertexKey = JSON.parse(apiKey);
          if (vertexKey.project_id && vertexKey.private_key) {
            return res.json({ valid: true, type: 'vertex' });
          }
        } catch (e) {
          // Fall through
        }
      }

      if (provider === "google") {
        const client = new GoogleGenAI({ apiKey });
        // Use 1.5 Flash as it's the most common/accessible for validation
        const result = await client.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [{ role: 'user', parts: [{ text: "hi" }] }]
        });
        return res.json({ valid: !!result.text });
      }
      
      // Fallback for other providers if needed
      res.json({ valid: true }); // Assume true for unidentified but present keys
    } catch (error) {
      res.status(401).json({ valid: false, error: "Invalid API Key" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log('Production mode: serving from', distPath);
    if (!fs.existsSync(distPath)) {
      console.error('CRITICAL: dist directory NOT found!');
    }
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
