import fs from 'fs';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

async function updatePrices() {
  console.log('正在取得最新股價...');

  const tickers = ['0050.TW', '2330.TW'];
  const prices = {};

  for (const ticker of tickers) {
    try {
      const quote = await yahooFinance.quote(ticker);
      prices[ticker] = quote.regularMarketPrice.toFixed(2);
      console.log(`${ticker}: ${prices[ticker]}`);
    } catch (e) {
      console.error(`取得 ${ticker} 失敗:`, e);
    }
  }

  const data = {
    updated: new Date().toISOString(),
    prices: prices
  };

  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
  }
  
  fs.writeFileSync(path.join(dir, 'prices.json'), JSON.stringify(data, null, 2));
  console.log('股價資料已更新至 data/prices.json');
}

updatePrices().catch(err => {
  console.error('更新失敗:', err);
  process.exit(1);
});
