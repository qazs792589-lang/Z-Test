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
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative overflow-hidden border-b border-[var(--border)] group"
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 40 }}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 80) {
            onDelete(tx.id);
          }
        }}
        className={cn(
          "relative px-3 py-3 md:px-6 md:py-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors cursor-grab active:cursor-grabbing hardware-accel no-select",
          isTxRealized(tx) ? "bg-[var(--bg-tertiary)]" : "bg-[var(--bg-secondary)]"
        )}
        style={{ touchAction: 'pan-y' }}
      >
        {/* 左側：方向標籤 + 日期/數量/單價 */}
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className={cn(
              "px-1.5 py-0.5 rounded text-[7px] font-bold uppercase",
              tx.direction === 'BUY' ? "bg-[var(--danger)]/20 text-[var(--danger)]" :
                tx.direction === 'SELL' ? "bg-[var(--success)]/20 text-[var(--success)]" : "bg-orange-400/10 text-orange-400"
            )}>
              {tx.direction === 'BUY' ? '買入' : tx.direction === 'SELL' ? '賣出' : '配息'}
            </div>
            {isUS && (
              <span className="text-[7px] font-black text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded leading-none">US</span>
            )}
            {isTxRealized(tx) && (
              <span className="text-[8px] font-bold text-[var(--text-dim)] opacity-60 scale-90 whitespace-nowrap">(已實現)</span>
            )}
          </div>
          <div className="truncate min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-mono font-bold text-[var(--text-dim)] opacity-60 leading-none">{tx.date}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(tx); }}
                  className="p-1.5 text-[var(--accent)] hover:bg-[var(--bg-primary)] rounded transition-all"
                  title="編輯此筆交易"
                >
                  <Edit2 size={10} />
                </button>
                {tx.direction === 'DIVIDEND' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleRealized(tx.id); }}
                    className={cn(
                      "w-5 h-5 flex items-center justify-center rounded-full transition-all border",
                      isTxRealized(tx)
                        ? "bg-[var(--text-dim)] text-[var(--bg-primary)] border-transparent" 
                        : "bg-transparent text-[var(--text-dim)] border-[var(--border)] opacity-30 hover:opacity-100"
                    )}
                    title={isTxRealized(tx) ? "取消標記為已實現" : "標記為已實現 (計入歷史損益)"}
                  >
                    <Check size={10} strokeWidth={4} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(tx.id); }}
                  className="p-1.5 text-[var(--danger)] hover:bg-[var(--bg-primary)] rounded transition-all opacity-100 md:opacity-0 group-hover:opacity-100"
                  title="刪除此筆交易"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
            <p className="text-[10px] md:text-xs text-[var(--text-main)] font-mono font-bold truncate leading-none">
              <span className="text-[var(--text-dim)] mr-1">數量:</span>
              {tx.quantity.toLocaleString(undefined, { maximumFractionDigits: isUS ? 4 : 2 })} 股
              <span className="mx-2 opacity-30">|</span>
              <span className="text-[var(--text-dim)] mr-1">單價:</span>
              {isUS ? (
                <span><span className="opacity-50 text-[10px]">$</span>{tx.unitPrice.toFixed(2)} <span className="opacity-40 text-[9px]">USD</span></span>
              ) : (
                <span><span className="opacity-50 text-[10px]">$</span>{tx.unitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              )}
            </p>
            {tx.notes && (
              <p className="text-xs md:text-[13px] text-[var(--text-main)] mt-1.5 flex items-center gap-1.5 max-w-[260px] md:max-w-[450px] leading-none" title={tx.notes}>
                <StickyNote size={12} className="text-[var(--accent)] shrink-0" />
                <span className="text-[var(--text-main)] font-semibold truncate flex-1">{tx.notes}</span>
              </p>
            )}
          </div>
        </div>

        {/* 右側：交易總額（放大 + 台幣結算） */}
        <div className="text-right shrink-0 flex flex-col justify-center ml-2 min-w-[80px]">
          <p className="text-[8px] text-[var(--text-dim)] uppercase tracking-widest font-black opacity-60 mb-1 leading-none">
            {isUS ? '交易金額' : '交易總額'}
          </p>
          {/* USD 金額 */}
          <p className={cn(
            "font-mono font-black leading-none",
            isUS ? "text-base md:text-lg" : "text-base md:text-lg",
            tx.direction === 'BUY' ? "text-[var(--danger)]" : tx.direction === 'DIVIDEND' ? "text-orange-400" : "text-[var(--success)]"
          )}>
            {isUS ? (
              <span>
                <span className="opacity-40 text-xs mr-0.5">$</span>
                {Math.abs(tx.totalAmount).toFixed(2)}
                <span className="text-[9px] opacity-40 ml-0.5">USD</span>
              </span>
            ) : (
              <span>
                <span className="opacity-40 text-xs mr-0.5">$</span>
                {Math.abs(tx.totalAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            )}
          </p>
          {/* 美股台幣結算金額（突出顯示） */}
          {isUS && tx.twdAmount != null && (
            <p className="text-sm md:text-base font-mono font-black text-blue-300 mt-1 leading-none">
              = NT${tx.twdAmount.toLocaleString('zh-TW', { maximumFractionDigits: 0 })}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
