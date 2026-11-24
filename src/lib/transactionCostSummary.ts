import { Transaction } from '../types';
import { getSellNetAmounts } from './txUtils';

export function summarizeTransactionCosts(transactions: Transaction[]) {
  let twdExtras = 0, usdFees = 0, fxTotal = 0, fxCount = 0;
  const hasUsd = transactions.some(tx => tx.currency === 'USD');
  for (const tx of transactions) {
    if (tx.currency !== 'USD') {
      twdExtras += (Number(tx.fee) || 0) + (Number(tx.tax) || 0);
      continue;
    }
    usdFees += Number(tx.fee) || 0;
    if (!Number.isFinite(tx.twdAmount) || !tx.twdAmount) continue;
    const originalAmount = Math.abs(tx.totalAmount);
    if (tx.direction === 'BUY') fxTotal += originalAmount * 31 - Math.abs(tx.twdAmount);
    else if (tx.direction === 'SELL') {
      const net = getSellNetAmounts(tx);
      fxTotal += net.twd - net.original * 31;
    } else fxTotal += Math.abs(tx.twdAmount) - originalAmount * 31;
    fxCount++;
  }
  return { twdExtras, usdFees, fxTotal, fxCount, hasUsd };
}
