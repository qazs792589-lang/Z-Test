import { Transaction } from '../types';
import { compareTransactions, ensureTransactionSequence } from './transactionOrder';
import { addShares, getSaleAllocation } from './shareMath';

export const compareSpotTransactions = compareTransactions;

export interface InventoryShortage { ticker: string; date: string; available: number; requested: number }

export function findSpotInventoryShortage(transactions: Transaction[], tickers: string[]): InventoryShortage | null {
  const affected = new Set(tickers.map(t => t.trim().toUpperCase()));
  const balances = new Map<string, number>();
  for (const tx of [...ensureTransactionSequence(transactions)].sort(compareSpotTransactions)) {
    const ticker = tx.ticker.trim().toUpperCase();
    if (!affected.has(ticker) || tx.direction === 'DIVIDEND') continue;
    const available = balances.get(ticker) || 0;
    if (tx.direction === 'SELL' && tx.quantity > available) {
      return { ticker, date: tx.date, available: Math.max(0, available), requested: tx.quantity };
    }
    balances.set(ticker, tx.direction === 'BUY' ? addShares(available, tx.quantity) : getSaleAllocation(available, tx.quantity).remainingShares);
  }
  return null;
}

export function spotInventoryMessage(issue: InventoryShortage): string {
  const format = (value: number) => value.toLocaleString('zh-TW', { maximumFractionDigits: 8 });
  return '可賣 ' + format(issue.available) + ' 股，欲賣 ' + format(issue.requested) + ' 股。';
}
