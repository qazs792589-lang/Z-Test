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
