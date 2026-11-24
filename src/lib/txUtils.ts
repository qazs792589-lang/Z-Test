import { Transaction } from '../types';

/**
 * Determines if a transaction is effectively 'Realized' based on its direction
 * and any manual user overrides.
 * 
 * - BUY: Default Unrealized.
 * - SELL/DIVIDEND: Default Realized.
 * - isManualRealized: Explicit user override.
 */
export const isTxRealized = (tx: Transaction): boolean => {
  // BUY 永遠未實現 (增加活動庫存)
  if (tx.direction === 'BUY') return false;
  // SELL 永遠已實現 (扣除庫存並產生歷史紀錄)
  if (tx.direction === 'SELL') return true;
  
  // DIVIDEND 允許手動指定 (預設為已實現)
  return tx.isManualRealized !== undefined ? tx.isManualRealized : true;
};

/** Normalize SELL net proceeds across form and legacy CSV sign conventions. */
export const getSellNetAmounts = (tx: Transaction): { original: number; twd: number } => {
  // Form SELL totals use the cash-outflow sign; legacy CSV totals use the opposite.
  // Keep the stored settlement magnitude, and infer cash direction from gross less fees/tax.
  const netSign = tx.quantity * tx.unitPrice - (tx.fee || 0) - (tx.tax || 0) < 0 ? -1 : 1;
  const original = netSign * Math.abs(tx.totalAmount);
  const twd = tx.currency === 'USD'
    ? (tx.twdAmount
      // Positive TWD entries are magnitudes; an explicit negative entry already denotes outflow.
      ? (tx.twdAmount < 0 ? tx.twdAmount : netSign * tx.twdAmount)
      : original * 31)
    : original;
  return { original, twd };
};

/** Dividend receipts share SELL settlement signs, including rare net cash outflows. */
export const getDividendNetAmounts = (tx: Transaction): { original: number; twd: number } => getSellNetAmounts(tx);
