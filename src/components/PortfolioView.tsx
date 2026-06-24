import React, { useMemo, useState, useEffect } from 'react';
import { LayoutDashboard, Activity, Edit2, TrendingUp, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, Layers, Trash2, Calendar, X } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  PieChart,
  Pie,
  Cell,
  Label,
  ReferenceArea
} from 'recharts';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Holding } from '../types';

interface PortfolioViewProps {
  isUsSector?: boolean;
  stats: {
    totalInvested: number;
    totalMarketValue: number;
    unrealizedPL: number;
    roi: number;
    unrealizedRoi: number;
  };
  chartData: any[];
  appData: {
    activeHoldings: Holding[];
    holdingsMap?: Record<string, any>;
  };
  marketData: {
    prices: Record<string, number>;
  };
  weeklyPrices: any[];
  setSelectedTicker: (ticker: string) => void;
  setActiveView: (view: 'A' | 'B' | 'C' | 'D' | 'E') => void;
  tickerOrder: string[];
  setWeeklyPrices: React.Dispatch<React.SetStateAction<any[]>>;
  tickerMetadata: Record<string, { assetClass?: string }>;
  onUpdateAssetClass: (ticker: string, assetClass: string) => void;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  isUsSector = false,
  stats,
  chartData,
  appData,
  marketData,
  weeklyPrices,
  setSelectedTicker,
  setActiveView,
  tickerOrder,
  setWeeklyPrices,
  tickerMetadata,
  onUpdateAssetClass
}) => {
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<'ratio' | 'absolute'>('ratio');
  const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0]);
  const [mPrice, setMPrice] = useState('');
  const [selectedUsTicker, setSelectedUsTicker] = useState('^GSPC');
  const activeTicker = isUsSector ? selectedUsTicker : '^TWII';

  // 績效測量工具相關 States
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [measurementData, setMeasurementData] = useState<{
    startDate: string;
    endDate: string;
    days: number;
    bars: number;
    portfolioChange: number;
    portfolioAbsChange: number;
    benchChanges: Record<string, number>;
    benchAbsChanges: Record<string, number>;
  } | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleMeasurementEnd = () => {
    if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
      const [start, end] = refAreaLeft.localeCompare(refAreaRight) <= 0 
        ? [refAreaLeft, refAreaRight] 
        : [refAreaRight, refAreaLeft];
      
      const rangeData = chartData.filter(d => d.name >= start && d.name <= end);
      if (rangeData.length >= 2) {
        const startPt = rangeData[0];
        const endPt = rangeData[rangeData.length - 1];
        
        // Portfolio ROI Change (Ratio)
        const startPVal = 100 + (startPt.portfolioRoi || 0);
        const endPVal = 100 + (endPt.portfolioRoi || 0);
        const portfolioChange = ((endPVal / startPVal) - 1) * 100;

        // Portfolio Absolute Value Change (cumulative realized + unrealized profit change)
        const portfolioAbsChange = (endPt.totalPL || 0) - (startPt.totalPL || 0);
        
        const benchChanges: Record<string, number> = {};
        const benchAbsChanges: Record<string, number> = {};

        if (isUsSector) {
          const startSp = 100 + (startPt.sp500Roi || 0);
          const endSp = 100 + (endPt.sp500Roi || 0);
          benchChanges['標普 500'] = ((endSp / startSp) - 1) * 100;
          benchAbsChanges['標普 500'] = (endPt.sp500Price || 0) - (startPt.sp500Price || 0);
          
          const startNas = 100 + (startPt.nasdaqRoi || 0);
          const endNas = 100 + (endPt.nasdaqRoi || 0);
          benchChanges['那斯達克'] = ((endNas / startNas) - 1) * 100;
          benchAbsChanges['那斯達克'] = (endPt.nasdaqPrice || 0) - (startPt.nasdaqPrice || 0);
          
          const startDow = 100 + (startPt.dowRoi || 0);
          const endDow = 100 + (endPt.dowRoi || 0);
          benchChanges['道瓊工業'] = ((endDow / startDow) - 1) * 100;
          benchAbsChanges['道瓊工業'] = (endPt.dowPrice || 0) - (startPt.dowPrice || 0);
        } else {
          const startM = 100 + (startPt.marketRoi || 0);
          const endM = 100 + (endPt.marketRoi || 0);
          benchChanges['台股大盤'] = ((endM / startM) - 1) * 100;
          benchAbsChanges['台股大盤'] = (endPt.marketPrice || 0) - (startPt.marketPrice || 0);
        }
        
        const t1 = new Date(start).getTime();
        const t2 = new Date(end).getTime();
        const days = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
        
        setMeasurementData({
          startDate: start,
          endDate: end,
          days,
          bars: rangeData.length,
          portfolioChange,
          portfolioAbsChange,
          benchChanges,
          benchAbsChanges
        });
      } else {
        setRefAreaLeft(null);
        setRefAreaRight(null);
      }
    } else {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      setMeasurementData(null);
    }
  };

  const allTickers = useMemo(() => {
    // Get all tickers that have ever appeared in chartData
    const dataTickers = new Set<string>();
    chartData.forEach(row => {
      Object.keys(row.breakdown || {}).forEach(t => dataTickers.add(t));
    });

    // Sort them based on the global tickerOrder from props
    // Tickers not in tickerOrder will be placed at the end
    return Array.from(dataTickers).sort((a, b) => {
      const indexA = tickerOrder.indexOf(a);
      const indexB = tickerOrder.indexOf(b);
      
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [chartData, tickerOrder]);

  const pieData = useMemo(() => {
    const holdings = appData.activeHoldings || [];
    return holdings.map(h => {
      const latestWeekly = weeklyPrices
        .filter(wp => wp.ticker === h.ticker)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.price;
      const curPrice = marketData.prices[h.ticker] || latestWeekly || h.avgCost;
      return {
        name: h.name,
        value: curPrice * h.currentShares,
        ticker: h.ticker
      };
    }).sort((a, b) => b.value - a.value);
  }, [appData.activeHoldings, marketData.prices, weeklyPrices]);

  const categoryData = useMemo(() => {
    const holdings = appData.activeHoldings || [];
    const categories: Record<string, number> = {};
    
    holdings.forEach(h => {
      const latestWeekly = weeklyPrices
        .filter(wp => wp.ticker === h.ticker)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.price;
      const curPrice = marketData.prices[h.ticker] || latestWeekly || h.avgCost;
      const value = curPrice * h.currentShares;
      const cat = tickerMetadata[h.ticker]?.assetClass || '未分類';
      categories[cat] = (categories[cat] || 0) + value;
    });

    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [appData.activeHoldings, marketData.prices, weeklyPrices, tickerMetadata]);

  const COLORS = ['#00f2ff', '#7000ff', '#ff00c8', '#ffcc00', '#00ff88', '#ff4400', '#44ff00', '#888888'];
  const CAT_COLORS: Record<string, string> = {
    '台股': '#00f2ff',
    '美股': '#7000ff',
    'ETF': '#ff00c8',
    '債券': '#ffcc00',
    '現金': '#00ff88',
    '加密貨幣': '#ff4400',
    '未分類': '#444444'
  };

  return (
    <div className="flex flex-col gap-8 pb-20 overflow-hidden">
      {/* 1. Header & Stats */}
      <div className="space-y-6 px-1">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <LayoutDashboard className="text-[var(--accent)]" /> 未實現損益
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stat-box group hover:border-[var(--accent)] transition-all duration-300">
            <div className="stat-label flex items-center gap-2">
              <TrendingUp size={12} className="opacity-50" /> 總投入本金
            </div>
            <div className="stat-value text-[var(--text-main)] text-2xl font-mono">${stats.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
          <div className="stat-box border-[var(--accent)]/50 bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] shadow-[0_0_20px_var(--accent-glow)]">
            <div className="stat-label flex items-center gap-2">
              <PieChartIcon size={12} className="text-[var(--accent)]" /> 當前總市值 (含息)
            </div>
            <div className="stat-value text-[var(--accent)] text-2xl font-mono">${stats.totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          </div>
          <div className={cn("stat-box transition-all duration-500", stats.unrealizedPL >= 0 ? "border-[var(--success)]/50 shadow-[0_0_15px_rgba(255,69,58,0.1)]" : "border-[var(--danger)]/50 shadow-[0_0_15px_rgba(50,215,75,0.1)]")}>
            <div className="stat-label flex items-center gap-2">
              <Activity size={12} className={stats.unrealizedPL >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"} /> 帳面總損益 (含息)
            </div>
            <div className={cn("stat-value text-2xl font-mono", stats.unrealizedPL >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
              {stats.unrealizedPL >= 0 ? '+' : ''}{stats.unrealizedPL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              <span className="text-xs ml-2 opacity-60 font-sans tracking-normal">({stats.unrealizedRoi >= 0 ? '+' : ''}{stats.unrealizedRoi.toFixed(2)}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Page Indicators */}
      <div className="flex justify-center gap-4 px-1 -mt-2 -mb-2 relative z-50">
        {[0, 1, 2].map(i => (
          <button
            key={i}
            onClick={() => setPage(i)}
            className="group py-4 px-3 outline-none cursor-pointer"
          >
            <div className={cn(
              "h-1.5 rounded-full transition-all duration-500 ease-out",
              page === i
                ? "bg-[var(--accent)] w-10 shadow-[0_0_15px_var(--accent-glow)]"
                : "bg-[var(--text-dim)] w-3 opacity-40 group-hover:opacity-100"
            )} />
          </button>
        ))}
      </div>

      {/* 3. Swiper Content */}
      <div className="relative overflow-visible">
        <motion.div
          className="flex w-full"
          animate={{ x: `-${page * 100}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {/* Page 1: Allocation & Holdings */}
          <div className="w-full shrink-0 px-1 space-y-10">
            <div className="elegant-card p-6 relative">
              <h3 className="text-[10px] font-black opacity-60 flex items-center gap-2 mb-8 uppercase tracking-[0.2em] text-[var(--accent)]">
                <PieChartIcon size={12} /> 資產配置比例
              </h3>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 w-full h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-3 rounded-xl shadow-2xl backdrop-blur-md">
                                <div className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-widest border-b border-[var(--border)] pb-2 mb-2">{data.name}</div>
                                <div className="flex justify-between gap-6">
                                  <span className="text-[11px] font-bold text-[var(--text-dim)]">市值</span>
                                  <span className="text-xs font-mono font-black text-[var(--text-main)]">${data.value.toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="md:w-1/3 w-full grid grid-cols-2 md:grid-cols-1 gap-3">
                  {pieData.slice(0, 6).map((item, index) => (
                    <div key={item.ticker} className="flex items-center justify-between p-2.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-[11px] font-bold text-[var(--text-main)] truncate w-20">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-mono font-black text-[var(--accent)]">
                        {((item.value / (stats.totalMarketValue || 1)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-[10px] font-black opacity-60 flex items-center gap-2 uppercase tracking-[0.2em]">
                <Edit2 size={12} /> 當前持倉明細
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...appData.activeHoldings]
                  .sort((a, b) => {
                    const idxA = tickerOrder.indexOf(a.ticker);
                    const idxB = tickerOrder.indexOf(b.ticker);
                    if (idxA === -1 && idxB === -1) return 0;
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                  })
                  .map(h => {
                    const latestWeekly = weeklyPrices.filter(wp => wp.ticker === h.ticker).sort((a, b) => b.date.localeCompare(a.date))[0]?.price;
                    const curPrice = marketData.prices[h.ticker] || latestWeekly || h.avgCost;
                    const hpl = (curPrice - h.avgCost) * h.currentShares;
                    const hroi = h.avgCost > 0 ? (hpl / h.totalInvested) * 100 : 0;
                    return (
                      <div key={h.ticker} className="elegant-card p-5 md:p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-[var(--border)] hover:border-[var(--accent)] transition-all group relative">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="text-2xl font-black text-[var(--text-main)] leading-none tracking-tight">{h.name}</h4>
                              <button onClick={() => { setSelectedTicker(h.ticker); setActiveView('A'); }} className="opacity-40 group-hover:opacity-100 text-[var(--accent)] transition-opacity">
                                <Edit2 size={14} />
                              </button>
                            </div>
                            <span className="text-xs text-[var(--text-dim)] font-mono font-bold uppercase tracking-widest">{h.ticker}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-mono font-black text-[var(--accent)] leading-none">
                              {h.currentShares.toLocaleString()}
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] mt-1 opacity-60">
                              持有股數
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-6 border-t border-[var(--border)]/50">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-widest opacity-60 mb-2">最新收盤價</span>
                            <span className="text-lg font-mono font-black text-[var(--text-main)]">${curPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-widest opacity-60 mb-2">總市值</span>
                            <span className="text-lg font-mono font-black text-[var(--accent)]">${(curPrice * h.currentShares).toLocaleString()}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-widest opacity-60 mb-2">平均成本</span>
                            <span className="text-base font-mono font-bold text-[var(--text-dim)]">${h.avgCost.toFixed(2)}</span>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-widest opacity-60 mb-2">帳面損益 / 報酬率</span>
                            <div className={cn("flex flex-col items-end", hpl >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
                              <span className="text-lg font-mono font-black leading-none">{hpl >= 0 ? '+' : ''}{hpl.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              <span className="text-xs font-black mt-1">{hroi >= 0 ? '▲' : '▼'} {Math.abs(hroi).toFixed(2)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Page 2: Trend & Matrix */}
          <div className="w-full shrink-0 px-1 space-y-10">
            <div className="elegant-card p-0 overflow-hidden relative border-[var(--border)] shadow-2xl">
              <div className="p-5 pb-0 flex items-center justify-between">
                <h3 className="text-[11px] font-black opacity-80 flex items-center gap-2 uppercase tracking-[0.2em] text-[var(--text-main)]">
                  <div className="p-1.5 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                    <Activity size={14} />
                  </div>
                  資產價值趨勢
                </h3>
              </div>
              <div className="h-[340px] relative px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis
                      dataKey="name"
                      stroke="var(--text-dim)"
                      fontSize={9}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={12}
                      minTickGap={40}
                      tickFormatter={(str) => str.split('-').slice(1).join('/')}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="var(--text-dim)"
                      fontSize={9}
                      axisLine={false}
                      tickLine={false}
                      domain={['auto', 'auto']}
                      tickMargin={8}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="var(--success)"
                      fontSize={9}
                      axisLine={false}
                      tickLine={false}
                      domain={['auto', 'auto']}
                      tickMargin={8}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      width={40}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const originalPoint = chartData.find(d => d.name === label) || payload[0].payload;
                          const roi = originalPoint.cost > 0 ? (originalPoint.profit / originalPoint.cost) * 100 : 0;
                          return (
                            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-4 rounded-2xl shadow-2xl backdrop-blur-xl bg-opacity-80">
                              <div className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-widest border-b border-[var(--border)] pb-2.5 mb-2.5 flex items-center justify-between gap-4">
                                <span>{label?.toString().replace(/-/g, '/')}</span>
                                <span className="opacity-40 font-mono font-normal">WEEKLY REPORT</span>
                              </div>
                              <div className="space-y-2">
                                {[
                                  { 
                                    label: viewMode === 'absolute' ? '資產金額' : '市值', 
                                    value: viewMode === 'absolute' ? originalPoint.adjustedValue : originalPoint.value, 
                                    color: 'var(--accent)' 
                                  },
                                  { label: '成本', value: originalPoint.cost, color: 'var(--danger)' }
                                ].sort((a, b) => b.value - a.value).map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between gap-10">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                                      <span className="text-[11px] font-bold text-[var(--text-dim)]">{item.label}</span>
                                    </div>
                                    <span className="text-xs font-mono font-black text-[var(--text-main)]">${item.value.toLocaleString()}</span>
                                  </div>
                                ))}
                                <div className="flex items-center justify-between gap-10 border-t border-[var(--border)] pt-2 mt-2">
                                  <div className="flex items-center gap-2">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", originalPoint.profit >= 0 ? "bg-[var(--success)]" : "bg-[var(--danger)]")} />
                                    <span className="text-[11px] font-bold text-[var(--text-dim)]">盈虧</span>
                                  </div>
                                  <span className={cn("text-xs font-mono font-black", originalPoint.profit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
                                    {originalPoint.profit >= 0 ? '+' : ''}{originalPoint.profit.toLocaleString()}
                                    <span className="text-[10px] ml-1.5 opacity-80 font-sans tracking-normal">
                                      ({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{
                        paddingBottom: '25px',
                        paddingTop: '0px',
                        fontSize: '9px',
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        opacity: 0.8
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      name="當前市值"
                      dataKey="value"
                      stroke="var(--accent)" strokeWidth={4} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--accent)' }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      name="投入成本"
                      dataKey="cost"
                      stroke="var(--danger)" strokeWidth={2} strokeDasharray="5 5" opacity={0.6} dot={false} activeDot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      name="帳面盈虧"
                      dataKey="profit"
                      stroke="var(--success)" strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--success)' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <Layers className="text-[var(--accent)]" size={18} />
                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-dim)]">歷史週倉位矩陣</h3>
              </div>
              <div className="elegant-card p-0 overflow-hidden border-[var(--border)] shadow-2xl bg-opacity-50 backdrop-blur-sm">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-max border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-tertiary)] text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] border-b border-[var(--border)]">
                        <th className="px-6 py-5 sticky left-0 bg-[var(--bg-tertiary)] z-20 shadow-[2px_0_10px_rgba(0,0,0,0.2)]">日期</th>
                        <th className="px-6 py-5 text-center text-[var(--accent)] min-w-[100px] md:min-w-[120px] bg-[var(--accent)]/5">市值</th>
                        <th className="px-6 py-5 text-center text-[var(--danger)] min-w-[100px] md:min-w-[120px] bg-[var(--danger)]/5">投入本金</th>
                        <th className="px-6 py-5 text-center text-[var(--success)] min-w-[100px] md:min-w-[140px] bg-[var(--success)]/5">帳面損益</th>
                        {/* Dynamic ticker columns - Fix: Use synced allTickers */}
                        {allTickers.map(ticker => <th key={ticker} className="px-6 py-5 text-center min-w-[100px] font-bold border-l border-[var(--border)]/20">{appData.holdingsMap?.[ticker]?.name || ticker}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/50">
                      {[...chartData].reverse().map((row, i) => (
                        <tr key={i} className="hover:bg-[var(--accent)]/5 transition-colors group">
                          <td className="px-6 py-5 font-mono text-[11px] font-bold sticky left-0 bg-[var(--bg-primary)] group-hover:bg-[var(--bg-tertiary)] z-10 border-r border-[var(--border)]/30">
                            {row.name.replace(/-/g, '/')}
                          </td>
                          <td className="px-6 py-5 font-mono text-[11px] text-right text-[var(--accent)] font-black">${row.value.toLocaleString()}</td>
                          <td className="px-6 py-5 font-mono text-[11px] text-right text-[var(--danger)] opacity-80">${row.cost.toLocaleString()}</td>
                          <td className={cn("px-6 py-5 font-mono text-xs font-black text-right", row.profit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
                            <div className="flex flex-col items-end">
                              <span>{row.profit >= 0 ? '+' : ''}{row.profit.toLocaleString()}</span>
                              <span className="text-[9px] opacity-60 font-sans tracking-normal font-normal">
                                {((row.profit / (row.cost || 1)) * 100).toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          {/* Dynamic ticker values - Fix: Use synced allTickers */}
                          {allTickers.map(ticker => (
                            <td key={ticker} className="px-6 py-5 font-mono text-[11px] text-right text-[var(--text-main)] opacity-70 border-l border-[var(--border)]/10">
                              {row.breakdown?.[ticker] > 0 ? `$${row.breakdown[ticker].toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Page 3: ROI Benchmark Redesigned */}
          <div className="w-full shrink-0 px-0.5 space-y-4 md:space-y-8">
            {/* Header Stats */}
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="elegant-card p-3 md:p-5 bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] border-[var(--accent)]/30">
                <span className="text-[8px] md:text-[9px] text-[var(--text-dim)] font-black uppercase tracking-widest block mb-1">累積超額報酬 (Alpha)</span>
                <p className={cn(
                  "text-lg md:text-2xl font-mono font-black",
                  (chartData[chartData.length - 1]?.portfolioRoi - chartData[chartData.length - 1]?.marketRoi) >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"
                )}>
                  {((chartData[chartData.length - 1]?.portfolioRoi || 0) - (chartData[chartData.length - 1]?.marketRoi || 0)).toFixed(2)}%
                </p>
              </div>
              <div className="elegant-card p-3 md:p-5 bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] border-[var(--border)]">
                <span className="text-[8px] md:text-[9px] text-[var(--text-dim)] font-black uppercase tracking-widest block mb-1">投資組合勝率</span>
                <p className="text-lg md:text-2xl font-mono font-black text-[var(--text-main)]">
                  {((chartData.filter(d => d.portfolioRoi > d.marketRoi).length / (chartData.length || 1)) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            <div className="elegant-card p-0 overflow-hidden border-[var(--border)] bg-opacity-40 backdrop-blur-md shadow-2xl relative">
              <div className="p-4 md:p-6 pb-2 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[var(--accent)] text-[var(--bg-primary)]">
                      <Activity size={14} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-main)]">
                      績效對比
                    </h3>
                  </div>
                  <p className="hidden md:block text-[10px] text-[var(--text-dim)] font-bold opacity-60 ml-9">
                    Benchmark: TAIEX (台股大盤指數)
                  </p>
                </div>
                
                <div className="flex bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border)] shrink-0 scale-90 md:scale-100 origin-right">
                  <button 
                    onClick={() => setViewMode('ratio')}
                    className={cn(
                      "px-3 md:px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      viewMode === 'ratio' ? "bg-[var(--accent)] text-[var(--bg-primary)] shadow-lg" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"
                    )}
                  >
                    比率
                  </button>
                  <button 
                    onClick={() => setViewMode('absolute')}
                    className={cn(
                      "px-3 md:px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                      viewMode === 'absolute' ? "bg-[var(--accent)] text-[var(--bg-primary)] shadow-lg" : "text-[var(--text-dim)] hover:text-[var(--text-main)]"
                    )}
                  >
                    數值
                  </button>
                </div>
              </div>
              
              <div className="h-[320px] md:h-[420px] relative px-1 md:px-2 pb-4" style={{ touchAction: 'pan-y' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart 
                    data={chartData} 
                    margin={{ top: 30, right: 10, left: 15, bottom: 20 }}
                    onMouseDown={(e: any) => {
                      if (e && e.activeLabel) {
                        setRefAreaLeft(e.activeLabel);
                        setRefAreaRight(e.activeLabel);
                        setMeasurementData(null);
                      }
                    }}
                    onMouseMove={(e: any) => {
                      if (refAreaLeft && e && e.activeLabel) {
                        setRefAreaRight(e.activeLabel);
                      }
                    }}
                    onMouseUp={handleMeasurementEnd}
                    onTouchStart={(e: any) => {
                      if (e && e.activeLabel) {
                        setRefAreaLeft(e.activeLabel);
                        setRefAreaRight(e.activeLabel);
                        setMeasurementData(null);
                      }
                    }}
                    onTouchMove={(e: any) => {
                      if (refAreaLeft && e && e.activeLabel) {
                        setRefAreaRight(e.activeLabel);
                      }
                    }}
                    onTouchEnd={handleMeasurementEnd}
                  >
                    <defs>
                      <linearGradient id="colorRoi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.2} />
                    <XAxis 
                      dataKey="name" 
                      stroke="var(--text-dim)" 
                      fontSize={8} 
                      axisLine={false} 
                      tickLine={false} 
                      tickMargin={15}
                      minTickGap={40}
                      tickFormatter={(str) => str.split('-').slice(1).join('/')}
                    />
                    <YAxis 
                      yAxisId="left"
                      type="number"
                      stroke="var(--accent)" 
                      fontSize={8} 
                      axisLine={false} 
                      tickLine={false} 
                      tickMargin={8} 
                      width={45}
                      domain={['auto', 'auto']}
                      tickFormatter={(v) => {
                        const val = Number(v);
                        if (isNaN(val)) return '';
                        if (viewMode === 'ratio') return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
                        
                        const isNegative = val < 0;
                        const absVal = Math.abs(val);
                        let formatted = '';
                        if (absVal >= 1000000) formatted = `$${(absVal/1000000).toFixed(1)}M`;
                        else if (absVal >= 1000) formatted = `$${(absVal/1000).toFixed(0)}k`;
                        else formatted = `$${absVal}`;
                        return isNegative ? `-${formatted}` : formatted;
                      }}
                    />
                    {viewMode === 'absolute' && (
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        type="number"
                        stroke="var(--text-dim)" 
                        fontSize={8} 
                        axisLine={false} 
                        tickLine={false} 
                        tickMargin={8} 
                        width={45}
                        domain={['auto', 'auto']}
                        tickFormatter={(v) => Number(v).toLocaleString()}
                      />
                    )}
                    <Tooltip
                      cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                      position={isMobile ? { x: 10, y: 10 } : undefined}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const originalPoint = chartData.find(d => d.name === label) || payload[0].payload;
                          return (
                            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] p-2.5 md:p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl border-opacity-50 max-w-[230px] md:max-w-none">
                              <div className="text-[10px] text-[var(--text-dim)] font-black uppercase tracking-widest border-b border-[var(--border)] pb-2.5 mb-3 flex items-center justify-between gap-8">
                                <span>{label?.toString().replace(/-/g, '/')}</span>
                                <span className="opacity-40 font-mono text-[8px]">SNAPSHOT</span>
                              </div>
                              <div className={cn("space-y-3", isMobile && "space-y-1.5")}>
                                {payload.map((item: any, idx: number) => {
                                  const val = Number(item.value) || 0;
                                  const isNegative = val < 0;
                                  const isBenchmark = item.name.includes('大盤') || 
                                                      item.name.includes('指數') || 
                                                      item.name.includes('標普') || 
                                                      item.name.includes('那斯達克') || 
                                                      item.name.includes('道瓊');
                                  return (
                                    <div key={idx} className={cn("flex items-center justify-between gap-12", isMobile && "gap-6")}>
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || '#888' }} />
                                        <span className="text-[11px] font-bold text-[var(--text-main)]">{item.name}</span>
                                      </div>
                                      <span className={cn(
                                        "text-xs font-mono font-black",
                                        isBenchmark ? "text-[var(--text-main)]" : (!isNegative ? "text-[var(--success)]" : "text-[var(--danger)]")
                                      )}>
                                        {viewMode === 'ratio' 
                                          ? `${!isNegative ? '+' : ''}${val.toFixed(2)}%`
                                          : isBenchmark
                                            ? val.toLocaleString()
                                            : `${!isNegative ? '+' : '-'}$${Math.abs(val).toLocaleString()}`
                                        }
                                      </span>
                                    </div>
                                  );
                                })}

                                {viewMode === 'absolute' && (
                                  <div className="border-t border-[var(--border)] pt-2 mt-2 space-y-1.5 opacity-80">
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-[var(--text-dim)]">├ 未實現盈虧</span>
                                      <span className={cn("font-mono font-bold", (originalPoint.profit || 0) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
                                        {(originalPoint.profit || 0) >= 0 ? '+' : '-'}${Math.abs(originalPoint.profit || 0).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-[var(--text-dim)]">└ 已實現盈虧</span>
                                      <span className={cn("font-mono font-bold", (originalPoint.realizedProfit || 0) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
                                        {(originalPoint.realizedProfit || 0) >= 0 ? '+' : '-'}${Math.abs(originalPoint.realizedProfit || 0).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {viewMode === 'ratio' && payload.length >= 2 && (
                                  <div className={cn("border-t border-[var(--border)] pt-3 mt-1 space-y-1.5", isMobile && "pt-2 mt-1 space-y-1")}>
                                    <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest block mb-1.5">超額收益 (Alpha)</span>
                                    {payload.slice(1).map((item: any, idx: number) => {
                                      const alpha = (payload[0].value || 0) - (item.value || 0);
                                      return (
                                        <div key={idx} className={cn("flex items-center justify-between gap-12", isMobile && "gap-6")}>
                                          <span className="text-[10px] font-bold text-[var(--text-dim)]">vs {item.name}</span>
                                          <span className={cn("text-xs font-mono font-black", alpha >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]")}>
                                            {alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="rect" 
                      iconSize={10}
                      wrapperStyle={{ 
                        paddingBottom: '30px', 
                        fontSize: '9px', 
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        opacity: 0.7
                      }} 
                    />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      name={viewMode === 'ratio' ? "個人帳戶" : "累計損益"} 
                      dataKey={viewMode === 'ratio' ? "portfolioRoi" : "totalPL"} 
                      stroke="var(--accent)" 
                      strokeWidth={4} 
                      dot={false} 
                      activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--accent)' }} 
                      animationDuration={1000}
                    />
                    {!isUsSector && (
                      <Line 
                        yAxisId={viewMode === 'ratio' ? "left" : "right"}
                        type="monotone" 
                        name={viewMode === 'ratio' ? "台股大盤" : "大盤點數"} 
                        dataKey={viewMode === 'ratio' ? "marketRoi" : "marketPrice"} 
                        stroke="var(--text-dim)" 
                        strokeWidth={2} 
                        strokeDasharray="4 4" 
                        dot={false} 
                        activeDot={{ r: 4, strokeWidth: 0, fill: 'var(--text-dim)' }} 
                        opacity={0.6}
                        animationDuration={1500}
                      />
                    )}
                    {isUsSector && viewMode === 'ratio' && (
                      <>
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          name="標普 500" 
                          dataKey="sp500Roi" 
                          stroke="#10b981" 
                          strokeWidth={2.5} 
                          strokeDasharray="6 3" 
                          dot={false} 
                          activeDot={{ r: 4, strokeWidth: 0, fill: '#10b981' }} 
                          opacity={0.95}
                          animationDuration={1500}
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          name="那斯達克" 
                          dataKey="nasdaqRoi" 
                          stroke="#3b82f6" 
                          strokeWidth={2.5} 
                          strokeDasharray="6 3" 
                          dot={false} 
                          activeDot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }} 
                          opacity={0.95}
                          animationDuration={1500}
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          name="道瓊工業" 
                          dataKey="dowRoi" 
                          stroke="#f59e0b" 
                          strokeWidth={2.5} 
                          strokeDasharray="6 3" 
                          dot={false} 
                          activeDot={{ r: 4, strokeWidth: 0, fill: '#f59e0b' }} 
                          opacity={0.95}
                          animationDuration={1500}
                        />
                      </>
                    )}
                    {refAreaLeft && refAreaRight && React.createElement(ReferenceArea as any, {
                        yAxisId: 'left',
                        x1: refAreaLeft,
                        x2: refAreaRight,
                        stroke: '#3b82f6',
                        strokeWidth: 1.5,
                        strokeDasharray: '4 4',
                        fill: '#3b82f6',
                        fillOpacity: 0.12
                      })}
                  </ComposedChart>
                </ResponsiveContainer>

                {/* 績效測量工具懸浮卡片 */}
                {measurementData && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-[var(--bg-secondary)]/95 border border-[var(--border)] text-[var(--text-main)] px-4 py-3.5 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 min-w-[280px] max-w-[320px]">
                    {/* 關閉按鈕 */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setRefAreaLeft(null);
                        setRefAreaRight(null);
                        setMeasurementData(null);
                      }}
                      className="absolute top-2 right-2 p-1 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--border)] text-[var(--text-dim)] hover:text-[var(--danger)] transition-all cursor-pointer active:scale-90"
                    >
                      <X size={12} />
                    </button>

                    {/* 頂部日期與範圍資訊 */}
                    <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-dim)] font-black uppercase tracking-wider mb-3 border-b border-[var(--border)] pb-2 pr-6">
                      <Calendar size={10} className="text-[var(--accent)]" />
                      <span>
                        {measurementData.startDate.replace(/-/g, '/')} ~ {measurementData.endDate.replace(/-/g, '/')}
                      </span>
                      <span className="opacity-40 font-mono">({measurementData.days}天)</span>
                    </div>

                    {/* 績效數據網格對比 */}
                    <div className="grid grid-cols-2 gap-3 text-center">
                      {/* 左邊：個人績效 */}
                      <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-[var(--bg-tertiary)]/40 border border-[var(--border)]/30">
                        <span className="text-[8px] text-[var(--text-dim)] font-black uppercase tracking-widest mb-1">個人帳戶</span>
                        <div className="flex items-center gap-0.5 whitespace-nowrap">
                          {viewMode === 'ratio' ? (
                            <>
                              <TrendingUp size={12} className={measurementData.portfolioChange >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"} />
                              <span className={cn("font-mono font-black text-[13px] md:text-base whitespace-nowrap", measurementData.portfolioChange >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]")}>
                                {measurementData.portfolioChange >= 0 ? '+' : ''}{measurementData.portfolioChange.toFixed(2)}%
                              </span>
                            </>
                          ) : (
                            <>
                              <TrendingUp size={12} className={measurementData.portfolioAbsChange >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"} />
                              <span className={cn("font-mono font-black text-[13px] md:text-base whitespace-nowrap", measurementData.portfolioAbsChange >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]")}>
                                {measurementData.portfolioAbsChange >= 0 ? '+' : '-'}${Math.abs(measurementData.portfolioAbsChange).toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 右邊：基準大盤 */}
                      <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-[var(--bg-tertiary)]/40 border border-[var(--border)]/30">
                        <span className="text-[8px] text-[var(--text-dim)] font-black uppercase tracking-widest mb-1">
                          {isUsSector ? '對比基準' : '台股大盤'}
                        </span>
                        {!isUsSector ? (
                          <div className="flex items-center gap-0.5 whitespace-nowrap">
                            {(() => {
                              const twChange = measurementData.benchChanges['台股大盤'] || 0;
                              const twChangeAbs = measurementData.benchAbsChanges['台股大盤'] || 0;
                              return viewMode === 'ratio' ? (
                                <>
                                  <TrendingUp size={12} className={twChange >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"} />
                                  <span className={cn("font-mono font-black text-[13px] md:text-base whitespace-nowrap", twChange >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]")}>
                                    {twChange >= 0 ? '+' : ''}{twChange.toFixed(2)}%
                                  </span>
                                </>
                              ) : (
                                <>
                                  <TrendingUp size={12} className={twChangeAbs >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]"} />
                                  <span className={cn("font-mono font-black text-[13px] md:text-base whitespace-nowrap", twChangeAbs >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]")}>
                                    {twChangeAbs >= 0 ? '+' : ''}{twChangeAbs.toFixed(2)} 點
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 justify-center items-center w-full">
                            {Object.entries((viewMode === 'ratio' ? measurementData.benchChanges : measurementData.benchAbsChanges) as Record<string, number>).map(([name, val]) => (
                              <div key={name} className="flex items-center gap-1 font-mono whitespace-nowrap">
                                <span className="text-[9px] font-bold text-[var(--text-dim)]">{name}</span>
                                <span className={cn("text-[10px] font-black whitespace-nowrap", val >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]")}>
                                  {viewMode === 'ratio' ? (
                                    `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`
                                  ) : (
                                    `${val >= 0 ? '+' : ''}${val.toFixed(1)} 點`
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 超額收益 Alpha 計算顯示 */}
                    {viewMode === 'ratio' && Object.entries(measurementData.benchChanges).length === 1 && (
                      <div className="mt-3 pt-2.5 border-t border-[var(--border)]/60 flex items-center justify-between text-[10px]">
                        <span className="font-black text-[var(--text-dim)] uppercase tracking-wider">超額收益 (Alpha)</span>
                        {(() => {
                          const firstBench = Object.entries(measurementData.benchChanges as Record<string, number>)[0];
                          const alpha = measurementData.portfolioChange - firstBench[1];
                          return (
                            <span className={cn("font-mono font-black", alpha >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]")}>
                              {alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%
                            </span>
                          );
                        })()}
                      </div>
                    )}

                    {viewMode === 'ratio' && Object.entries(measurementData.benchChanges).length > 1 && (
                      <div className="mt-3 pt-2 border-t border-[var(--border)]/60 text-[8px] space-y-1">
                        <span className="font-black text-[var(--text-dim)] uppercase tracking-widest block mb-1">超額收益 (Alpha)</span>
                        <div className="grid grid-cols-3 gap-1 text-center">
                          {Object.entries(measurementData.benchChanges as Record<string, number>).map(([name, val]) => {
                            const alpha = measurementData.portfolioChange - val;
                            return (
                              <div key={name} className="flex flex-col p-1 rounded bg-[var(--bg-tertiary)]/20 border border-[var(--border)]/20">
                                <span className="text-[8px] text-[var(--text-dim)] font-bold">{name.substring(0, 2)}</span>
                                <span className={cn("font-mono font-black text-9px", alpha >= 0 ? "text-[var(--accent)]" : "text-[var(--danger)]")}>
                                  {alpha >= 0 ? '+' : ''}{alpha.toFixed(1)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Market Data Entry Section */}
            <div id="market-bench-input" className="elegant-card bg-opacity-40 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-xl bg-[var(--bg-tertiary)] text-[var(--accent)]">
                  <Edit2 size={16} />
                </div>
                <h4 className="text-xs font-black uppercase tracking-widest text-[var(--text-main)]">
                  {isUsSector ? '美股基準數據管理' : '大盤基準數據管理'}
                </h4>
              </div>

              {isUsSector && (
                <div className="flex gap-2 mb-4 bg-[var(--bg-tertiary)] p-1 rounded-xl border border-[var(--border)] max-w-xs">
                  {[
                    { ticker: '^GSPC', label: '標普 500' },
                    { ticker: '^IXIC', label: '那斯達克' },
                    { ticker: '^DJI', label: '道瓊工業' }
                  ].map(tab => (
                    <button
                      key={tab.ticker}
                      onClick={() => setSelectedUsTicker(tab.ticker)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                        selectedUsTicker === tab.ticker ? "bg-[var(--accent)] text-[var(--bg-primary)] shadow-md" : "text-[var(--text-dim)]"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
              
              <div className="grid grid-cols-[1.3fr_1fr_0.7fr] gap-2 items-end">
                <div className="space-y-1.5">
                  <label className="elegant-label">記錄日期</label>
                  <input 
                    type="date" 
                    className="elegant-input text-xs h-[42px] px-2"
                    value={mDate}
                    onChange={(e) => setMDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="elegant-label">
                    {activeTicker === '^TWII' ? '大盤點數' : activeTicker === '^GSPC' ? '標普 500 點數' : activeTicker === '^IXIC' ? '那斯達克點數' : '道瓊點數'}
                  </label>
                  <input 
                    type="number" 
                    className="elegant-input text-xs h-[42px] px-2"
                    placeholder="點數"
                    value={mPrice}
                    onChange={(e) => setMPrice(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => {
                    if (!mPrice || isNaN(parseFloat(mPrice))) return;
                    setWeeklyPrices(prev => {
                      const others = prev.filter(p => !(p.date === mDate && p.ticker === activeTicker));
                      return [...others, { date: mDate, ticker: activeTicker, price: parseFloat(mPrice) }]
                        .sort((a, b) => a.date.localeCompare(b.date));
                    });
                    setMPrice('');
                    alert(`${activeTicker === '^TWII' ? '台股大盤' : activeTicker === '^GSPC' ? '標普 500' : activeTicker === '^IXIC' ? '那斯達克' : '道瓊工業'} 數據已成功記錄！`);
                  }}
                  className="bg-[var(--accent)] text-[var(--bg-primary)] h-[42px] rounded-lg text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg w-full flex items-center justify-center cursor-pointer"
                >
                  儲存
                </button>
              </div>

              {/* Benchmark History List */}
              <div className="mt-8 border-t border-[var(--border)] pt-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)] mb-4 flex items-center gap-2">
                   <Activity size={12} /> {activeTicker === '^TWII' ? '台股大盤' : activeTicker === '^GSPC' ? '標普 500' : activeTicker === '^IXIC' ? '那斯達克' : '道瓊工業'} 歷史紀錄清單
                </h4>
                <div className="w-full">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-[var(--bg-secondary)] z-10">
                      <tr className="text-[9px] text-[var(--text-dim)] font-black uppercase tracking-widest border-b border-[var(--border)]">
                        <th className="px-2 py-3">日期</th>
                        <th className="px-2 py-3">點數</th>
                        <th className="px-2 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {weeklyPrices
                        .filter(p => p.ticker === activeTicker)
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((p, idx) => (
                        <tr key={idx} className="hover:bg-[var(--bg-primary)]/40 transition-colors group">
                          <td className="px-2 py-3 font-mono text-[10px] text-[var(--text-main)]">{p.date}</td>
                          <td className="px-2 py-3 font-mono text-[10px] text-[var(--accent)] font-bold">{p.price.toLocaleString()}</td>
                          <td className="px-2 py-3 text-right flex justify-end gap-1">
                            <button 
                              onClick={() => {
                                setMDate(p.date);
                                setMPrice(p.price.toString());
                                document.getElementById('market-bench-input')?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="p-1.5 text-[var(--text-dim)] hover:text-[var(--accent)] transition-all"
                              title="編輯此筆紀錄"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={() => {
                                if (window.confirm('確定要刪除這筆大盤紀錄嗎？')) {
                                  setWeeklyPrices(prev => prev.filter(x => !(x.date === p.date && x.ticker === activeTicker)));
                                }
                              }}
                              className="p-1.5 text-[var(--text-dim)] hover:text-[var(--danger)] transition-all"
                              title="刪除此筆紀錄"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {weeklyPrices.filter(p => p.ticker === activeTicker).length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-2 py-8 text-center text-[10px] text-[var(--text-dim)] italic">尚無大盤數據</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
         </motion.div>
       </div>
     </div>
    );
  };