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
  
  // *** အရေးကြီးဆုံး ပြင်ဆင်မှု ***
  // Firebase App Hosting ကပေးတဲ့ PORT ကို ယူသုံးဖို့ဖြစ်ပါတယ်။ မရှိရင် 8080 ကို default ထားပါမယ်။
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
    
    try {
      const apiKey = process.env.RAPIDAPI_KEY || "d38e47c7c6msh30b60297a36e1d8p1d2272jsnaf54b5a0094e";
      const host = process.env.RAPIDAPI_HOST || "thai-lotto-new-api.p.rapidapi.com";
      
      const response = await fetch(`https://${host}/api/v1/live`, {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": apiKey.trim(),
          "X-RapidAPI-Host": host.trim(),
          "Accept": "application/json",
          "User-Agent": "Khittara-AI/1.0"
        },
        timeout: 10000 
      });

      if (response.ok) {
        const data = await response.json();
        return res.json({ provider: "rapidapi", ...data });
      }
    } catch (error) {
      console.warn("RapidAPI error:", error);
    }

    // Fallback logic
    return res.json({
      provider: "fallback_logic",
      server_time: now.toISOString(),
      live: { set: "...", value: "...", time: "...", twod: "--", date: now.toISOString().split('T')[0] },
      result: []
    });
  });

  // Proxy route for 2D History Data
  app.get("/api/2d/history", async (req, res) => {
    try {
      const { date } = req.query;
      let url = `https://api.thaistock2d.com/history${date ? `?date=${date}` : ""}`;

      const resp = await fetch(url, {
        headers: { "User-Agent": "Khittara-AI/1.0", "Accept": "application/json" },
        timeout: 10000
      });
      
      if (resp.ok) {
        const data = await resp.json();
        return res.json(data);
      }
      res.status(resp.status).json({ error: "History data error" });
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Vite middleware for production/development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // *** အရေးကြီးဆုံး listen line ***
  // Cloud environment မှာ '0.0.0.0' နဲ့ listen လုပ်ဖို့ မဖြစ်မနေ လိုအပ်ပါတယ်
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
