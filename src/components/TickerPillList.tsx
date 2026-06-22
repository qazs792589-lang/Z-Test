import React, { useMemo, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { Database, Activity, X, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';

interface DraggablePillProps {
  ticker: string;
  name: string;
  isZero: boolean;
  isSelected: boolean;
  onSelect: (t: string) => void;
  onRename: (t: string) => void;
  onDelete: (t: string) => void;
  isEditing: boolean;
}

const DraggablePill: React.FC<DraggablePillProps> = ({
  ticker, name, isZero, isSelected, onSelect, onRename, onDelete, isEditing
}) => {
  const dragControls = useDragControls();
  
  return (
    <Reorder.Item
      key={ticker}
      value={ticker}
      dragListener={false}
      dragControls={dragControls}
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileDrag={{ 
        scale: 1.1, 
        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
        zIndex: 50 
      }}
      transition={{ type: "spring", stiffness: 500, damping: 30, mass: 1 }}
      style={{ touchAction: 'pan-x pan-y' }}
      className={cn(
        "px-4 py-2 rounded-2xl font-black text-xs whitespace-nowrap border shadow-sm flex items-center gap-2 transition-all hardware-accel no-select cursor-pointer relative",
        isSelected 
          ? "bg-[var(--accent)] text-[var(--bg-primary)] border-[var(--accent)] shadow-[0_0_15px_var(--accent-glow)]" 
          : (isZero 
              ? "bg-[var(--bg-secondary)] text-[var(--text-dim)] border-[var(--border)] opacity-40 border-dashed" 
              : "bg-[var(--bg-secondary)] text-[var(--text-main)] border-[var(--border)] hover:border-[var(--accent)]")
      )}
      onClick={() => !isEditing && onSelect(ticker)}
      onDoubleClick={() => onRename(ticker)}
    >
      {isEditing && (
        <div
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => dragControls.start(e)}
        >
          <GripVertical size={14} />
        </div>
      )}
      <span className="tracking-tight">{name}</span>
      {isZero && <span className="opacity-60 text-[9px] font-bold">(已清倉)</span>}
      {isEditing && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(ticker); }}
          className="ml-1 p-1 bg-black/20 hover:bg-[var(--danger)] hover:text-white rounded-full transition-all"
        >
          <X size={10} />
        </button>
      )}
    </Reorder.Item>
  );
};

interface TickerPillListProps {
  tickerOrder: string[];
  setTickerOrder: (order: string[]) => void;
  selectedTicker: string | null;
  setSelectedTicker: (t: string | null) => void;
  stockMap: Record<string, string>;
  holdingsMap: any;
  onRenameTicker: (t: string) => void;
  onDeleteTicker: (t: string) => void;
  onImportBackup: () => void;
  onUpdateMarket: () => void;
  isEditing: boolean;
  allTickers: string[];
}

export const TickerPillList: React.FC<TickerPillListProps> = ({
  tickerOrder, setTickerOrder, selectedTicker, setSelectedTicker, 
  stockMap, holdingsMap, onRenameTicker, onDeleteTicker, onImportBackup, onUpdateMarket,
  isEditing, allTickers
}) => {
  const [showZero, setShowZero] = useState(false);

  // Sync tickerOrder with allTickers to ensure every ticker is representable in the reorder group
  const effectiveOrder = useMemo(() => {
    const safeOrder = tickerOrder || [];
    const safeAll = allTickers || [];
    const order = [...safeOrder];
    // Add missing tickers to the end
    safeAll.forEach(t => {
      if (!order.includes(t)) order.push(t);
    });
    // Remove deleted tickers
    return order.filter(t => safeAll.includes(t));
  }, [allTickers, tickerOrder]);

  const sortedAndFilteredOrder = useMemo(() => {
    if (isEditing) {
      return effectiveOrder;
    }
    
    let list = [...effectiveOrder];
    
    // Sort: currentShares > 0 items go first
    list.sort((a, b) => {
      const aShares = holdingsMap[a]?.currentShares || 0;
      const bShares = holdingsMap[b]?.currentShares || 0;
      if (aShares > 0 && bShares <= 0) return -1;
      if (aShares <= 0 && bShares > 0) return 1;
      return 0;
    });

    // Filter: hide zero holdings if showZero is false
    if (!showZero) {
      list = list.filter(ticker => (holdingsMap[ticker]?.currentShares || 0) > 0);
    }
    
    return list;
  }, [effectiveOrder, holdingsMap, showZero, isEditing]);

  return (
    <div className="w-full relative pb-6 pt-2 flex items-center justify-between gap-4">
      <div className="overflow-x-auto scrollbar-none flex-1">
        <Reorder.Group 
          axis="x" 
          values={sortedAndFilteredOrder} 
          onReorder={setTickerOrder} 
          className="flex gap-2 min-w-max px-1"
        >
          {sortedAndFilteredOrder.map(ticker => (
            <DraggablePill
              key={ticker}
              ticker={ticker}
              name={stockMap[ticker] || ticker}
              isZero={(holdingsMap[ticker]?.currentShares || 0) <= 0}
              isSelected={selectedTicker === ticker}
              onSelect={setSelectedTicker}
              onRename={onRenameTicker}
              onDelete={onDeleteTicker}
              isEditing={isEditing}
            />
          ))}
        </Reorder.Group>
      </div>
      {!isEditing && (
        <button
          onClick={() => setShowZero(!showZero)}
          className="px-3 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm active:scale-95"
        >
          <Database size={10} />
          {showZero ? "收起" : "顯示"}
        </button>
      )}
    </div>
  );
};
