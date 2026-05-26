import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import yahooFinance from 'yahoo-finance2';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3001;
  const DATA_FILE = path.join(process.cwd(), "stock_prices.json");

  // Initial prices placeholder
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ updated: null, prices: {} }));
  }

  // Fetch from TWSE
  async function refreshPrices() {
    console.log("Refreshing stock prices from TWSE...");
    try {
      const response = await fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL");
      if (!response.ok) throw new Error("Failed to fetch from TWSE");
      const data = await response.json();
      
      const newPrices: Record<string, number> = {};
      data.forEach((item: any) => {
        // ClosingPrice is index 10 or 7 depending on the API version, usually "ClosingPrice" field in JSON
        const price = parseFloat(item.ClosingPrice);
        if (!isNaN(price)) {
          newPrices[item.Code] = price;
        }
      });

      fs.writeFileSync(DATA_FILE, JSON.stringify({ 
        updated: new Date().toISOString(), 
        prices: newPrices 
      }));
      console.log("Successfully updated prices for", Object.keys(newPrices).length, "stocks.");
    } catch (error) {
      console.error("Error refreshing prices:", error);
    }
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
