import { Transaction, Config } from '../src/types';

// Sample configs (matching typical values)
const sampleConfigs: Record<string, Config> = {
  General: { category: 'General', buyFeeRate: 0.001425, sellFeeRate: 0.001425, taxRate: 0.003, minFee: 20, discount: 1 },
  ETF: { category: 'ETF', buyFeeRate: 0.001, sellFeeRate: 0.001, taxRate: 0.0015, minFee: 0, discount: 1 },
  DayTrade: { category: 'DayTrade', buyFeeRate: 0, sellFeeRate: 0, taxRate: 0.003, minFee: 0, discount: 1 },
  Custom: { category: 'Custom', buyFeeRate: 0, sellFeeRate: 0, taxRate: 0, minFee: 0, discount: 1 }
};

// Helper to compute preview (replicating useTransactionForm logic)
function computePreview(formData: any) {
  const subtotal = formData.unitPrice * formData.quantity;
  const config = sampleConfigs[formData.category];
  let fee = 0;
  let tax = 0;
  if (formData.direction === 'DIVIDEND') {
    const total = -subtotal;
    return { fee: 0, tax: 0, total };
  }
  if (formData.category === 'Custom') {
    fee = formData.customFee;
    tax = formData.customTax;
  } else {
    const feeRate = formData.direction === 'BUY' ? config.buyFeeRate : config.sellFeeRate;
    fee = Math.max(config.minFee, Math.floor(subtotal * feeRate * config.discount));
    tax = formData.direction === 'SELL' ? Math.floor(subtotal * config.taxRate) : 0;
  }
  const total = formData.direction === 'BUY' ? subtotal + fee + tax : -(subtotal - fee - tax);
  return { fee, tax, total };
}

// Test cases
const testTransactions = [
  { ticker: '2330', direction: 'BUY', quantity: 10, unitPrice: 500, category: 'General' },
  { ticker: '2330', direction: 'SELL', quantity: 5, unitPrice: 550, category: 'General' },
  { ticker: '2330', direction: 'DIVIDEND', quantity: 10, unitPrice: 5, category: 'General' },
];

console.log('--- Transaction Preview Tests ---');
for (const tx of testTransactions) {
  const preview = computePreview({
    ticker: tx.ticker,
    quantity: tx.quantity,
    unitPrice: tx.unitPrice,
    direction: tx.direction,
    category: tx.category,
    customFee: 0,
    customTax: 0,
  });
  console.log(tx, '=>', preview);
}

// Simple portfolio calc replicating usePortfolioCalculations logic (without React)
function calculatePortfolio(transactions: any[]) {
  const holdings: Record<string, any> = {};
  const realizedList: any[] = [];
  const stockGroups: Record<string, any[]> = {};
  const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (const tx of sortedTxs) {
    if (!stockGroups[tx.ticker]) stockGroups[tx.ticker] = [];
    stockGroups[tx.ticker].push(tx);
    if (!holdings[tx.ticker]) holdings[tx.ticker] = { ticker: tx.ticker, name: tx.name || '', currentShares: 0, avgCost: 0, totalInvested: 0 };
    const h = holdings[tx.ticker];
    if (tx.direction === 'BUY') {
      if (h.currentShares === 0) h.totalInvested = 0;
      const newTotalShares = h.currentShares + tx.quantity;
      const newTotalCost = h.totalInvested + Math.abs(tx.totalAmount);
      h.avgCost = newTotalShares > 0 ? newTotalCost / newTotalShares : 0;
      h.currentShares = newTotalShares;
      h.totalInvested = newTotalCost;
    } else if (tx.direction === 'SELL') {
      const sellQty = Math.min(tx.quantity, h.currentShares);
      if (sellQty <= 0) continue;
      const costBasis = h.avgCost * sellQty;
      const sellRevenue = Math.abs(tx.totalAmount);
      const profit = sellRevenue - costBasis;
      const netPrice = sellRevenue / sellQty;
      realizedList.push({ ticker: tx.ticker, buyPrice: h.avgCost, sellPrice: netPrice, profit, roi: costBasis > 0 ? (profit / costBasis) * 100 : 0, closeDate: tx.date });
      h.currentShares -= sellQty;
      h.totalInvested -= costBasis;
      if (h.currentShares <= 0) { h.currentShares = 0; h.totalInvested = 0; h.avgCost = 0; }
    } else if (tx.direction === 'DIVIDEND') {
      h.totalInvested -= Math.abs(tx.totalAmount);
      h.avgCost = h.currentShares > 0 ? h.totalInvested / h.currentShares : 0;
    }
  }
  const activeHoldings = Object.values(holdings).filter(h => h.currentShares > 0);
  return { activeHoldings, realizedList };
}

// Build detailed transactions with totalAmount etc.
const detailedTxs = testTransactions.map((t, i) => {
  const preview = computePreview({
    ticker: t.ticker,
    quantity: t.quantity,
    unitPrice: t.unitPrice,
    direction: t.direction,
    category: t.category,
    customFee: 0,
    customTax: 0,
  });
  return { ...t, id: String(i+1), name: 'Sample', totalAmount: preview.total, fee: preview.fee, tax: preview.tax };
});

console.log('--- Portfolio Calculation Test ---');
console.log(calculatePortfolio(detailedTxs));
