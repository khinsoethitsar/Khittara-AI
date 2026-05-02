import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
      const { model, contents, systemInstruction, userApiKey, vertexKey: clientVertexKey } = req.body;
      let apiKey = userApiKey || process.env.GEMINI_API_KEY;
      
      // Determine if we should use Vertex AI
      let isVertex = false;
      let vertexConfig: any = null;

      console.log(`[Server] Chat request received. Model: ${model}. Client Vertex Key present: ${!!clientVertexKey}. API Key present: ${!!apiKey}`);

      // 1. Check if clientVertexKey is provided (highest priority)
      if (clientVertexKey) {
        try {
          if (typeof clientVertexKey === 'string' && clientVertexKey.trim().startsWith('{')) {
            vertexConfig = JSON.parse(clientVertexKey);
          } else if (typeof clientVertexKey === 'object') {
            vertexConfig = clientVertexKey;
          }
          
          if (vertexConfig && (vertexConfig.project_id || vertexConfig.projectId)) {
            isVertex = true;
            console.log("[Server] Vertex AI Config detected from client parameters.");
          }
        } catch (e) {
          console.warn("[Server] Failed to parse clientVertexKey:", e);
        }
      }

      // 2. Secondary: Check if userApiKey itself is a Vertex JSON
      if (!isVertex && apiKey && typeof apiKey === 'string' && apiKey.trim().startsWith('{')) {
        try {
          vertexConfig = JSON.parse(apiKey);
          if (vertexConfig.project_id || vertexConfig.projectId) {
            isVertex = true;
            console.log("[Server] Vertex AI Config detected within API Key field.");
          }
        } catch (e) {
          isVertex = false;
        }
      }

      // Priority logic: If Vertex is available, use it (as Gemini credits are depleted)
      if (isVertex) {
        apiKey = null; 
      }

      if (!isVertex && !apiKey) {
        return res.status(401).json({ error: "Missing API Key or Vertex AI Credentials." });
      }

      // Standardize model name
      let modelName = model || "gemini-2.0-flash";
      const cleanModelName = modelName.replace(/^models\//, "");

      if (isVertex) {
        console.log(`[Vertex AI Proxy] Generating content with model: ${cleanModelName}`);
        
        const projectId = vertexConfig.project_id;
        const location = vertexConfig.location_id || "us-central1"; 
        
        // Map to Vertex-specific stable model IDs
        let vertexModel = "gemini-1.5-flash-002";
        if (cleanModelName.includes("2.0")) {
          vertexModel = "gemini-2.0-flash-001";
        } else if (cleanModelName.includes("pro")) {
          vertexModel = "gemini-1.5-pro-002";
        }
        
        console.log(`[Vertex AI Proxy] Mapping ${cleanModelName} -> ${vertexModel}`);
        
        const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${vertexModel}`;

        const client = new PredictionServiceClient({
          credentials: {
            client_email: vertexConfig.client_email,
            private_key: vertexConfig.private_key,
          },
          projectId,
          apiEndpoint: `${location}-aiplatform.googleapis.com`,
        });

        // Vertex AI Gemini REST structure mapping
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

      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Map to latest stable known-working names for AI Studio (Standard Aliases)
      let sdkModelName = cleanModelName;
      // Use original cleaner aliases for AI Studio v1beta to avoid 404s
      if (sdkModelName.includes("2.0-flash-lite")) sdkModelName = "gemini-2.0-flash-lite-preview-02-05";
      else if (sdkModelName.includes("2.0-flash")) sdkModelName = "gemini-2.0-flash";
      else if (sdkModelName.includes("1.5-flash")) sdkModelName = "gemini-1.5-flash";
      else if (sdkModelName.includes("1.5-pro")) sdkModelName = "gemini-1.5-pro";

      console.log(`[Gemini Proxy] Using SDK Model Name: ${sdkModelName}`);

      const modelInstance = genAI.getGenerativeModel({ 
        model: sdkModelName, 
        systemInstruction: systemInstruction || undefined
      });
      
      const result = await modelInstance.generateContent({
        contents
      });

      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new Error("Empty response from Gemini API");
      }

      res.json({ text });
    } catch (error: any) {
      const errMsg = error.message || String(error);
      const status = error.status || (error.response?.status) || 500;
      
      // Detailed error logging for debugging (filtered)
      let logMsg = errMsg;
      const secrets = [process.env.GEMINI_API_KEY, process.env.OPENROUTER_API_KEY, process.env.RAPIDAPI_KEY].filter(Boolean);
      secrets.forEach(s => {
        if (s) logMsg = logMsg.replace(new RegExp(s, 'g'), "[HIDDEN]");
      });
      
      console.error(`[Chat API Error] Status: ${status}, Message: ${logMsg}`);

      // Handle specific error codes with user-friendly messages
      if (status === 404 || errMsg.includes("NOT_FOUND")) {
        return res.status(404).json({ 
          error: "Model not found or API version mismatch. Please check your model configuration.",
          code: "MODEL_NOT_FOUND",
          details: logMsg 
        });
      }

      if (status === 429 || errMsg.includes("RESOURCE_EXHAUSTED")) {
        return res.status(429).json({ 
          error: "RESOURCE_EXHAUSTED",
          code: "QUOTA_EXCEEDED",
          details: "Your prepayment credits are depleted or rate limit reached. Please check AI Studio billing or use Vertex AI." 
        });
      }

      if (status === 401 || status === 403 || status === 400 && errMsg.includes("API_KEY_INVALID") || errMsg.includes("expired")) {
        return res.status(401).json({
          error: "Authentication Failed",
          code: "AUTH_ERROR",
          details: "The provided API key is invalid, expired, or lacks required permissions. Please renew your API key in Settings."
        });
      }

      if (status >= 500) {
        return res.status(status).json({
          error: "Gemini Service Error",
          code: "SERVER_ERROR",
          details: "The Google AI service is currently overloaded or experiencing issues. Please try again in secondary mode."
        });
      }

      res.status(status).json({ error: "Gemini Proxy Failure", details: logMsg });
    }
  });

  // Streaming Gemini Proxy
  app.post("/api/chat-stream", async (req, res) => {
    try {
      const { model: modelName, contents, systemInstruction, userApiKey, vertexKey: clientVertexKey } = req.body;
      let apiKey = userApiKey || process.env.GEMINI_API_KEY;
      
      let isVertex = false;
      let vertexConfig: any = null;

      console.log(`[Stream Server] Chat request. Model: ${modelName}. Client Vertex: ${!!clientVertexKey}. API Key: ${!!apiKey}`);

      // 1. Check if clientVertexKey is provided (highest priority)
      if (clientVertexKey) {
        try {
          vertexConfig = typeof clientVertexKey === 'string' && clientVertexKey.trim().startsWith('{') 
            ? JSON.parse(clientVertexKey) : clientVertexKey;
          
          if (vertexConfig && (vertexConfig.project_id || vertexConfig.projectId)) {
            isVertex = true;
          }
        } catch (e) {
          console.warn("[Stream Server] Invalid clientVertexKey format");
        }
      }

      // 2. Secondary: Check if userApiKey is a Vertex JSON
      if (!isVertex && apiKey && typeof apiKey === 'string' && apiKey.trim().startsWith('{')) {
        try {
          vertexConfig = JSON.parse(apiKey);
          if (vertexConfig.project_id || vertexConfig.projectId) {
            isVertex = true;
          }
        } catch (e) {
          isVertex = false;
        }
      }

      const cleanModelName = modelName.replace(/^models\//, "");

      if (isVertex) {
        console.log(`[Vertex AI Stream] Mode active. Model: ${cleanModelName}`);
        apiKey = null; // Ensure we don't try Gemini fallback inside the loop if Vertex is requested

        const projectId = vertexConfig.project_id || vertexConfig.projectId;
        const location = vertexConfig.location_id || "us-central1"; 
        
        let vertexModel = "gemini-1.5-flash-002";
        if (cleanModelName.includes("2.0")) {
          vertexModel = "gemini-2.0-flash-001";
        } else if (cleanModelName.includes("pro")) {
          vertexModel = "gemini-1.5-pro-002";
        }
        
        const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${vertexModel}`;

        const client = new PredictionServiceClient({
          credentials: {
            client_email: vertexConfig.client_email,
            private_key: vertexConfig.private_key,
          },
          projectId,
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const request = {
          endpoint,
          contents: contents.map((c: any) => ({
            role: c.role === "model" ? "model" : "user",
            parts: c.parts.map((p: any) => ({ text: p.text }))
          })),
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
        };

        const stream = client.serverStreamingPredict(request);
        
        stream.on('data', (response) => {
          const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        });

        stream.on('end', () => {
          res.write('data: [DONE]\n\n');
          res.end();
        });

        stream.on('error', (err) => {
          console.error("[Vertex Stream Error]:", err);
          res.write(`data: ${JSON.stringify({ error: err.message || "Vertex Streaming failed" })}\n\n`);
          res.end();
        });

        return;
      }

      // Gemini AI Studio Path
      if (!apiKey) {
        return res.status(401).json({ error: "Missing API Key" });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Use standard aliases to avoid version-specific 404s in AI Studio
      let sdkModelName = "gemini-1.5-flash"; 
      if (cleanModelName.includes("2.0-flash-lite")) sdkModelName = "gemini-2.0-flash-lite-preview-02-05";
      else if (cleanModelName.includes("2.0-flash")) sdkModelName = "gemini-2.0-flash";
      else if (cleanModelName.includes("1.5-pro")) sdkModelName = "gemini-1.5-pro";
      else if (cleanModelName.includes("1.5-flash")) sdkModelName = "gemini-1.5-flash";

      console.log(`[Gemini Stream] Using SDK Model Name: ${sdkModelName}`);

      const modelInstance = genAI.getGenerativeModel({ 
        model: sdkModelName, 
        systemInstruction: systemInstruction || undefined
      });

      const result = await modelInstance.generateContentStream({
        contents
      });

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("[Stream API Error]:", error.message);
      res.write(`data: ${JSON.stringify({ error: error.message || "Streaming failed" })}\n\n`);
      res.end();
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

      const client = new GoogleGenerativeAI(apiKey);
      const modelName = "imagen-3.0-generate-001"; // Priority synthesis model

      const modelInstance = client.getGenerativeModel({
        model: modelName
      });

      const result = await modelInstance.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      });

      const candidate = result.response.candidates?.[0];
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
        const client = new GoogleGenerativeAI(apiKey);
        // Use 1.5 Flash as it's the most common/accessible for validation
        const modelInstance = client.getGenerativeModel({
          model: "gemini-1.5-flash"
        });
        const result = await modelInstance.generateContent("hi");
        return res.json({ valid: !!result.response.text() });
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
