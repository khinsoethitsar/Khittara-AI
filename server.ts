import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

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
      
      const errorText = await resp.text();
      console.warn(`History API Error (${resp.status}):`, errorText.substring(0, 100));
      res.status(resp.status || 500).json({ error: "History data not found", raw: errorText.substring(0, 100) });
    } catch (error) {
      console.error("2D History Proxy Error:", error);
      res.status(500).json({ error: "Internal Server Error", message: error instanceof Error ? error.message : String(error) });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
