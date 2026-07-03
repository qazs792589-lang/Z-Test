/**
 * fetch_us_indices_history.cjs
 * 抓取 ^GSPC, ^IXIC, ^DJI 從 2026-01-01 到今天的每週收盤價
 * 並注入到最新 backup JSON 的 weeklyPrices 中
 */

const yfPkg = require('yahoo-finance2');
const YahooFinance = yfPkg.default;
const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

const fs = require('fs');
const path = require('path');

const TICKERS = ['^GSPC', '^IXIC', '^DJI'];
const START_DATE = '2026-01-01';
const END_DATE = new Date().toISOString().split('T')[0];

async function fetchWeeklyClose(ticker, from, to) {
  console.log(`[抓取] ${ticker} ${from} → ${to}`);
  try {
    // v3 historical maps to chart internally; must provide period2
    const result = await yf.historical(ticker, {
      period1: from,
      period2: to,
      interval: '1wk',
    });
    return result
      .filter(r => r.close != null)
      .map(r => ({
        date: r.date.toISOString().split('T')[0],
        ticker,
        price: parseFloat(r.close.toFixed(2))
      }));
  } catch (e) {
    console.error(`[失敗] ${ticker}: ${e.message}`);
    return [];
  }
}

async function findLatestBackup(dir) {
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith('Z-Money-FullBackup-') && f.endsWith('.json'))
    .sort()
    .reverse();
  if (!files.length) throw new Error('找不到 backup 檔案');
  return path.join(dir, files[0]);
}

(async () => {
  const dir = path.resolve(__dirname, '..');
  const backupPath = await findLatestBackup(dir);
  console.log(`[讀取] ${backupPath}`);
  const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  const weeklyPrices = data.weeklyPrices || [];

  // 先移除舊的 US indices 週價（避免重複），保留其他
  const filtered = weeklyPrices.filter(p => !TICKERS.includes(p.ticker));

  // 抓新資料
  const newEntries = [];
  for (const ticker of TICKERS) {
    const rows = await fetchWeeklyClose(ticker, START_DATE, END_DATE);
    console.log(`  → ${ticker}: ${rows.length} 筆`);
    newEntries.push(...rows);
  }

  if (newEntries.length === 0) {
    console.error('❌ 沒有抓到任何資料，請確認網路和 API 狀況');
    process.exit(1);
  }

  // 合併並排序
  const merged = [...filtered, ...newEntries].sort((a, b) =>
    a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker)
  );

  data.weeklyPrices = merged;

  // 寫回 backup
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n✅ 完成！共注入 ${newEntries.length} 筆美股指數週價`);
  console.log(`   檔案: ${backupPath}`);

  // 同時更新 public/stock_prices.json 的最新價
  const spPath = path.join(dir, 'public', 'stock_prices.json');
  if (fs.existsSync(spPath)) {
    const sp = JSON.parse(fs.readFileSync(spPath, 'utf8'));
    for (const ticker of TICKERS) {
      const latest = newEntries
        .filter(e => e.ticker === ticker)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (latest) {
        sp[ticker] = latest.price;
        console.log(`   stock_prices: ${ticker} = ${latest.price} (${latest.date})`);
      }
    }
    fs.writeFileSync(spPath, JSON.stringify(sp, null, 2), 'utf8');
  }

  // 顯示最新幾筆供確認
  console.log('\n[最近5筆週收盤]:');
  newEntries.slice(-15).forEach(e => console.log(`  ${e.date} ${e.ticker} = ${e.price}`));
})();
