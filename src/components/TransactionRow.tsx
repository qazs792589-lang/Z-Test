import React from 'react';
import { motion } from 'motion/react';
import { Edit2, Check, Trash2, StickyNote } from 'lucide-react';
import { Transaction } from '../types';
import { cn } from '../lib/utils';
import { isTxRealized } from '../lib/txUtils';

interface TransactionRowProps {
  tx: Transaction;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onToggleRealized: (id: string) => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
  tx,
  onEdit,
  onDelete,
  onToggleRealized
}) => {
  const isUS = tx.currency === 'USD';
  const dirColor =
    tx.direction === 'BUY' ? 'text-[var(--danger)]' :
    tx.direction === 'SELL' ? 'text-[var(--success)]' :
    'text-orange-400';
  const dirBg =
    tx.direction === 'BUY' ? 'bg-[var(--danger)]/15 text-[var(--danger)]' :
    tx.direction === 'SELL' ? 'bg-[var(--success)]/15 text-[var(--success)]' :
    'bg-orange-400/10 text-orange-400';
  const dirLabel = tx.direction === 'BUY' ? '買入' : tx.direction === 'SELL' ? '賣出' : '配息';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="relative overflow-hidden border-b border-[var(--border)] group"
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 40 }}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 80) onDelete(tx.id);
        }}
        className={cn(
          "relative px-4 py-3 flex items-stretch gap-3 hover:bg-[var(--bg-tertiary)] transition-colors cursor-grab active:cursor-grabbing hardware-accel no-select",
          isTxRealized(tx) ? "bg-[var(--bg-tertiary)]" : "bg-[var(--bg-secondary)]"
        )}
        style={{ touchAction: 'pan-y' }}
      >
        {/* 左：方向 badge 垂直欄 */}
        <div className="flex flex-col items-center justify-center gap-1 shrink-0 w-[32px]">
          <span className={cn("px-1.5 py-0.5 rounded text-[7px] font-black uppercase text-center w-full", dirBg)}>
            {dirLabel}
          </span>
          {isUS && (
            <span className="text-[6px] font-black text-blue-400 bg-blue-400/10 px-1 py-0.5 rounded text-center w-full leading-tight">US</span>
          )}
          {isTxRealized(tx) && (
            <span className="text-[6px] font-bold text-[var(--text-dim)] opacity-50 text-center w-full leading-tight">已實現</span>
          )}
        </div>

        {/* 中：主要內容 */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          {/* 第一行：日期 + 操作按鈕 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono font-bold text-[var(--text-dim)] opacity-70 leading-none">{tx.date}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(tx); }}
              className="p-1 text-[var(--accent)] hover:bg-[var(--bg-primary)] rounded transition-all"
              title="編輯"
            >
              <Edit2 size={9} />
            </button>
            {tx.direction === 'DIVIDEND' && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleRealized(tx.id); }}
                className={cn(
                  "w-4 h-4 flex items-center justify-center rounded-full transition-all border",
                  isTxRealized(tx)
                    ? "bg-[var(--text-dim)] text-[var(--bg-primary)] border-transparent"
                    : "bg-transparent text-[var(--text-dim)] border-[var(--border)] opacity-40 hover:opacity-100"
                )}
                title="標記已實現"
              >
                <Check size={8} strokeWidth={4} />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(tx.id); }}
              className="p-1 text-[var(--danger)] hover:bg-[var(--bg-primary)] rounded transition-all opacity-0 group-hover:opacity-100 md:opacity-0"
              title="刪除"
            >
              <Trash2 size={9} />
            </button>
          </div>
          {/* 第二行：數量 | 單價 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-black text-[var(--text-main)] leading-none">
              {tx.quantity.toLocaleString(undefined, { maximumFractionDigits: isUS ? 4 : 0 })} 股
            </span>
            <span className="opacity-20 text-[10px]">|</span>
            <span className="text-[10px] font-mono font-black text-[var(--text-main)] leading-none">
              {isUS
                ? <span><span className="opacity-50 text-[9px]">$</span>{tx.unitPrice.toFixed(2)} <span className="text-[8px] text-blue-400 font-bold">USD</span></span>
                : <span><span className="opacity-50 text-[9px]">$</span>{tx.unitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              }
            </span>
          </div>
          {/* 備註 */}
          {tx.notes && (
            <div className="flex items-center gap-1 mt-0.5">
              <StickyNote size={9} className="text-[var(--accent)] shrink-0" />
              <span className="text-[9px] text-[var(--text-dim)] truncate font-medium">{tx.notes}</span>
            </div>
          )}
        </div>

        {/* 右：金額區塊 */}
        <div className="shrink-0 flex flex-col items-end justify-center gap-0.5 min-w-[72px]">
          <span className="text-[8px] text-[var(--text-dim)] uppercase tracking-widest font-black opacity-50 leading-none mb-0.5">
            {isUS ? '交易金額' : '交易總額'}
          </span>
          <p className={cn("text-sm font-mono font-black leading-none", dirColor)}>
            {isUS
              ? <span><span className="opacity-40 text-[10px]">$</span>{Math.abs(tx.totalAmount).toFixed(2)}<span className="text-[8px] opacity-40 ml-0.5">USD</span></span>
              : <span><span className="opacity-40 text-[10px]">$</span>{Math.abs(tx.totalAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            }
          </p>
          {isUS && tx.twdAmount != null && (
            <p className="text-[11px] font-mono font-black text-blue-300 leading-none mt-0.5">
              = NT${tx.twdAmount.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
