import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import yahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';
import { exec } from "child_process";

dotenv.config();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  const PORT = 3001;
  const DATA_FILE = path.join(process.cwd(), "stock_prices.json");

  // Initial prices placeholder
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ updated: null, prices: {}, dates: {} }));
  }

  // Fetch via running the github update script
  async function refreshPrices() {
    console.log("Refreshing stock prices using update_prices_github.js...");
    return new Promise<void>((resolve, reject) => {
      exec("node scripts/update_prices_github.js", (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running update script: ${error.message}`);
          reject(error);
          return;
        }
        console.log(`Update script output:\n${stdout}`);
        if (stderr) {
          console.warn(`Update script stderr:\n${stderr}`);
        }
        resolve();
      });
    });
  }

  // API Routes
  app.get("/api/prices", (req, res) => {
    if (fs.existsSync(DATA_FILE)) {
      res.json(JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")));
    } else {
      res.json({ updated: null, prices: {} });
    }
  });

  app.post("/api/refresh", async (req, res) => {
    await refreshPrices();
    res.json({ success: true });
  });

  app.post("/api/save-backup", (req, res) => {
    try {
      const backupData = req.body;
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Z-Money-FullBackup-${dateStr}.json`;
      const filePath = path.join(process.cwd(), filename);

      // 刪除舊的備份檔案以保持乾淨
      const files = fs.readdirSync(process.cwd());
      files.forEach(f => {
        if (f.startsWith('Z-Money-FullBackup-') && f.endsWith('.json')) {
          fs.unlinkSync(path.join(process.cwd(), f));
        }
      });

      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
      console.log(`[自動備份] 成功寫入備份檔: ${filename}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[自動備份] 寫入失敗:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chart/:ticker", async (req, res) => {
    try {
      const ticker = req.params.ticker;
      
      // 優先檢查是否有 Google Sheets URL
      const googleSheetUrl = process.env.GOOGLE_SHEET_URL;
      if (googleSheetUrl) {
        console.log(`[API] Using Google Sheets for ${ticker}...`);
        try {
          const baseUrl = googleSheetUrl.includes('?') 
            ? googleSheetUrl.split('?')[0] 
            : googleSheetUrl;
          const finalUrl = `${baseUrl}?ticker=${ticker}`;
          
          console.log(`[API] Final Request URL: ${finalUrl}`);
          
          const fetchRes = await fetch(finalUrl, {
            redirect: 'follow'
          });
          
          if (fetchRes.ok) {
            const data = await fetchRes.json();
            if (data && data.length > 0 && !data.error) {
              console.log(`[API] Google Sheets Success: ${data.length} points`);
              return res.json(data);
            } else if (data.error) {
              console.warn(`[API] Google Sheets returned error: ${data.error}`);
            }
          }
        } catch (err: any) {
          console.error("[API] Google Sheets failed, falling back to Yahoo:", err.message);
        }
      }

      let symbol = /^\d+$/.test(ticker) ? `${ticker}.TW` : ticker;
      console.log(`[API] Fetching ${ticker} as ${symbol} from Yahoo...`);
      
      const period1 = Math.floor(new Date('2023-01-01').getTime() / 1000);
      const period2 = Math.floor(Date.now() / 1000);

      let result;
      try {
        result = await yahooFinance.chart(symbol, {
          period1,
          period2,
          interval: '1d'
        });
      } catch (e) {
        if (symbol.endsWith('.TW')) {
          symbol = symbol.replace('.TW', '.TWO');
          console.log(`[API] Retrying with ${symbol}...`);
          try {
            result = await yahooFinance.chart(symbol, {
              period1,
              period2,
              interval: '1d'
            });
          } catch (e2: any) {
             console.error(`[API] Both .TW and .TWO failed: ${e2.message}`);
             return res.json([]);
          }
        } else {
          console.error(`[API] Error for ${symbol}:`, e);
          return res.json([]);
        }
      }

      if (!result || !result.quotes || result.quotes.length === 0) {
        console.warn(`[API] No data found for ${symbol} within range.`);
        return res.json([]);
      }

      const chartData = result.quotes
        .filter(q => q.close !== null)
        .map(q => {
          const d = new Date(q.date);
          return {
            date: d.toISOString().split('T')[0],
            timestamp: d.getTime(),
            price: Number(q.close!.toFixed(2))
          };
        });
      
      console.log(`[API] Success: ${chartData.length} data points for ${ticker}`);
      res.json(chartData);
    } catch (error: any) {
      console.error("[API] Fatal Error:", error.message);
      res.status(500).json({ error: error.message });
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
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Initial fetch if empty
    const currentData = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    if (!currentData.updated) {
      refreshPrices();
    }

    // Background timer to check for 2 PM refresh
    setInterval(() => {
      const now = new Date();
      // Taiwan time (UTC+8)
      const twTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
      if (twTime.getHours() === 14 && twTime.getMinutes() === 0) {
        refreshPrices();
      }
    }, 60000); // Check every minute
  });
}

startServer();
