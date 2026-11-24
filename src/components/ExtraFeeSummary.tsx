import React from 'react';
import { Transaction } from '../types';
import { summarizeTransactionCosts } from '../lib/transactionCostSummary';

export const ExtraFeeSummary: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const totals = summarizeTransactionCosts(transactions);
  if (!totals.hasUsd) return (
    <div className="col-span-2 lg:col-span-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pt-4 border-t border-[var(--border)]">
      <span className="text-[10px] text-[var(--text-dim)] tracking-[0.2em] font-black">累計額外費用</span>
      <p className="text-xl md:text-2xl font-mono font-black text-[var(--text-main)]">NT${totals.twdExtras.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}</p>
    </div>
  );
  return <>
    <div className="col-span-1 lg:col-span-2 min-w-0 pt-4 border-t border-[var(--border)]">
      <span className="text-[10px] text-[var(--text-dim)] font-black block mb-2">累計匯差（固定31）</span>
      <p className="text-lg md:text-2xl font-mono font-black text-[var(--text-main)] break-all" title="只計有實填台幣結算金額的交易；正數為相對31基準有利、負數為不利">
        {totals.fxCount ? `${totals.fxTotal > 0 ? '+' : ''}NT$${totals.fxTotal.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}` : '—'}
      </p>
    </div>
    <div className="col-span-1 lg:col-span-2 min-w-0 pt-4 border-t border-[var(--border)]">
      <span className="text-[10px] text-[var(--text-dim)] font-black block mb-2">累計手續費</span>
      <p className="text-lg md:text-2xl font-mono font-black text-[var(--text-main)] break-all">USD ${totals.usdFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      {totals.twdExtras !== 0 && <p className="font-mono text-[var(--text-main)]">NT${totals.twdExtras.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}</p>}
    </div>
  </>;
};
