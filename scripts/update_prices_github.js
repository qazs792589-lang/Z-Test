import fs from 'fs';
import path from 'path';
import yahooFinanceModule from 'yahoo-finance2';

// 兼容新舊版 yahoo-finance2 實例化
let yahooFinance = yahooFinanceModule;
if (typeof yahooFinanceModule === 'function') {
  yahooFinance = new yahooFinanceModule();
} else if (yahooFinanceModule && typeof yahooFinanceModule.default === 'function') {
  yahooFinance = new (yahooFinanceModule.default)();
} else if (yahooFinanceModule && yahooFinanceModule.YahooFinance) {
  yahooFinance = new yahooFinanceModule.YahooFinance();
}

// 尋找最新的備份 JSON 檔案
function getLatestBackupFile() {
  const rootDir = process.cwd();
  const files = fs.readdirSync(rootDir);
  const backupFiles = files
    .filter(f => f.startsWith('Z-Money-FullBackup-') && f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a)); // 降冪排序，最新日期在最前面

  if (backupFiles.length > 0) {
    const latestFile = path.join(rootDir, backupFiles[0]);
    console.log(`[股價更新] 找到最新備份檔案: ${latestFile}`);
    return latestFile;
  }
  return null;
}

// 從交易紀錄中提取有持股的 Tickers
function getHeldTickers(backupFilePath) {
  const tickers = new Set();
  
  // 永遠包含大盤指數
  tickers.add('^TWII');

  if (!backupFilePath) {
    console.log('[股價更新] 未找到備份檔案，將採用預設監控名單 (^TWII, 2330, 0050)');
    tickers.add('2330');
    tickers.add('0050');
    return Array.from(tickers);
  }

  try {
    const rawData = fs.readFileSync(backupFilePath, 'utf-8');
    const data = JSON.parse(rawData);
    
    if (!data.transactions || !Array.isArray(data.transactions)) {
      console.log('[股價更新] 備份檔案中找不到有效的交易紀錄');
      return Array.from(tickers);
    }

    // 計算每個 Ticker 的持股餘額
    const balances = {};
    data.transactions.forEach(tx => {
      if (!tx.ticker) return;
      const ticker = tx.ticker.trim().toUpperCase();
      const qty = parseFloat(tx.quantity) || 0;
      
      if (!balances[ticker]) balances[ticker] = 0;

      if (tx.direction === 'BUY') {
        balances[ticker] += qty;
      } else if (tx.direction === 'SELL') {
        balances[ticker] -= qty;
      }
    });

    // 篩選餘額大於 0.0001 的 Tickers
    Object.keys(balances).forEach(ticker => {
      if (balances[ticker] > 0.0001 && !['現金', 'CASH', 'TWD', 'USD'].includes(ticker)) {
        tickers.add(ticker);
      }
    });

    console.log(`[股價更新] 解析完成。當前持有股票與監控清單: ${Array.from(tickers).join(', ')}`);
    return Array.from(tickers);
  } catch (error) {
    console.error('[股價更新] 讀取或解析備份檔案失敗:', error);
    return Array.from(tickers);
  }
}

// 獲取台股上市與上櫃 OpenAPI 的所有價格，並合併為 Map
async function fetchAllTaiwanStockPrices() {
  const pricesMap = {};
  
  // 1. 上市股票 API (TWSE)
  try {
    console.log('[股價更新] 正在獲取證交所上市股票價格 (TWSE)...');
    const twseRes = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
    if (twseRes.ok) {
      const data = await twseRes.json();
      data.forEach(item => {
        const code = item.Code ? item.Code.trim() : '';
        const price = parseFloat(item.ClosingPrice);
        if (code && !isNaN(price)) {
          pricesMap[code] = price;
        }
      });
      console.log(`[股價更新] 成功載入上市股票收盤價: ${data.length} 檔`);
    } else {
      console.warn(`[股價更新] TWSE API 回傳錯誤: ${twseRes.status}`);
    }
  } catch (err) {
    console.error('[股價更新] 獲取 TWSE 價格失敗:', err.message);
  }

  // 2. 上櫃股票 API (TPEx)
  try {
    console.log('[股價更新] 正在獲取櫃買中心上櫃股票價格 (TPEx)...');
    const tpexRes = await fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes');
    if (tpexRes.ok) {
      const data = await tpexRes.json();
      data.forEach(item => {
        const code = item.SecuritiesCompanyCode ? item.SecuritiesCompanyCode.trim() : '';
        const price = parseFloat(item.Close);
        if (code && !isNaN(price)) {
          pricesMap[code] = price;
        }
      });
      console.log(`[股價更新] 成功載入上櫃股票收盤價: ${data.length} 檔`);
    } else {
      console.warn(`[股價更新] TPEx API 回傳錯誤: ${tpexRes.status}`);
    }
  } catch (err) {
    console.error('[股價更新] 獲取 TPEx 價格失敗:', err.message);
  }

  return pricesMap;
}

