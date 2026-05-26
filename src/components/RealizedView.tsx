import { History, FileUp, ChevronDown, PieChart as PieChartIcon, Activity, TrendingUp, Edit2, Trash2, Plus, Layers, LineChart as LucideLineChart, Check, ChevronRight, Clock, Wallet, Coins } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { cn } from '../lib/utils';
import { RealizedProfit, Transaction, Holding } from '../types';
import { isTxRealized } from '../lib/txUtils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';

interface RealizedViewProps {
  appData: any;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpdateNotes: (txId: string, notes: string) => void;
  onToggleRealized: (txId: string) => void;
  netWorthEntries: {date: string, assets: Record<string, number>}[];
  setNetWorthEntries: React.Dispatch<React.SetStateAction<{date: string, assets: Record<string, number>}[]>>;
  historicalChartData: any[];
  tickerMetadata: Record<string, { assetClass?: string }>;
  holdings: Holding[];
  marketPrices: Record<string, number>;
}

export const RealizedView: React.FC<RealizedViewProps> = ({ 
  appData, onImport, onUpdateNotes, onToggleRealized, 
  netWorthEntries, setNetWorthEntries, historicalChartData = [],
  tickerMetadata = {}, holdings = [], marketPrices = {}
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedTickers, setExpandedTickers] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'details' | 'networth'>('details');

  // Asset Entry State
  const [nDate, setNDate] = useState(new Date().toISOString().split('T')[0]);
  const [newAssetValues, setNewAssetValues] = useState<Record<string, string>>({ '現金': '', '加密貨幣': '' });

  // Get all unique asset keys from history
  const assetKeys = useMemo(() => {
    const keys = new Set(['現金', '加密貨幣']);
    netWorthEntries.forEach(entry => {
      if (entry.assets) {
        Object.keys(entry.assets).forEach(k => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [netWorthEntries]);

  const handleAddCustomAssetType = () => {
    const name = window.prompt('請輸入新資產類別名稱 (例如：房地產、保險)：');
    if (name && !assetKeys.includes(name)) {
      setNewAssetValues(prev => ({ ...prev, [name]: '' }));
    }
  };

  const startEditing = (txId: string, currentNotes: string) => {
    setEditingId(txId);
    setEditValue(currentNotes || '');
  };

  const saveEdit = (txId: string) => {
    onUpdateNotes(txId, editValue);
    setEditingId(null);
  };

  const toggleExpand = (ticker: string) => {
    setExpandedTickers(prev => ({ ...prev, [ticker]: !prev[ticker] }));
  };

  const tickerHistory = useMemo(() => {
    if (!appData?.stockGroups) return [];
    const groups: Record<string, {
      name: string;
      transactions: any[];
      cumulativeProfit: number;
      cumulativeCost: number;
      cumulativeRevenue: number;
      isHolding: boolean;
    }> = {};

    Object.entries(appData.stockGroups).forEach(([ticker, txs]: [string, any]) => {
      const realizedItems = (appData.realizedList || []).filter((r: RealizedProfit) => r.ticker === ticker);
      if (realizedItems.length === 0) return;
      const currentShares = appData.holdingsMap?.[ticker]?.currentShares || 0;

      const totalProfit = realizedItems.reduce((sum: number, r: RealizedProfit) => sum + r.profit, 0);
      const totalRealizedCost = realizedItems.reduce((sum: number, r: RealizedProfit) => sum + r.totalCost, 0);
      const totalRevenue = realizedItems.reduce((sum: number, r: RealizedProfit) => sum + r.totalRevenue, 0);
      const totalRealizedShares = realizedItems.reduce((sum: number, r: RealizedProfit) => sum + (r.shares || 0), 0);

      const displayRows = [...txs].sort((a, b) => a.date.localeCompare(b.date)).map(tx => {
        const realizedInfo = realizedItems.find((r: RealizedProfit) => r.sellTxId === tx.id);
        // User requested: Skip ROI for dividends
        const isDividend = tx.direction === 'DIVIDEND';
        
        return {
          ...tx,
          realizedProfit: realizedInfo?.profit,
          realizedRoi: isDividend ? undefined : realizedInfo?.roi,
          daysHeld: realizedInfo?.daysHeld
        };
      });


      const lastOpDate = txs.reduce((latest: string, tx: any) => tx.date > latest ? tx.date : latest, '0000-00-00');

      groups[ticker] = {
        name: txs[0]?.name || ticker,
        transactions: displayRows,
        cumulativeProfit: totalProfit,
        cumulativeCost: totalRealizedCost,
        cumulativeRevenue: totalRevenue,
        cumulativeShares: totalRealizedShares,
        realizedCount: realizedItems.length,
        isHolding: currentShares > 0,
        lastOpDate
      };
    });

    return Object.entries(groups).sort((a, b) => {
      if (a[1].isHolding && !b[1].isHolding) return -1;
      if (!a[1].isHolding && b[1].isHolding) return 1;
      return b[1].lastOpDate.localeCompare(a[1].lastOpDate);
    });
  }, [appData?.stockGroups, appData?.realizedList, appData?.holdingsMap]);

  const globalRealized = useMemo(() => {
    const list = appData?.realizedList || [];
    const profit = list.reduce((sum: number, r: any) => sum + r.profit, 0);
    const cost = list.reduce((sum: number, r: any) => sum + r.totalCost, 0);
    const revenue = list.reduce((sum: number, r: any) => sum + r.totalRevenue, 0);
    const roi = cost > 0 ? (profit / cost) * 100 : 0;
    return { profit, cost, revenue, roi, count: list.length };
  }, [appData?.realizedList]);

  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {};
    
    // 1. Add Stock Holdings
    const holdings = appData?.holdingsMap ? Object.values(appData.holdingsMap) : [];
    holdings.forEach((h: any) => {
      if (!h.currentShares || h.currentShares <= 0) return;
      const curPrice = marketPrices[h.ticker] || h.avgCost;
      const value = curPrice * h.currentShares;
      const cat = tickerMetadata[h.ticker]?.assetClass || '股票';
      categories[cat] = (categories[cat] || 0) + value;
    });

    // 2. Add Custom Assets from latest Net Worth entry
    if (netWorthEntries && netWorthEntries.length > 0) {
      const sorted = [...netWorthEntries].sort((a, b) => b.date.localeCompare(a.date));
      const latest = sorted[0];
      if (latest.assets) {
        Object.entries(latest.assets).forEach(([name, val]) => {
          if (val > 0) categories[name] = (categories[name] || 0) + val;
        });
      }
    }

    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [appData?.holdingsMap, marketPrices, tickerMetadata, netWorthEntries]);

  const netWorthChartData = useMemo(() => {
    if (!netWorthEntries) return [];
    return netWorthEntries.map(entry => {
      const history = historicalChartData || [];
      const stockEntry = history.filter(d => d.name <= entry.date).reverse()[0] || history[0];
      const stockValue = stockEntry?.value || 0;
      
      let otherAssetsTotal = 0;
      if (entry.assets) {
        Object.values(entry.assets).forEach(v => otherAssetsTotal += (v || 0));
      } else {
        // Fallback for old data format
        otherAssetsTotal = ((entry as any).cash || 0) + ((entry as any).crypto || 0);
      }
      
      const total = otherAssetsTotal + stockValue;
      return {
        ...entry,
        stockValue,
        total
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [netWorthEntries, historicalChartData]);

  const COLORS = ['#7000ff', '#ff00c8', '#ffcc00', '#00ff88', '#ff4400', '#44ff00', '#888888', '#00f2ff', '#0066ff', '#33ffcc'];
  const CAT_COLORS: Record<string, string> = {
    '股票': '#00f2ff',
    '台股': '#00f2ff',
    '美股': '#7000ff',
    'ETF': '#ff00c8',
    '債券': '#ffcc00',
    '現金': '#00ff88',
    '加密貨幣': '#ff4400',
    '未分類': '#444444'
  };

  const currentTotalAssets = netWorthChartData[netWorthChartData.length - 1]?.total || 0;
  const prevTotalAssets = netWorthChartData[netWorthChartData.length - 2]?.total || currentTotalAssets;
  const assetsChange = currentTotalAssets - prevTotalAssets;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500 pb-20">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-black flex items-center gap-3">
            {activeTab === 'details' ? <History className="text-[var(--accent)]" /> : <Activity className="text-[var(--accent)]" />}
            {activeTab === 'details' ? '已實現損益' : '個人總資產'}
          </h2>
          <div className="flex md:hidden">
            <input type="file" ref={fileInputRef} onChange={onImport} accept=".csv" className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-dim)] active:scale-90 transition-all shadow-sm"
              title="匯入歷史 CSV"
            >
              <FileUp size={18} />
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border)]">
            <button 
              onClick={() => setActiveTab('details')}
              className={cn(
                "px-3 md:px-4 py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeTab === 'details' ? "bg-[var(--accent)] text-[var(--bg-primary)] shadow-lg" : "text-[var(--text-dim)]"
              )}
            >
              <PieChart size={14} /> 損益細節
            </button>
            <button 
              onClick={() => setActiveTab('networth')}
              className={cn(
                "px-3 md:px-4 py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeTab === 'networth' ? "bg-[var(--accent)] text-[var(--bg-primary)] shadow-lg" : "text-[var(--text-dim)]"
              )}
            >
              <LucideLineChart size={14} /> 總資產
            </button>
          </div>

          <div className="hidden md:flex">
            <input type="file" ref={fileInputRef} onChange={onImport} accept=".csv" className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[10px] font-black text-[var(--text-dim)] hover:text-[var(--accent)] transition-all uppercase tracking-widest shadow-sm"
            >
              <FileUp size={14} /> 匯入歷史 CSV
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'details' ? (
        <div className="space-y-6">
          {/* Global Realized Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            {/* 1. Cost Card */}
            <div className="elegant-card p-4 md:p-6 bg-gradient-to-br from-[var(--bg-secondary)]/80 to-[var(--bg-tertiary)]/80 backdrop-blur-md border-[var(--border)] group hover:border-[var(--accent)]/50 transition-all duration-500">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-[var(--text-dim)]/5 text-[var(--text-dim)] group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)] transition-all duration-500">
                  <Wallet size={16} />
                </div>
                <span className="text-[10px] md:text-xs text-[var(--text-dim)] font-black uppercase tracking-[0.15em]">歷史總成本</span>
              </div>
              <p className="text-xl md:text-2xl font-mono font-black text-[var(--text-main)] tracking-tight">
                ${globalRealized.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>

            {/* 2. Revenue Card */}
            <div className="elegant-card p-4 md:p-6 bg-gradient-to-br from-[var(--bg-secondary)]/80 to-[var(--bg-tertiary)]/80 backdrop-blur-md border-[var(--border)] group hover:border-[var(--accent)]/50 transition-all duration-500">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-[var(--text-dim)]/5 text-[var(--accent)] group-hover:bg-[var(--accent)]/10 transition-all duration-500">
                  <TrendingUp size={16} />
                </div>
                <span className="text-[10px] md:text-xs text-[var(--text-dim)] font-black uppercase tracking-[0.15em]">歷史總收入</span>
              </div>
              <p className="text-xl md:text-2xl font-mono font-black text-[var(--text-main)] tracking-tight">
                ${globalRealized.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>

            {/* 3. Transaction Count Card (2nd row on mobile) */}
            <div className="elegant-card p-4 md:p-6 bg-gradient-to-br from-[var(--bg-secondary)]/80 to-[var(--bg-tertiary)]/80 backdrop-blur-md border-[var(--border)] group hover:border-[var(--accent)]/50 transition-all duration-500">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-[var(--text-dim)]/5 text-[var(--text-dim)] group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)] transition-all duration-500">
                  <Activity size={16} />
                </div>
                <span className="text-[10px] md:text-xs text-[var(--text-dim)] font-black uppercase tracking-[0.15em]">交易筆數</span>
              </div>
              <p className="text-xl md:text-2xl font-mono font-black text-[var(--text-main)] tracking-tight">
                {globalRealized.count} <span className="text-[10px] font-bold text-[var(--text-dim)] ml-1 opacity-60">筆</span>
              </p>
            </div>

            {/* 4. Profit Card (2nd row on mobile) */}
            <div className="elegant-card p-4 md:p-6 bg-gradient-to-br from-[var(--bg-secondary)]/80 to-[var(--bg-tertiary)]/80 backdrop-blur-md border-[var(--success)]/10 shadow-xl shadow-[var(--success)]/5 group hover:border-[var(--success)]/40 transition-all duration-500">
              <div className="flex items-center gap-2 mb-4">
                <div className={cn("p-2 rounded-xl transition-all duration-500", globalRealized.profit >= 0 ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--danger)]/10 text-[var(--danger)]")}>
                  <Coins size={16} />
                </div>
                <span className="text-[10px] md:text-xs text-[var(--text-dim)] font-black uppercase tracking-[0.15em]">歷史總收益</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className={cn("text-xl md:text-3xl font-mono font-black tracking-tight", globalRealized.profit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
                  {globalRealized.profit >= 0 ? '+' : ''}{globalRealized.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <span className={cn("text-[10px] md:text-xs font-black font-mono px-2 py-0.5 rounded-full", globalRealized.roi >= 0 ? "text-[var(--success)] bg-[var(--success)]/10" : "text-[var(--danger)] bg-[var(--danger)]/10")}>
                  {globalRealized.roi >= 0 ? '▲' : '▼'}{Math.abs(globalRealized.roi).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {tickerHistory.map(([ticker, group]: [string, any]) => {
            return (
              <div key={ticker} className="elegant-card overflow-hidden border-[var(--border)] shadow-xl">
                <div 
                  onClick={() => toggleExpand(ticker)}
                  className="bg-[var(--bg-secondary)] p-4 md:p-6 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors border-b border-[var(--border)]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="text-[var(--accent)] transition-transform duration-300" style={{ transform: expandedTickers[ticker] !== false ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                        <ChevronDown size={20} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-lg md:text-xl font-black text-[var(--text-main)] uppercase tracking-tight">{group.name}</span>
                          {group.isHolding && (
                            <span className="bg-[var(--accent)]/10 text-[var(--accent)] text-[9px] px-2 py-0.5 rounded-md font-bold border border-[var(--accent)]/20">
                              仍持倉中
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[var(--text-dim)] font-mono font-bold tracking-widest">{ticker}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn("text-lg md:text-xl font-mono font-black", group.cumulativeProfit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
                          {group.cumulativeProfit >= 0 ? '+' : ''}{(group.cumulativeProfit || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        {group.cumulativeCost > 0 && (
                          <div className={cn("text-[10px] font-bold flex items-center gap-1", group.cumulativeProfit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
                            {group.cumulativeProfit >= 0 ? '▲' : '▼'} {group.cumulativeCost > 0 ? ((group.cumulativeProfit / group.cumulativeCost) * 100).toFixed(2) : '0.00'}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Header Metrics */}
                  <div className="grid grid-cols-4 gap-2 md:gap-4 pt-5 border-t border-[var(--border)]/50 mt-4">
                    <div className="flex flex-col">
                      <span className="text-[8px] md:text-[10px] text-[var(--text-dim)] font-black uppercase tracking-[0.1em] mb-1.5 flex items-center gap-1.5">
                        <Activity size={10} className="opacity-40" /> 交易筆數
                      </span>
                      <span className="text-xs md:text-lg font-mono font-black text-[var(--text-main)]">
                        {group.realizedCount} <span className="text-[8px] font-bold text-[var(--text-dim)] ml-0.5 opacity-40">筆</span>
                      </span>
                    </div>
                    <div className="flex flex-col border-l border-[var(--border)]/30 pl-2">
                      <span className="text-[8px] md:text-[10px] text-[var(--text-dim)] font-black uppercase tracking-[0.1em] mb-1.5 flex items-center gap-1.5">
                        <Wallet size={10} className="opacity-40" /> 歷史成本
                      </span>
                      <span className="text-xs md:text-lg font-mono font-black text-[var(--text-main)]">
                        ${(group.cumulativeCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex flex-col border-l border-[var(--border)]/30 pl-2">
                      <span className="text-[8px] md:text-[10px] text-[var(--text-dim)] font-black uppercase tracking-[0.1em] mb-1.5 flex items-center gap-1.5">
                        <TrendingUp size={10} className="opacity-40" /> 歷史收入
                      </span>
                      <span className="text-xs md:text-lg font-mono font-bold text-[var(--text-main)]">
                        ${(group.cumulativeRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex flex-col text-right border-l border-[var(--border)]/30 pl-2">
                      <span className="text-[8px] md:text-[10px] text-[var(--text-dim)] font-black uppercase tracking-[0.1em] mb-1.5 flex items-center justify-end gap-1.5">
                        <Coins size={10} className="opacity-40" /> 已結損益
                      </span>
                      <span className={cn("text-xs md:text-lg font-mono font-black", group.cumulativeProfit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
                        {group.cumulativeProfit >= 0 ? '+' : ''}{(group.cumulativeProfit || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>

                {expandedTickers[ticker] !== false && (
                  <div className="overflow-x-auto custom-scrollbar bg-[var(--bg-primary)]/50">
                    <table className="w-full text-left min-w-[800px]">
                      <thead>
                        <tr className="text-[9px] text-[var(--text-dim)] font-black uppercase tracking-widest border-b border-[var(--border)] bg-[var(--bg-tertiary)]/30">
                          <th className="px-6 py-4 text-center whitespace-nowrap">日期</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">單價</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">股數</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">額外費用</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">淨收支</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">已結損益</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">ROI%</th>
                          <th className="px-6 py-4 text-right whitespace-nowrap">備註</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {group.transactions.map((tx: any) => {
                          const isBuy = tx.direction === 'BUY';
                          const isSell = tx.direction === 'SELL';
                          const isDividend = tx.direction === 'DIVIDEND';
                          const totalFees = (tx.fee || 0) + (tx.tax || 0);
                          
                          // Cash Flow Logic: BUY is negative (outflow), SELL/DIVIDEND is positive (inflow)
                          const cashFlow = isBuy ? -tx.totalAmount : Math.abs(tx.totalAmount);
                          
                          // Shares sign: BUY is NEGATIVE (green), SELL is POSITIVE (red)
                          const displayQty = isBuy ? -tx.quantity : (isSell ? tx.quantity : 0);
                          
                          return (
                            <tr key={tx.id} className={cn("hover:bg-[var(--bg-secondary)]/30 transition-colors", !isTxRealized(tx) && "bg-[var(--bg-tertiary)]/50")}>
                              <td className="px-6 py-4 font-mono text-xs text-center whitespace-nowrap">{tx.date}</td>
                              <td className="px-6 py-4 font-mono text-xs text-right text-[var(--text-dim)] whitespace-nowrap">
                                {isDividend ? '-' : `$${(tx.unitPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                              </td>
                              <td className={cn("px-6 py-4 font-mono text-xs font-bold text-right whitespace-nowrap", 
                                isBuy ? "text-[var(--danger)]" : (isSell ? "text-[var(--success)]" : "text-[var(--text-dim)]")
                              )}>
                                {displayQty !== 0 ? `${displayQty > 0 ? '+' : ''}${displayQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                              </td>
                              <td className="px-6 py-4 font-mono text-xs text-right text-[var(--text-main)] whitespace-nowrap">
                                {totalFees > 0 ? `$${totalFees.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                              </td>
                              <td className={cn("px-6 py-4 font-mono text-xs font-black text-right whitespace-nowrap", 
                                isDividend ? "text-amber-500" : (cashFlow >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")
                              )}>
                                {cashFlow !== 0 ? `${cashFlow > 0 ? '+' : ''}${cashFlow.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                              </td>
                              <td className={cn("px-6 py-4 font-mono text-xs font-bold text-right whitespace-nowrap", 
                                isDividend ? "text-amber-500" : (tx.realizedProfit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")
                              )}>
                                {tx.realizedProfit !== undefined ? `${tx.realizedProfit >= 0 ? '+' : ''}${tx.realizedProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                {tx.realizedRoi !== undefined ? (
                                  <span className={cn("text-[10px] px-2 py-0.5 rounded font-bold whitespace-nowrap", tx.realizedRoi >= 0 ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--danger)]/10 text-[var(--danger)]")}>
                                    {tx.realizedRoi.toFixed(1)}%
                                  </span>
                                ) : '-'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {editingId === tx.id ? (
                                  <input
                                    autoFocus
                                    className="elegant-input text-xs md:text-[13px] h-8 px-2 w-full max-w-[180px] ml-auto font-semibold"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={() => saveEdit(tx.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEdit(tx.id);
                                      if (e.key === 'Escape') setEditingId(null);
                                    }}
                                  />
                                ) : (
                                  <div 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditing(tx.id, tx.notes || '');
                                    }}
                                    className="text-xs md:text-[13px] text-[var(--text-main)] font-semibold truncate max-w-[180px] ml-auto cursor-pointer hover:text-[var(--accent)] transition-colors"
                                    title="點擊編輯備註"
                                  >
                                    {tx.notes || <span className="opacity-30">新增備註...</span>}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Net Worth Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="elegant-card p-5 bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)]">
              <span className="text-[9px] text-[var(--text-dim)] font-black uppercase tracking-widest block mb-1">目前總淨資產</span>
              <p className="text-2xl md:text-3xl font-mono font-black text-[var(--text-main)]">
                ${(currentTotalAssets || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="elegant-card p-5 bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)]">
              <span className="text-[9px] text-[var(--text-dim)] font-black uppercase tracking-widest block mb-1">近期資產變動</span>
              <p className={cn("text-2xl md:text-3xl font-mono font-black", assetsChange >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
                {assetsChange >= 0 ? '+' : ''}{(assetsChange || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {/* Asset Category Allocation Chart */}
          {categoryData.length > 0 && (
            <div className="elegant-card p-5 relative border-[var(--border)] shadow-xl bg-opacity-40">
              <h4 className="text-[10px] font-black opacity-60 flex items-center gap-2 mb-6 uppercase tracking-[0.2em] text-[var(--accent)]">
                <PieChartIcon size={12} /> 資產類別權重
              </h4>
              <div className="flex items-center gap-6">
                <div className="w-1/2 h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoryData.map((entry, index) => {
                          const color = CAT_COLORS[entry.name] || COLORS[index % COLORS.length];
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {categoryData.map((item, index) => {
                    const color = CAT_COLORS[item.name] || COLORS[index % COLORS.length];
                    return (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-[10px] font-bold text-[var(--text-dim)]">{item.name}</span>
                        </div>
                        <span className="text-[10px] font-mono font-black text-[var(--text-main)]">
                          {((item.value / (categoryData.reduce((acc, curr) => acc + curr.value, 0) || 1)) * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Chart Section */}
          <div className="elegant-card p-6">
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-main)] mb-6 flex items-center gap-2">
              <Activity size={14} className="text-[var(--accent)]" /> 總資產成長趨勢 (Net Worth)
            </h4>
            <div className="h-[300px] md:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={netWorthChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                  <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={10} axisLine={false} tickLine={false} tickMargin={10} tickFormatter={(str) => str?.split('-')?.slice(1)?.join('/') || str} />
                  <YAxis stroke="var(--text-dim)" fontSize={10} axisLine={false} tickLine={false} tickMargin={10} width={60} tickFormatter={(v) => `$${((v || 0)/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px' }}
                    formatter={(v: any) => [`$${(v || 0).toLocaleString()}`, '總資產']}
                  />
                  <Area type="monotone" dataKey="total" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Asset Allocation Form */}
          <div className="elegant-card p-6 bg-opacity-40 backdrop-blur-md border-[var(--border)] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Layers size={120} />
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-[var(--text-main)]">記錄資產分配</h4>
                  <p className="text-[10px] text-[var(--text-dim)] font-bold mt-0.5">手動登記非股票資產以計算總淨值</p>
                </div>
              </div>
              <button 
                onClick={handleAddCustomAssetType}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--accent)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-[var(--bg-primary)] transition-all group"
              >
                <Plus size={14} className="group-hover:scale-110 transition-transform" /> 
                新增資產類別
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-5 items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-dim)] ml-1">記錄日期</label>
                <input 
                  type="date" 
                  className="elegant-input text-xs h-12 px-4 bg-[var(--bg-secondary)]"
                  value={nDate}
                  onChange={(e) => setNDate(e.target.value)}
                />
              </div>
              
              {assetKeys.map(key => (
                <div key={key} className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--text-dim)] ml-1">{key}</label>
                  <input 
                    type="number" 
                    className="elegant-input text-xs h-12 px-4 bg-[var(--bg-secondary)]"
                    placeholder="0"
                    value={newAssetValues[key] || ''}
                    onChange={(e) => setNewAssetValues(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}

              <button 
                onClick={() => {
                  const assets: Record<string, number> = {};
                  Object.entries(newAssetValues).forEach(([k, v]) => {
                    assets[k] = parseFloat(v) || 0;
                  });
                  
                  setNetWorthEntries(prev => {
                    const others = prev.filter(p => p.date !== nDate);
                    return [...others, { date: nDate, assets }]
                      .sort((a, b) => b.date.localeCompare(a.date));
                  });
                  
                  const cleared: Record<string, string> = {};
                  assetKeys.forEach(k => cleared[k] = '');
                  setNewAssetValues(cleared);
                  alert('資產分配已成功記錄！');
                }}
                className="bg-[var(--accent)] text-[var(--bg-primary)] h-12 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[var(--accent)]/20"
              >
                儲存當前分配
              </button>
            </div>
          </div>

          {/* Historical Data Table */}
          <div className="elegant-card p-0 overflow-hidden border-[var(--border)] shadow-xl">
            <div className="p-6 border-b border-[var(--border)] bg-[var(--bg-secondary)]/50 flex items-center justify-between">
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-main)] flex items-center gap-2">
                <History size={14} className="text-[var(--accent)]" /> 歷史紀錄清單
              </h4>
              <span className="text-[9px] font-bold text-[var(--text-dim)] bg-[var(--bg-tertiary)] px-2 py-1 rounded text-uppercase">
                共 {netWorthEntries.length} 筆資料
              </span>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[900px]">
                <thead>
                  <tr className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-[0.2em] bg-[var(--bg-tertiary)]/20 border-b border-[var(--border)]">
                    <th className="px-6 py-5">日期</th>
                    {assetKeys.map(key => (
                      <th key={key} className="px-6 py-5">{key}</th>
                    ))}
                    <th className="px-6 py-5">股票市值</th>
                    <th className="px-6 py-5 text-right">總淨值 (Net Worth)</th>
                    <th className="px-6 py-5 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {[...netWorthChartData].reverse().map((entry, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-secondary)]/30 transition-colors group">
                      <td className="px-6 py-5 font-mono text-xs font-black text-[var(--text-main)]">{entry.date}</td>
                      {assetKeys.map(key => {
                        const val = entry.assets?.[key] || (entry as any)[key === '現金' ? 'cash' : (key === '加密貨幣' ? 'crypto' : '')] || 0;
                        return (
                          <td key={key} className={cn("px-6 py-5 font-mono text-xs", (val || 0) < 0 ? "text-[var(--success)]" : "text-[var(--text-dim)]")}>
                            ${(val || 0).toLocaleString()}
                          </td>
                        );
                      })}
                      <td className="px-6 py-5 font-mono text-xs text-[var(--accent)] font-bold">
                        ${(entry.stockValue || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="font-mono font-black text-sm text-[var(--text-main)] bg-[var(--accent)]/5 px-2 py-1 rounded">
                          ${(entry.total || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button 
                          onClick={() => {
                            if (window.confirm('確定要刪除這筆資產紀錄嗎？')) {
                              setNetWorthEntries(prev => prev.filter(p => p.date !== entry.date));
                            }
                          }}
                          className="p-2 text-[var(--text-dim)] hover:text-[var(--danger)] transition-all md:opacity-0 md:group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {netWorthEntries.length === 0 && (
                    <tr>
                      <td colSpan={assetKeys.length + 4} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center opacity-20">
                          <History size={40} className="mb-4" />
                          <p className="text-xs font-black uppercase tracking-widest">目前尚無紀錄</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
