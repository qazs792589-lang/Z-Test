import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Transaction } from '../types';
import { compareTransactions } from '../lib/transactionOrder';

export const TransactionOrderButtons = ({ tx, transactions, onMove }: {
  tx: Transaction;
  transactions?: Transaction[];
  onMove?: (id: string, step: -1 | 1) => void;
}) => {
  if (!transactions || !onMove) return null;
  const group = transactions.filter(item => item.ticker === tx.ticker && item.date === tx.date).sort(compareTransactions);
  if (group.length < 2) return null;
  const index = group.findIndex(item => item.id === tx.id);
  return <span className="inline-flex shrink-0 items-center">
    <button type="button" title="同日往上（較晚）" aria-label="同日往上（較晚）" disabled={index >= group.length - 1}
      onClick={event => { event.stopPropagation(); onMove(tx.id, 1); }}
      className="p-1.5 rounded text-[var(--accent)] hover:bg-[var(--bg-primary)] disabled:opacity-20 disabled:cursor-default">
      <ArrowUp size={10} />
    </button>
    <button type="button" title="同日往下（較早）" aria-label="同日往下（較早）" disabled={index <= 0}
      onClick={event => { event.stopPropagation(); onMove(tx.id, -1); }}
      className="p-1.5 rounded text-[var(--accent)] hover:bg-[var(--bg-primary)] disabled:opacity-20 disabled:cursor-default">
      <ArrowDown size={10} />
    </button>
  </span>;
};
