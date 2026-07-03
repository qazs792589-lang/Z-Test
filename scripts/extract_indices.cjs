const fs = require('fs');
const data = JSON.parse(fs.readFileSync('Z-Money-FullBackup-2026-07-03.json', 'utf8'));
const indices = data.weeklyPrices
  .filter(p => ['^GSPC', '^IXIC', '^DJI'].includes(p.ticker))
  .sort((a, b) => a.ticker.localeCompare(b.ticker) || a.date.localeCompare(b.date));

for (const ticker of ['^GSPC', '^IXIC', '^DJI']) {
  const rows = indices.filter(p => p.ticker === ticker);
  console.log(`\n// ${ticker} (${rows.length} weeks)`);
  rows.forEach(p => console.log(`  { date: '${p.date}', ticker: '${ticker}', price: ${p.price} },`));
}
