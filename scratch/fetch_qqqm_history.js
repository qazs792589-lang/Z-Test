import fs from 'fs';
import path from 'path';
import yahooFinanceModule from 'yahoo-finance2';

let yahooFinance = yahooFinanceModule;
if (typeof yahooFinanceModule === 'function') {
  yahooFinance = new yahooFinanceModule();
} else if (yahooFinanceModule && typeof yahooFinanceModule.default === 'function') {
  yahooFinance = new (yahooFinanceModule.default)();
} else if (yahooFinanceModule && yahooFinanceModule.YahooFinance) {
  yahooFinance = new yahooFinanceModule.YahooFinance();
}

async function getQQQMHistory() {
  try {
    const symbol = 'QQQM';
    const queryOptions = {
      period1: new Date('2026-01-01'),
      period2: new Date(),
      interval: '1d'
    };
    console.log(`正在使用 chart() 抓取 ${symbol} 的歷史價格...`);
    const chartResult = await yahooFinance.chart(symbol, queryOptions);
    
    if (!chartResult || !chartResult.quotes || !Array.isArray(chartResult.quotes)) {
      throw new Error('無法取得有效的圖表價格數據');
    }

    const results = chartResult.quotes;
    console.log(`成功獲取 ${results.length} 筆價格記錄`);
    
    // 篩選出每週五的收盤價，如果週五是假日，則採用當週最後一個有交易的交易日
    const fridays = [];
    let current = new Date('2026-01-02'); // 2026年第一個週五
    const today = new Date();
    while (current <= today) {
      fridays.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 7);
    }
    
    const weeklyPrices = [];
    
    fridays.forEach(fridayStr => {
      const fridayDate = new Date(fridayStr);
      let bestMatch = null;
      let minDiff = Infinity;
      
      results.forEach(row => {
        if (!row.date || row.close === undefined || row.close === null) return;
        const rowDate = new Date(row.date);
        const diff = fridayDate.getTime() - rowDate.getTime();
        // 交易日必須在週五或週五之前，且是當週內 (差距在 5 天內)
        if (diff >= 0 && diff < 5 * 24 * 60 * 60 * 1000) {
          if (diff < minDiff) {
            minDiff = diff;
            bestMatch = row;
          }
        }
      });
      
      if (bestMatch) {
        // 格式化日期為 YYYY-MM-DD (台灣/亞洲時區 local format)
        const matchDate = new Date(bestMatch.date);
        // 轉換為台北時間日期字串，以防因為時區問題差一天
        const dateStr = new Date(matchDate.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        weeklyPrices.push({
          date: fridayStr, // 統一對齊為我們預期要產生的週五日期
          ticker: symbol,
          price: Number(bestMatch.close.toFixed(2))
        });
      }
    });
    
    console.log(`篩選出 ${weeklyPrices.length} 筆週五收盤價：`);
    console.log(JSON.stringify(weeklyPrices, null, 2));
    
    // 寫入暫存檔
    fs.writeFileSync(path.join(process.cwd(), 'scratch', 'qqqm_weekly.json'), JSON.stringify(weeklyPrices, null, 2));
    console.log('數據已寫入 scratch/qqqm_weekly.json');
  } catch (err) {
    console.error('抓取失敗:', err);
  }
}

getQQQMHistory();
