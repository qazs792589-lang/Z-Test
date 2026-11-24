import { getDividendNetAmounts } from '../lib/txUtils';
import React from 'react';
import { Transaction } from '../types';
import { cn } from '../lib/utils';

export const ChartTransactionLabel: React.FC<{ tx: Transaction }> = ({ tx }) => {
  const isDividend = tx.direction === 'DIVIDEND';
  return (
    <div className="flex items-center gap-2 text-[9px]">
      <span className={cn('px-1 rounded font-black', isDividend
        ? 'bg-orange-400/10 text-orange-400'
        : tx.direction === 'BUY' ? 'bg-[var(--danger)] text-white' : 'bg-[var(--success)] text-white')}>
        {isDividend ? '配息' : tx.direction === 'BUY' ? '買' : '賣'}
        {!isDividend && tx.quantity}
      </span>
      <span className={isDividend ? 'text-orange-400' : 'text-[var(--text-main)]'}>
        {isDividend && '每股 '}
        ${tx.unitPrice}{tx.currency === 'USD' && ' USD'}
        {isDividend && <>｜{getDividendNetAmounts(tx).original < 0 ? '支出' : '入帳'} ${Math.abs(getDividendNetAmounts(tx).original).toLocaleString(undefined, { maximumFractionDigits: 2 })}{tx.currency === 'USD' && ' USD'}</>}
      </span>
    </div>
  );
};