// 計算目前台股的最新的交易日期 (台灣時間下午 14:00 收盤結算後為當天，否則為前一個交易日，並扣除週末)
function getTaiwanTradingDate() {
  const now = new Date();
  // 台灣時間 UTC+8
  const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const hour = twTime.getUTCHours();
  
  let tradingDate = new Date(twTime.getTime());
  
  // 如果在下午 14:00 前，代表今天還沒收盤，最新價格為前一個交易日
  if (hour < 14) {
    tradingDate.setDate(tradingDate.getDate() - 1);
  }
  
  // 處理週末：若為週六 (6) 減 1 天變週五；若為週日 (0) 減 2 天變週五
  const dayOfWeek = tradingDate.getDay(); 
  if (dayOfWeek === 6) {
    tradingDate.setDate(tradingDate.getDate() - 1);
  } else if (dayOfWeek === 0) {
    tradingDate.setDate(tradingDate.getDate() - 2);
  }
  
  return tradingDate.toISOString().split('T')[0];
}

// 以 Yahoo Finance 查詢單一標的收盤價與最後交易日期
async function fetchPriceFromYahoo(ticker) {
  let symbol = ticker;
  if (/^\d+[A-Z]?$/.test(ticker)) {
    symbol = `${ticker}.TW`;
  }

  try {
    console.log(`[股價更新] [Yahoo] 正在抓取: ${symbol}...`);
    const quote = await yahooFinance.quote(symbol);
    if (quote && quote.regularMarketPrice !== undefined) {
      const marketTime = quote.regularMarketTime ? new Date(quote.regularMarketTime) : new Date();
      // 使用 ISO 格式提取日期 (UTC 日期，適用於大部分交易所結算日)
      const date = marketTime.toISOString().split('T')[0];
      return { price: parseFloat(quote.regularMarketPrice), date };
    }
  } catch (err) {
    if (/^\d+[A-Z]?$/.test(ticker)) {
      const altSymbol = `${ticker}.TWO`;
      try {
        console.log(`[股價更新] [Yahoo] 重試上櫃代碼: ${altSymbol}...`);
        const quoteAlt = await yahooFinance.quote(altSymbol);
        if (quoteAlt && quoteAlt.regularMarketPrice !== undefined) {
          const marketTimeAlt = quoteAlt.regularMarketTime ? new Date(quoteAlt.regularMarketTime) : new Date();
          const date = marketTimeAlt.toISOString().split('T')[0];
          return { price: parseFloat(quoteAlt.regularMarketPrice), date };
        }
      } catch (errAlt) {
        console.error(`[股價更新] [Yahoo] 抓取 ${ticker} (TW 與 TWO) 皆失敗:`, errAlt.message);
      }
    } else {
      console.error(`[股價更新] [Yahoo] 抓取 ${ticker} 失敗:`, err.message);
    }
  }
  return null;
}

// 主程式
async function main() {
  const latestBackup = getLatestBackupFile();
  const heldTickers = getHeldTickers(latestBackup);
  
  const twStockPrices = await fetchAllTaiwanStockPrices();
  const twTradingDate = getTaiwanTradingDate();
  
  const OUTPUT_PATH = path.join(process.cwd(), 'public', 'stock_prices.json');
  
  let pricesDb = { updated: null, prices: {}, dates: {} };
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      pricesDb = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
      if (!pricesDb.dates) pricesDb.dates = {};
    } catch (e) {
      console.warn('[股價更新] 讀取現有 stock_prices.json 失敗，將會重新建立。');
    }
  }

  console.log('[股價更新] 開始更新目標持股收盤價...');
  
  let successCount = 0;
  let failCount = 0;

  for (const ticker of heldTickers) {
    let updatedPrice = null;
    let priceDate = null;

    // 1. 如果是台股優先從 OpenAPI Map 找價格
    if (/^\d+[A-Z]?$/.test(ticker)) {
      if (twStockPrices[ticker] !== undefined) {
        updatedPrice = twStockPrices[ticker];
        priceDate = twTradingDate;
        console.log(`[股價更新] [OpenAPI] ${ticker}: ${updatedPrice} (交易日期: ${priceDate})`);
      }
    }

    // 2. 如果 OpenAPI 沒找到，使用 Yahoo Finance 備援
    if (updatedPrice === null) {
      const yahooResult = await fetchPriceFromYahoo(ticker);
      if (yahooResult !== null) {
        updatedPrice = yahooResult.price;
        priceDate = yahooResult.date;
        console.log(`[股價更新] [Yahoo] ${ticker}: ${updatedPrice} (交易日期: ${priceDate})`);
      }
    }

    // 3. 更新至資料庫中
    if (updatedPrice !== null) {
      pricesDb.prices[ticker] = Number(updatedPrice.toFixed(2));
      pricesDb.dates[ticker] = priceDate;
      successCount++;
    } else {
      console.warn(`[股價更新] 無法獲取 ${ticker} 的最新價格，將保留歷史價格: ${pricesDb.prices[ticker] || '無'}`);
      failCount++;
    }
  }

  pricesDb.updated = new Date().toISOString();
  
  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(pricesDb, null, 2));
  
  const rootOutputPath = path.join(process.cwd(), 'stock_prices.json');
  fs.writeFileSync(rootOutputPath, JSON.stringify(pricesDb, null, 2));

  console.log(`\n[股價更新] 更新完成！成功: ${successCount} 檔，失敗: ${failCount} 檔。`);
  console.log(`[股價更新] 數據已存入: ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('[股價更新] 執行發生未捕獲的錯誤:', err);
  process.exit(1);
});
