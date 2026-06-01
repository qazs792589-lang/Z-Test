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

async function main() {
  const cwd = process.cwd();
  
  // 1. 尋找最新的備份檔案作為來源
  const files = fs.readdirSync(cwd);
  const backupFiles = files.filter(f => f.startsWith('Z-Money-FullBackup-') && f.endsWith('.json'));
  if (backupFiles.length === 0) {
    console.error('找不到任何備份檔案。');
    return;
  }
  backupFiles.sort().reverse();
  const latestBackup = backupFiles[0];
  const backupPath = path.join(cwd, latestBackup);
  console.log(`讀取備份來源檔案: ${backupPath}`);
  
  let backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  
  // 2. 將所有的 APPL 更名為 AAPL
  let changed = false;
  if (backupData.transactions) {
    backupData.transactions = backupData.transactions.map(tx => {
      if (tx.ticker === 'APPL') {
        console.log(`[修正 Ticker] 將交易 ${tx.id} 的 APPL 修正為 AAPL`);
        changed = true;
        return { ...tx, ticker: 'AAPL', name: tx.name === 'APPL' ? 'AAPL' : tx.name };
      }
      return tx;
    });
  }
  
  if (backupData.tickerOrder) {
    backupData.tickerOrder = backupData.tickerOrder.map(t => {
      if (t === 'APPL') {
        changed = true;
        return 'AAPL';
      }
      return t;
    });
  }
  
  if (backupData.tickerMetadata && backupData.tickerMetadata['APPL']) {
    backupData.tickerMetadata['AAPL'] = backupData.tickerMetadata['APPL'];
    delete backupData.tickerMetadata['APPL'];
    changed = true;
    console.log(`[修正 Metadata] 已將 APPL metadata 轉移至 AAPL`);
  }
  
  // 3. 獲取美股三大指數與台股大盤從 2026-01-01 到現在的歷史價格 (每週五收盤價)
  const tickers = ['^GSPC', '^IXIC', '^DJI', '^TWII'];
  const startDate = '2026-01-01';
  
  let weeklyPrices = backupData.weeklyPrices || [];
  // 先將已存在的這些指數的歷史點數刪除，以便全新匯入
  let newWeeklyPrices = weeklyPrices.filter(p => !tickers.includes(p.ticker));
  
  for (const ticker of tickers) {
    console.log(`正在抓取 ${ticker} 歷史價格...`);
    try {
      const result = await yahooFinance.chart(ticker, {
        period1: startDate,
        interval: '1d' // 先抓取日線
      });
      
      if (result && result.quotes) {
        const quotesByWeek = new Map();
        
        result.quotes.forEach(q => {
          if (q.close === null || q.close === undefined) return;
          const d = new Date(q.date);
          const dateStr = d.toISOString().split('T')[0];
          
          // 計算該日期是當年的第幾週
          const tempDate = new Date(d.getTime());
          tempDate.setHours(0, 0, 0, 0);
          tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
          const yearStart = new Date(tempDate.getFullYear(), 0, 1);
          const weekNo = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
          const weekKey = `${tempDate.getFullYear()}-W${weekNo}`;
          
          const existing = quotesByWeek.get(weekKey);
          if (!existing || dateStr > existing.date) {
            quotesByWeek.set(weekKey, { date: dateStr, price: Number(q.close.toFixed(2)) });
          }
        });
        
        const addedList = Array.from(quotesByWeek.values());
        console.log(`成功獲取 ${ticker} 共 ${addedList.length} 週 the historical points`);
        
        addedList.forEach(item => {
          newWeeklyPrices.push({
            date: item.date,
            ticker: ticker,
            price: item.price
          });
        });
      }
    } catch (err) {
      console.error(`抓取 ${ticker} 失敗:`, err.message);
    }
  }
  
  // 排序並寫入新檔案
  newWeeklyPrices.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.ticker.localeCompare(b.ticker);
  });
  
  backupData.weeklyPrices = newWeeklyPrices;
  
  const outputPath = path.join(cwd, 'Z-Money-Import-AAPL-Indices.json');
  fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2));
  console.log(`\n========================================`);
  console.log(`成功將所有資料寫入獨立匯入檔:`);
  console.log(`👉 ${outputPath}`);
  console.log(`========================================`);
}

main();
