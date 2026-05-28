/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useDragControls } from 'motion/react';
import {
  Plus,
  History,
  LayoutDashboard,
  TrendingUp,
  Activity,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Briefcase,
  Menu,
  X,
  Calendar,
  Check,
  Target,
  Edit2,
  Trash2,
  Palette,
  FileUp,
  Search,
  Tag,
  Hash,
  Settings as SettingsIcon,
  Skull,
  CheckCircle2,
  Archive
} from 'lucide-react';

declare global {
  interface Window {
    XLSX: any;
  }
}
const XLSX = (window as any).XLSX;
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Scatter,
  ReferenceDot,
  Legend
} from 'recharts';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { cn } from './lib/utils';
import {
  Transaction,
  TransactionCategory,
  TransactionDirection,
  Config,
  Holding,
  RealizedProfit,
  WeeklyPrice
} from './types';
import { DEFAULT_CONFIGS, INITIAL_TRANSACTIONS } from './constants';
import { StockChartWidget } from './components/StockChartWidget';
import { usePortfolioCalculations } from './hooks/usePortfolioCalculations';
import { useTransactionForm } from './hooks/useTransactionForm';
import { TransactionRow } from './components/TransactionRow';
import { TickerPillList } from './components/TickerPillList';
import { PortfolioView } from './components/PortfolioView';
import { RealizedView } from './components/RealizedView';
import { LockScreen } from './components/LockScreen';
import { Shield, Lock as LockIcon, Unlock as UnlockIcon, AlertCircle } from 'lucide-react';
import { isTxRealized } from './lib/txUtils';


export default function App() {
  const [activeView, setActiveView] = useState<'A' | 'B' | 'C'>('A');
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('z_money_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });
  const [configs] = useState<Record<TransactionCategory, Config>>(DEFAULT_CONFIGS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const themes = ['gold', 'cyan', 'ocean', 'light', 'zen'] as const;
  type Theme = typeof themes[number];
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('z_money_theme') as Theme) || 'cyan';
  });

  const [marketData, setMarketData] = useState<{ updated: string | null; prices: Record<string, number> }>(() => {
    const saved = localStorage.getItem('z_money_market_data');
    return saved ? JSON.parse(saved) : { updated: null, prices: {} };
  });
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [weeklyPrices, setWeeklyPrices] = useState<WeeklyPrice[]>(() => {
    const saved = localStorage.getItem('z_money_weekly_prices');
    const initial = saved ? JSON.parse(saved) : [];

    // Inject benchmark data if ^TWII is missing
    const hasBenchmark = initial.some((p: any) => p.ticker === '^TWII');
    if (!hasBenchmark) {
      const benchmarkData = [
        { date: '2024-01-05', ticker: '^TWII', price: 17519 },
        { date: '2024-03-29', ticker: '^TWII', price: 20294 },
        { date: '2024-06-28', ticker: '^TWII', price: 23032 },
        { date: '2024-09-27', ticker: '^TWII', price: 22822 },
        { date: '2024-12-27', ticker: '^TWII', price: 23035 },
        { date: '2025-01-03', ticker: '^TWII', price: 23500 },
        { date: '2025-03-28', ticker: '^TWII', price: 25800 },
        { date: '2025-06-27', ticker: '^TWII', price: 27200 },
        { date: '2025-09-26', ticker: '^TWII', price: 28100 },
        { date: '2025-12-26', ticker: '^TWII', price: 28963 },
        { date: '2026-01-02', ticker: '^TWII', price: 28500 },
        { date: '2026-01-30', ticker: '^TWII', price: 30500 },
        { date: '2026-02-27', ticker: '^TWII', price: 33500 },
        { date: '2026-03-27', ticker: '^TWII', price: 37500 },
        { date: '2026-04-24', ticker: '^TWII', price: 39500 },
        { date: '2026-05-04', ticker: '^TWII', price: 40705 }
      ];
      return [...initial, ...benchmarkData].sort((a, b) => a.date.localeCompare(b.date));
    }
    return initial;
  });
  const [netWorthEntries, setNetWorthEntries] = useState<{ date: string, assets: Record<string, number> }[]>(() => {
    const saved = localStorage.getItem('z_money_net_worth');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return parsed.map((entry: any) => {
      if (entry.assets) return entry;
      // Migration from old flat format
      const { date, cash, crypto, ...rest } = entry;
      return {
        date,
        assets: {
          '現金': cash || 0,
          '加密貨幣': crypto || 0,
          ...rest
        }
      };
    });
  });

  const [tickerOrder, setTickerOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('z_money_ticker_order');
    return saved ? JSON.parse(saved) : [];
  });
  const [tickerMetadata, setTickerMetadata] = useState<Record<string, { assetClass?: string }>>(() => {
    const saved = localStorage.getItem('z_money_ticker_metadata');
    return saved ? JSON.parse(saved) : {};
  });
  const [isEditingTickers, setIsEditingTickers] = useState(false);
  const [appPassword, setAppPassword] = useState(() => localStorage.getItem('z_money_pass') || '');
  const [isLocked, setIsLocked] = useState(!!appPassword);
  const [isSettingPass, setIsSettingPass] = useState(false);
  const [newPass, setNewPass] = useState('');

  // Auto-mapping logic
  const stockMap = useMemo(() => {
    const tMap: Record<string, string> = {};
    const nMap: Record<string, string> = {};
    transactions.forEach(tx => {
      if (tx.ticker && tx.name) {
        tMap[tx.ticker.toUpperCase()] = tx.name;
        nMap[tx.name.toUpperCase()] = tx.ticker.toUpperCase();
      }
    });
    return { tMap, nMap };
  }, [transactions]);

  // Persistence: Centralized Storage Handler
  useEffect(() => {
    const data = {
      z_money_transactions: transactions,
      z_money_weekly_prices: weeklyPrices,
      z_money_market_data: marketData,
      z_money_theme: theme,
      z_money_ticker_order: tickerOrder,
      z_money_ticker_metadata: tickerMetadata,
      z_money_pass: appPassword,
      z_money_net_worth: netWorthEntries
    };
    Object.entries(data).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
      } else {
        localStorage.removeItem(key);
      }
    });
  }, [transactions, weeklyPrices, marketData, theme, tickerOrder, appPassword, netWorthEntries]);

  useEffect(() => {
    if (theme === 'gold') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // 切換選單時自動捲動到頂部
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeView]);

  // 啟動時自動載入初始備份資料 (若 LocalStorage 為空且無任何交易紀錄)
  useEffect(() => {
    const hasSavedData = localStorage.getItem('z_money_transactions');
    if (!hasSavedData) {
      async function loadInitialBackup() {
        try {
          console.log('[資料初始化] 偵測到本地無交易紀錄，正在載入預設備份資料...');
          const response = await fetch('./Z-Money-FullBackup-2026-05-10.json');
          if (response.ok) {
            const data = await response.json();
            if (data.transactions) setTransactions(data.transactions);
            if (data.tickerOrder) setTickerOrder(data.tickerOrder);
            if (data.tickerMetadata) setTickerMetadata(data.tickerMetadata);
            if (data.netWorthEntries) setNetWorthEntries(data.netWorthEntries);
            if (data.weeklyPrices) setWeeklyPrices(data.weeklyPrices);
            if (data.theme) setTheme(data.theme);
            if (data.marketData) setMarketData(data.marketData);
            console.log('[資料初始化] 成功載入預設備份資料！');
          }
        } catch (e) {
          console.error('[資料初始化] 載入備份資料失敗:', e);
        }
      }
      loadInitialBackup();
    }
  }, []);

  // 啟動時自動從伺服器/靜態檔同步最新收盤價，並自動補登歷史價格紀錄
  useEffect(() => {
    async function syncMarketPrices() {
      try {
        console.log('[股價同步] 正在從伺服器獲取最新價格...');
        const timestamp = Date.now();
        let url = `./stock_prices.json?t=${timestamp}`;
        if (window.location.hostname.includes('github.io')) {
          const repoName = window.location.pathname.split('/')[1] || 'Z-Test';
          url = `https://raw.githubusercontent.com/qazs792589-lang/${repoName}/main/stock_prices.json?t=${timestamp}`;
        } else {
          url = `https://raw.githubusercontent.com/qazs792589-lang/Z-Test/main/stock_prices.json?t=${timestamp}`;
        }
        console.log(`[股價同步] 正在獲取: ${url}`);
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('無法取得 stock_prices.json');
        
        const data = await response.json();
        if (data && data.updated && data.prices) {
          setMarketData(prev => {
            console.log('[股價同步] 偵測到股價資料，已自動同步更新。最後更新時間:', data.updated);
            return data;
          });

          // 2. 自動將今日最新收盤價補登到歷史價格紀錄中 (weeklyPrices)
          // 轉換更新日期為台灣時間的 YYYY-MM-DD
          const updateTime = new Date(data.updated);
          const twDateStr = new Date(updateTime.getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          setWeeklyPrices(prev => {
            let hasChanges = false;
            
            // 1. 先更新已存在的日期之價格 (如果不同)
            const updatedList = prev.map(wp => {
              const serverPrice = data.prices[wp.ticker];
              const date = (data.dates && data.dates[wp.ticker]) ? data.dates[wp.ticker] : twDateStr;
              if (serverPrice !== undefined && wp.date === date) {
                const numericPrice = Number(serverPrice);
                if (!isNaN(numericPrice) && wp.price !== numericPrice) {
                  console.log(`[股價同步] 更新 ${wp.ticker} 在 ${wp.date} 的收盤價: ${wp.price} -> ${numericPrice}`);
                  hasChanges = true;
                  return { ...wp, price: numericPrice };
                }
              }
              return wp;
            });
            
            // 2. 再補登不存在的價格
            Object.entries(data.prices).forEach(([ticker, price]) => {
              const numericPrice = Number(price);
              if (isNaN(numericPrice)) return;
              
              // 優先使用該股票在資料庫中的實際交易日期
              const date = (data.dates && data.dates[ticker]) ? data.dates[ticker] : twDateStr;
              
              // 檢查該股票在該日期是否已登錄過價格
              const exists = updatedList.some(wp => wp.ticker === ticker && wp.date === date);
              if (!exists) {
                console.log(`[股價同步] 自動為 ${ticker} 登錄歷史收盤價: 日期 ${date}, 價格 ${numericPrice}`);
                updatedList.push({
                  date: date,
                  ticker: ticker,
                  price: numericPrice
                });
                hasChanges = true;
              }
            });
            
            if (hasChanges) {
              return updatedList.sort((a, b) => {
                const dateCompare = a.date.localeCompare(b.date);
                if (dateCompare !== 0) return dateCompare;
                return a.ticker.localeCompare(b.ticker);
              });
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('[股價同步] 自動同步價格失敗 (可能在離線狀態或檔案尚未產生):', err.message);
      }
    }
    syncMarketPrices();
  }, []);

  // 本地端自動存檔備份至硬碟 (僅在 localhost 運作)
  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal || transactions.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        const fullData = {
          transactions,
          tickerOrder,
          tickerMetadata,
          netWorthEntries,
          weeklyPrices,
          theme,
          marketData
        };
        const res = await fetch('/api/save-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullData)
        });
        if (res.ok) {
          console.log('[自動備份] 已成功將最新交易與持倉備份同步至本地硬碟 JSON 檔');
        }
      } catch (err) {
        console.warn('[自動備份] 同步至本地硬碟失敗:', err);
      }
    }, 2000); // 延遲 2 秒防抖，避免連續輸入交易時頻繁寫入

    return () => clearTimeout(timer);
  }, [transactions, tickerOrder, tickerMetadata, netWorthEntries, weeklyPrices, theme, marketData]);

  // 啟動時自動修正 LocalStorage 中被錯誤登錄為 5/26 的歷史股價 (因為 5/26 尚未收盤)
  useEffect(() => {
    const now = new Date();
    // 台灣時間 UTC+8
    const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const hour = twTime.getUTCHours();
    const todayStr = twTime.toISOString().split('T')[0];
    
    // 如果今天是 5/26 且尚未收盤 (下午兩點前)
    if (todayStr === '2026-05-26' && hour < 14) {
      setWeeklyPrices(prev => {
        let changed = false;
        const next = prev.map(wp => {
          if (wp.date === '2026-05-26') {
            changed = true;
            return { ...wp, date: '2026-05-25' };
          }
          return wp;
        });
        
        if (changed) {
          // 合併重複的 5/25 紀錄並排序
          const unique = [];
          const seen = new Set();
          next.forEach(wp => {
            const key = `${wp.date}-${wp.ticker}`;
            if (!seen.has(key)) {
              seen.add(key);
              unique.push(wp);
            }
          });
          console.log('[資料修正] 已自動將錯誤的 2026-05-26 歷史紀錄修正並合併至 2026-05-25');
          return unique.sort((a, b) => a.date.localeCompare(b.date));
        }
        return prev;
      });
    }
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const weeklyFileInputRef = useRef<HTMLInputElement>(null);

  const handleWeeklyCsvImport = (e: React.ChangeEvent<HTMLInputElement>, ticker: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rawLines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (rawLines.length < 2) return;

        // 1. Find the header line (looking for Date or Price equivalent)
        let headerIdx = -1;
        let headers: string[] = [];
        for (let i = 0; i < rawLines.length; i++) {
          const row = rawLines[i].split(',').map(h => h.trim().replace(/"/g, ''));
          if (row.includes('日期') || row.includes('收盤價') || row.some(s => s.toLowerCase() === 'date' || s.toLowerCase() === 'price')) {
            headerIdx = i;
            headers = row;
            break;
          }
        }

        if (headerIdx === -1) {
          alert('CSV 格式錯誤，找不到「日期」或「收盤價」標題行。');
          return;
        }

        const dateIdx = headers.findIndex(h => h === '日期' || h.toLowerCase() === 'date');
        const priceIdx = headers.findIndex(h => h === '收盤價' || h.toLowerCase() === 'price' || h.toLowerCase().includes('closing'));

        if (dateIdx === -1 || priceIdx === -1) {
          alert('CSV 標題行格式錯誤，必須包含「日期」與「收盤價」欄位。');
          return;
        }

        const newEntries: WeeklyPrice[] = [];
        // Regex to split CSV while respecting quotes
        const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

        for (let i = headerIdx + 1; i < rawLines.length; i++) {
          const cols = rawLines[i].split(csvRegex).map(c => c.trim().replace(/"/g, ''));
          if (cols.length <= Math.max(dateIdx, priceIdx)) continue;

          const date = cols[dateIdx];
          // Remove commas and spaces from price string (e.g. "1,200.50" -> 1200.50)
          const priceStr = cols[priceIdx].replace(/,/g, '');
          const price = parseFloat(priceStr);

          if (date && !isNaN(price)) {
            newEntries.push({ date, ticker, price });
          }
        }

        if (newEntries.length > 0) {
          setWeeklyPrices(prev => {
            const others = prev.filter(p => p.ticker !== ticker || !newEntries.some(ne => ne.date === p.date));
            return [...others, ...newEntries].sort((a, b) => a.date.localeCompare(b.date));
          });
          alert(`成功匯入 ${newEntries.length} 筆收盤價紀錄！`);
        } else {
          alert('找不到有效的數據行，請檢查日期格式與數值。');
        }
      } catch (err) {
        console.error('CSV Import error:', err);
        alert('CSV 讀取失敗。');
      }
      if (weeklyFileInputRef.current) weeklyFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleHistoryCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rawLines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (rawLines.length < 2) return;

        let headerIdx = -1;
        for (let i = 0; i < rawLines.length; i++) {
          if (rawLines[i].includes('公司') && rawLines[i].includes('日期')) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) {
          alert('CSV 格式錯誤，找不到「公司」與「日期」標題。');
          return;
        }

        const newTransactions: Transaction[] = [];
        let lastTicker = '';
        const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

        for (let i = headerIdx + 1; i < rawLines.length; i++) {
          const cols = rawLines[i].split(csvRegex).map(c => c.trim().replace(/"/g, ''));
          if (cols.length < 5) continue;

          let ticker = cols[0];
          if (!ticker) ticker = lastTicker;
          else lastTicker = ticker;

          if (!ticker) continue;

          const date = cols[1];
          if (!date) continue;

          const unitPrice = parseFloat(cols[2].replace(/,/g, '')) || 0;
          const qtyRaw = parseFloat(cols[3].replace(/,/g, '')) || 0;
          const dividend = parseFloat(cols[4].replace(/,/g, '')) || 0;
          const fee = (parseFloat(cols[6].replace(/,/g, '')) || 0) + (parseFloat(cols[7].replace(/,/g, '')) || 0);
          const tax = parseFloat(cols[8].replace(/,/g, '')) || 0;
          const notes = cols[16] || '';

          if (dividend > 0) {
            newTransactions.push({
              id: Math.random().toString(36).substr(2, 9),
              date, ticker, name: ticker,
              direction: 'DIVIDEND', quantity: 1, unitPrice: dividend,
              category: 'Stock', fee: 0, tax: 0, totalAmount: dividend,
              notes
            });
          }

          if (qtyRaw !== 0) {
            const direction = qtyRaw < 0 ? 'BUY' : 'SELL';
            const qty = Math.abs(qtyRaw);
            const totalAmount = direction === 'BUY' ? (qty * unitPrice) + fee + tax : (qty * unitPrice) - fee - tax;

            newTransactions.push({
              id: Math.random().toString(36).substr(2, 9),
              date, ticker, name: ticker,
              direction, quantity: qty, unitPrice,
              category: 'Stock', fee, tax, totalAmount,
              notes
            });
          }
        }

        if (newTransactions.length > 0) {
          setTransactions(prev => [...prev, ...newTransactions]);
          alert(`成功匯入 ${newTransactions.length} 筆紀錄！`);
        }
      } catch (err) {
        console.error(err);
        alert('匯入失敗');
      }
      if (e.target) e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleUpdateTransactionNotes = (txId: string, notes: string) => {
    setTransactions(prev => prev.map(tx => tx.id === txId ? { ...tx, notes } : tx));
  };

  const handleExportBackupCsv = () => {
    if (transactions.length === 0) {
      alert('目前沒有交易資料可供匯出。');
      return;
    }
    const headers = "日期,股票代號,股票名稱,交易種類,數量,成交單價,類別,手續費,稅金,交易總額,備註,已實現標記\n";
    const rows = transactions.map(tx =>
      `${tx.date},${tx.ticker},"${tx.name}",${tx.direction},${tx.quantity},${tx.unitPrice},${tx.category},${tx.fee},${tx.tax},${tx.totalAmount},"${tx.notes || ''}",${tx.isManualRealized ?? ''}`
    ).join("\n");

    const blob = new Blob(["\uFEFF" + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Z-Money-Backup-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportBackupCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) return;

        const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        const newTxs: Transaction[] = lines.slice(1).map(line => {
          const parts = line.split(csvRegex).map(p => p.trim().replace(/"/g, ''));
          return {
            id: Math.random().toString(36).substr(2, 9),
            date: parts[0],
            ticker: parts[1],
            name: parts[2],
            direction: parts[3] as any,
            quantity: parseFloat(parts[4]),
            unitPrice: parseFloat(parts[5]),
            category: parts[6] as any,
            fee: parseFloat(parts[7]),
            tax: parseFloat(parts[8]),
            totalAmount: parseFloat(parts[9]),
            notes: parts[10] || '',
            isManualRealized: parts[11] === 'true' ? true : parts[11] === 'false' ? false : undefined
          };
        });

        if (window.confirm(`確定要匯入這 ${newTxs.length} 筆備份資料嗎？\n這將會與現有資料合併。`)) {
          setTransactions(prev => {
            const existingIds = new Set(prev.map(tx => tx.id));
            const uniqueNewTxs = newTxs.filter(tx => !existingIds.has(tx.id));
            return [...prev, ...uniqueNewTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          });
          alert('匯入與合併成功！');
        }
      } catch (err) {
        alert('匯入失敗，請檢查 CSV 格式是否正確。');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleExportFullJson = () => {
    const fullData = {
      transactions,
      tickerOrder,
      tickerMetadata,
      netWorthEntries,
      weeklyPrices,
      theme,
      marketData
    };
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Z-Money-FullBackup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleImportFullJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (window.confirm('確定要恢復全系統備份嗎？這將會覆蓋目前的「所有」資料。')) {
          if (data.transactions) setTransactions(data.transactions);
          if (data.tickerOrder) setTickerOrder(data.tickerOrder);
          if (data.tickerMetadata) setTickerMetadata(data.tickerMetadata);
          if (data.netWorthEntries) setNetWorthEntries(data.netWorthEntries);
          if (data.weeklyPrices) setWeeklyPrices(data.weeklyPrices);
          if (data.theme) setTheme(data.theme);
          if (data.marketData) setMarketData(data.marketData);
          alert('系統資料恢復完成！頁面即將重新載入。');
          window.location.reload();
        }
      } catch (err) {
        alert('解析備份檔案失敗。');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleToggleRealized = (id: string) => {
    setTransactions(prev => prev.map(tx => {
      if (tx.id === id) {
        // Effective current state:
        const isCurrentlyRealized = isTxRealized(tx);
        return { ...tx, isManualRealized: !isCurrentlyRealized };
      }
      return tx;
    }));
  };

  // Derived Calculations & Logic extracted to custom hooks
  const { formData, setFormData, preview } = useTransactionForm(configs);
  const { appData, stats } = usePortfolioCalculations(transactions, marketData, weeklyPrices);

  // Dynamic Chart Data for Dashboard (Mock historical trend based on current stats)
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualPrice, setManualPrice] = useState('');

  const addWeeklyPrice = (ticker: string) => {
    if (!manualDate || !manualPrice) return;

    const newPriceEntry = {
      date: manualDate,
      price: parseFloat(manualPrice)
    };

    const updatedGroups = { ...appData.stockGroups };
    if (!updatedGroups[ticker].weeklyPrices) {
      updatedGroups[ticker].weeklyPrices = [];
    }

    // 避免重複日期
    updatedGroups[ticker].weeklyPrices = [
      ...updatedGroups[ticker].weeklyPrices.filter(p => p.date !== manualDate),
      newPriceEntry
    ].sort((a, b) => a.date.localeCompare(b.date));

    // saveData({ ...appData, stockGroups: updatedGroups });
    setManualPrice('');
  };

  const handleDeleteTransaction = (id: string) => {
    if (window.confirm('確定要刪除這筆交易紀錄嗎？')) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const handleDeleteHolding = (ticker: string) => {
    const stockName = appData.stockGroups[ticker]?.transactions?.[0]?.name || ticker;
    if (window.confirm(`確定要刪除 ${stockName} (${ticker}) 的所有交易紀錄與持倉嗎？`)) {
      setTransactions(prev => prev.filter(t => t.ticker !== ticker));
      setWeeklyPrices(prev => prev.filter(wp => wp.ticker !== ticker));
      if (selectedTicker === ticker) setSelectedTicker(null);
    }
  };

  const chartData = useMemo(() => {
    // 1. Get a unique sorted timeline from both weekly prices AND transactions
    const allDates = new Set<string>();
    weeklyPrices.forEach(wp => allDates.add(wp.date));
    transactions.forEach(tx => allDates.add(tx.date));

    const timeline = Array.from(allDates).sort();
    if (timeline.length === 0) return [];

    // 2. For each point in the timeline, calculate portfolio status
    return timeline.map(date => {
      let totalValue = 0;
      let totalCost = 0;
      const breakdown: Record<string, number> = {};

      // Group transactions by ticker for easier processing
      const tickers = Object.keys(appData.stockGroups);

      tickers.forEach(ticker => {
        const txs = appData.stockGroups[ticker] || [];
        const pastTxs = txs.filter(t => t.date <= date);

        let shares = 0;
        let cost = 0;

        pastTxs.forEach(t => {
          if (t.direction === 'BUY') {
            shares += t.quantity;
            cost += t.totalAmount;
          } else if (t.direction === 'SELL') {
            const currentAvg = shares > 0 ? cost / shares : 0;
            shares -= t.quantity;
            cost -= (currentAvg * t.quantity);
          } else if (t.direction === 'DIVIDEND') {
            if (!t.isManualRealized) {
              // Use Math.abs to handle inconsistent signs in backup data (some +, some -)
              // Dividends should ALWAYS reduce the cost basis in net outlay approach
              cost -= Math.abs(t.totalAmount);
            }
          }
        });

        if (shares > 0) {
          // Find the price for this ticker on or before this date
          const priceEntry = weeklyPrices
            .filter(wp => wp.ticker === ticker && wp.date <= date)
            .sort((a, b) => b.date.localeCompare(a.date))[0];

          const price = priceEntry ? priceEntry.price : (pastTxs[0]?.unitPrice || 0);
          const value = shares * price;
          totalValue += value;
          totalCost += cost;
          breakdown[ticker] = Math.floor(value);
        } else {
          breakdown[ticker] = 0;
        }
      });

      return {
        name: date,
        value: Math.floor(totalValue),
        cost: Math.floor(totalCost),
        profit: Math.floor(totalValue - totalCost),
        portfolioRoi: totalCost > 0 ? ((totalValue / totalCost) - 1) * 100 : 0,
        breakdown
      };
    });
  }, [appData.stockGroups, weeklyPrices]);

  const finalChartData = useMemo(() => {
    // 1. Filter raw chartData to start from 2026
    const filteredBaseData = chartData.filter(d => d.name >= '2026-01-01');
    if (filteredBaseData.length === 0) return [];

    // 2. Calculate Market ROI (TAIEX) relative to the NEW first date
    const benchmarkPrices = weeklyPrices.filter(p => p.ticker === '^TWII').sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = filteredBaseData[0].name;
    const baseMarketPriceEntry = benchmarkPrices.filter(p => p.date <= firstDate).reverse()[0] || benchmarkPrices[0];
    const baseMarketPrice = baseMarketPriceEntry?.price || 1;

    // 3. Calculate Portfolio TWR (Unitized NAV)
    let nav = 100;
    let prevTotalValue = filteredBaseData[0].value;

    return filteredBaseData.map((d, idx) => {
      const currentTxs = transactions.filter(t => t.date === d.name);
      let cashFlow = 0;
      currentTxs.forEach(t => {
        if (t.direction === 'BUY') cashFlow += t.totalAmount;
        if (t.direction === 'SELL') cashFlow -= t.totalAmount;
        if (t.direction === 'DIVIDEND') cashFlow -= t.totalAmount;
      });

      // Linear Interpolation for Market Price to avoid step-like appearance
      let currentMarketPrice = baseMarketPrice;
      const exactEntry = benchmarkPrices.find(p => p.date === d.name);

      if (exactEntry) {
        currentMarketPrice = exactEntry.price;
      } else {
        const prevEntry = benchmarkPrices.filter(p => p.date < d.name).reverse()[0];
        const nextEntry = benchmarkPrices.find(p => p.date > d.name);

        if (prevEntry && nextEntry) {
          const t1 = new Date(prevEntry.date).getTime();
          const t2 = new Date(nextEntry.date).getTime();
          const tCur = new Date(d.name).getTime();
          const ratio = (tCur - t1) / (t2 - t1);
          currentMarketPrice = prevEntry.price + (nextEntry.price - prevEntry.price) * ratio;
        } else if (prevEntry) {
          currentMarketPrice = prevEntry.price;
        } else if (nextEntry) {
          currentMarketPrice = nextEntry.price;
        }
      }

      const marketRoi = ((currentMarketPrice / baseMarketPrice) - 1) * 100;

      if (idx > 0) {
        const valueBeforeCashflow = d.value - cashFlow;
        if (prevTotalValue > 0) {
          nav = nav * (valueBeforeCashflow / prevTotalValue);
        }
        prevTotalValue = d.value;
      }

      return {
        ...d,
        portfolioRoi: nav - 100,
        marketRoi,
        marketPrice: currentMarketPrice
      };
    });
  }, [chartData, weeklyPrices, transactions]);

  const handleAddTransaction = () => {
    if (!formData.ticker || formData.unitPrice < 0 || formData.quantity <= 0) return;

    if (formData.direction === 'SELL') {
      // 安全地計算真正可用的剩餘庫存 (總買入 - 總賣出，排除當前正在編輯的這筆)
      const relevantTxs = transactions.filter(t => t.ticker === formData.ticker);
      let trueAvailableShares = 0;
      relevantTxs.forEach(t => {
        if (t.direction === 'BUY') trueAvailableShares += t.quantity;
        if (t.direction === 'SELL' && t.id !== editingTxId) {
          trueAvailableShares -= t.quantity;
        }
      });
      
      const maxAllowed = Math.max(0, trueAvailableShares);

      if (formData.quantity > maxAllowed + 0.0001) {
        alert(`錯誤：賣出數量 (${formData.quantity}) 不可大於真實可用庫存 (${maxAllowed.toLocaleString()})！\n\n請確認先前的買入紀錄是否正確。`);
        return;
      }
    }

    const newTx: Transaction = {
      id: editingTxId || Math.random().toString(36).substr(2, 9),
      date: formData.date,
      ticker: formData.ticker,
      name: formData.name || formData.ticker,
      direction: formData.direction,
      quantity: formData.quantity,
      unitPrice: formData.unitPrice,
      category: formData.category,
      fee: preview.fee,
      tax: preview.tax,
      totalAmount: preview.total,
      notes: formData.notes,
      // Preserve realized status if editing
      isManualRealized: editingTxId ? transactions.find(t => t.id === editingTxId)?.isManualRealized : undefined
    };

    if (editingTxId) {
      setTransactions(transactions.map(t => t.id === editingTxId ? newTx : t));
      setEditingTxId(null);
      // Ensure we switch to the new ticker/name if it changed
      setSelectedTicker(newTx.ticker);
    } else {
      setTransactions([...transactions, newTx]);
    }

    setFormData(prev => ({
      ...prev,
      ticker: '',
      name: '',
      unitPrice: 0,
      quantity: 1000,
      notes: '',
      manualFee: ''
    }));
  };

  const handleRenameTicker = (oldTicker: string) => {
    const groupTxs = appData.stockGroups[oldTicker] || [];
    const currentName = groupTxs.length > 0 ? groupTxs[0].name : oldTicker;

    const newTicker = window.prompt(`正在修改「${currentName}」的代號\n請輸入新的代號 (ID):`, oldTicker);
    if (!newTicker || newTicker === oldTicker) return;

    const newName = window.prompt(`正在修改「${newTicker}」的顯示名稱\n請輸入新的名稱:`, currentName);
    if (!newName) return;

    if (window.confirm(`確定要將「${oldTicker} | ${currentName}」更名為「${newTicker} | ${newName}」嗎？\n這將更新 ${groupTxs.length} 筆交易紀錄。`)) {
      setTransactions(prev => prev.map(tx =>
        tx.ticker === oldTicker
          ? { ...tx, ticker: newTicker, name: newName }
          : tx
      ));
      setSelectedTicker(newTicker);

      // Update order if exists
      if (tickerOrder.includes(oldTicker)) {
        setTickerOrder(prev => prev.map(t => t === oldTicker ? newTicker : t));
      }

      // Update metadata
      if (tickerMetadata[oldTicker]) {
        setTickerMetadata(prev => {
          const next = { ...prev };
          next[newTicker] = next[oldTicker];
          delete next[oldTicker];
          return next;
        });
      }

      // Ask for Asset Class
      const ASSET_CLASSES = ['台股', '美股', 'ETF', '債券', '現金', '加密貨幣', '其他'];
      const currentClass = tickerMetadata[newTicker]?.assetClass || '未分類';
      const classInput = window.prompt(`請設定「${newName}」的資產類別\n預設：${ASSET_CLASSES.join('、')}\n(你也可以直接輸入新的類別名稱)`, currentClass);
      if (classInput) {
        handleUpdateTickerAssetClass(newTicker, classInput);
      }
    }
  };

  const handleUpdateTickerAssetClass = (ticker: string, assetClass: string) => {
    setTickerMetadata(prev => ({
      ...prev,
      [ticker]: { ...prev[ticker], assetClass }
    }));
  };

  const handleEditTx = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setFormData({
      date: tx.date,
      ticker: tx.ticker,
      name: tx.name,
      direction: tx.direction,
      quantity: tx.quantity,
      unitPrice: tx.unitPrice,
      category: tx.category,
      customFee: tx.fee,
      customTax: tx.tax,
      manualFee: tx.fee,
      notes: tx.notes || ''
    });
    setActiveView('A');

    // Auto-scroll to top smoothly
    setTimeout(() => {
      document.getElementById('tx-form-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleUpdateMarket = async () => {
    console.log('[手動更新] 開始手動一鍵更新最新收盤價...');
    
    // 取得所有有持股的台股代號
    const tickers = new Set();
    transactions.forEach(tx => {
      if (!tx.ticker) return;
      const ticker = tx.ticker.trim().toUpperCase();
      if (!['現金', 'CASH', 'TWD', 'USD'].includes(ticker)) {
        tickers.add(ticker);
      }
    });
    const heldTickers = Array.from(tickers) as string[];

    try {
      // 1. 如果在本地開發環境 (localhost)，先叫後端去爬官方最新價格寫入檔案
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        try {
          console.log('[手動更新] 偵測到本地環境，正在觸發後端 API 刷新股價...');
          const refreshRes = await fetch('/api/refresh', { method: 'POST' });
          if (refreshRes.ok) {
            console.log('[手動更新] 後端股價刷新成功！');
          }
        } catch (err: any) {
          console.warn('[手動更新] 呼叫後端刷新 API 失敗，將直接讀取現有檔案:', err.message);
        }
      }

      // 2. 從後端/靜態檔同步一次最新價格 (包含美股與大盤)
      const timestamp = Date.now();
      let url = `./stock_prices.json?t=${timestamp}`;
      if (window.location.hostname.includes('github.io')) {
        const repoName = window.location.pathname.split('/')[1] || 'Z-Test';
        url = `https://raw.githubusercontent.com/qazs792589-lang/${repoName}/main/stock_prices.json?t=${timestamp}`;
      } else {
        url = `https://raw.githubusercontent.com/qazs792589-lang/Z-Test/main/stock_prices.json?t=${timestamp}`;
      }
      console.log(`[手動更新] 正在從網址獲取最新價格: ${url}`);
      const res = await fetch(url, { cache: 'no-store' });
      let serverPrices: Record<string, number> = {};
      let serverDates: Record<string, string> = {};
      let serverUpdated: string | null = null;
      if (res.ok) {
        const serverData = await res.json();
        serverPrices = serverData.prices || {};
        serverDates = serverData.dates || {};
        serverUpdated = serverData.updated || null;
      }

      // 3. 跨網域直接呼叫台灣證交所與櫃買中心 API (當作 GitHub Pages 的前端直連備援)
      const pricesMap: Record<string, number> = {};
      try {
        const twseRes = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
        if (twseRes.ok) {
          const data = await twseRes.json();
          data.forEach((item: any) => {
            const code = item.Code ? item.Code.trim() : '';
            const price = parseFloat(item.ClosingPrice);
            if (code && !isNaN(price)) pricesMap[code] = price;
          });
        }
      } catch (err: any) {
        console.warn('[手動更新] 瀏覽器前端直連 TWSE 失敗 (可能受 CORS 限制，此為正常現象，已使用伺服器快取):', err.message);
      }

      try {
        const tpexRes = await fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes');
        if (tpexRes.ok) {
          const data = await tpexRes.json();
          data.forEach((item: any) => {
            const code = item.SecuritiesCompanyCode ? item.SecuritiesCompanyCode.trim() : '';
            const price = parseFloat(item.Close);
            if (code && !isNaN(price)) pricesMap[code] = price;
          });
        }
      } catch (err: any) {
        console.warn('[手動更新] 瀏覽器前端直連 TPEx 失敗 (可能受 CORS 限制，此為正常現象，已使用伺服器快取):', err.message);
      }

      // 4. 計算目前最新台灣交易日日期
      const now = new Date();
      const twTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      const hour = twTime.getUTCHours();
      let tradingDate = new Date(twTime.getTime());
      if (hour < 14) tradingDate.setDate(tradingDate.getDate() - 1);
      const dayOfWeek = tradingDate.getDay();
      if (dayOfWeek === 6) tradingDate.setDate(tradingDate.getDate() - 1);
      else if (dayOfWeek === 0) tradingDate.setDate(tradingDate.getDate() - 2);
      const twDateStr = tradingDate.toISOString().split('T')[0];

      // 5. 合併直接抓到的台股價格與伺服器價格
      const mergedPrices = { ...serverPrices };
      const mergedDates = { ...serverDates };
      
      heldTickers.forEach(ticker => {
        // 如果是台股且前端直接呼叫成功，則用前端的覆蓋
        if (/^\d+[A-Z]?$/.test(ticker) && pricesMap[ticker] !== undefined) {
          mergedPrices[ticker] = pricesMap[ticker];
          mergedDates[ticker] = twDateStr;
        }
      });

      // 比對有多少檔股票的現價與本地 LocalStorage 內的不同
      let updateCount = 0;
      heldTickers.forEach(ticker => {
        const newPrice = mergedPrices[ticker];
        const oldPrice = marketData.prices[ticker];
        if (newPrice !== undefined && newPrice !== oldPrice) {
          updateCount++;
        }
      });

      // 6. 更新現價狀態
      setMarketData({
        updated: serverUpdated || new Date().toISOString(),
        prices: mergedPrices
      });

      // 7. 自動補登與更新歷史收盤價中 (weeklyPrices)
      let autoLogCount = 0;
      setWeeklyPrices(prev => {
        let hasChanges = false;
        
        // 1. 先更新已存在的日期之價格 (如果不同)
        const updatedList = prev.map(wp => {
          const price = mergedPrices[wp.ticker];
          const date = mergedDates[wp.ticker] || twDateStr;
          if (price !== undefined && wp.date === date) {
            const numericPrice = Number(price);
            if (!isNaN(numericPrice) && wp.price !== numericPrice) {
              console.log(`[手動更新] 更新 ${wp.ticker} 在 ${wp.date} 的價格: ${wp.price} -> ${numericPrice}`);
              hasChanges = true;
              autoLogCount++;
              return { ...wp, price: numericPrice };
            }
          }
          return wp;
        });
        
        // 2. 再補登不存在的價格
        heldTickers.forEach(ticker => {
          const price = mergedPrices[ticker];
          const date = mergedDates[ticker] || twDateStr;
          if (price === undefined || isNaN(price)) return;
          
          const exists = updatedList.some(wp => wp.ticker === ticker && wp.date === date);
          if (!exists) {
            updatedList.push({ date, ticker, price: Number(price) });
            hasChanges = true;
            autoLogCount++;
          }
        });

        // 永遠補登大盤
        if (mergedPrices['^TWII']) {
          const date = mergedDates['^TWII'] || twDateStr;
          const exists = updatedList.some(wp => wp.ticker === '^TWII' && wp.date === date);
          if (!exists) {
            updatedList.push({ date, ticker: '^TWII', price: Number(mergedPrices['^TWII']) });
            hasChanges = true;
            autoLogCount++;
          }
        }

        if (hasChanges) {
          return updatedList.sort((a, b) => {
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.ticker.localeCompare(b.ticker);
          });
        }
        return prev;
      });

      if (updateCount > 0 || autoLogCount > 0) {
        alert(`一鍵更新完成！成功更新了 ${updateCount} 檔股票的最新現價，並自動補登了 ${autoLogCount} 筆歷史收盤價！`);
      } else {
        alert('股價與歷史紀錄已是最新狀態，無需重複更新！');
      }
    } catch (e: any) {
      console.error('[手動更新] 發生錯誤:', e);
      alert('手動更新失敗: ' + e.message);
    }
  };

  const handleToggleUncleared = (txId: string) => {
    setTransactions(prev => prev.map(tx =>
      tx.id === txId ? { ...tx, isUncleared: !tx.isUncleared } : tx
    ));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-main)] font-sans flex flex-col">
      <AnimatePresence>
        {isLocked && appPassword && (
          <LockScreen savedPassword={appPassword} onUnlock={() => setIsLocked(false)} />
        )}
      </AnimatePresence>
      {/* Header */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-between px-4 md:px-6 z-40 shadow-lg h-16 shrink-0 sticky top-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-[rgba(255,255,255,0.05)] rounded-lg text-[var(--accent)]"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <button
            onClick={() => {
              setTheme(t => {
                const currentIndex = themes.indexOf(t as any);
                return themes[(currentIndex + 1) % themes.length];
              });
            }}
            className="flex items-center gap-2 hover:opacity-80 active:scale-95 transition-all group"
            title="點擊圖示切換主題風格"
          >
            <img
              src="/Z-Test/logo.png"
              alt="Z-Ledger Logo"
              className={cn(
                "h-10 md:h-12 object-contain rounded-md transition-all duration-300",
                (theme === 'light' || theme === 'zen') ? "shadow-none" : "shadow-[0_0_25px_var(--accent-glow)]"
              )}
              style={(theme === 'light' || theme === 'zen') ? { filter: 'invert(1) hue-rotate(180deg) brightness(1.2) contrast(1.2)', mixBlendMode: 'darken' } : {}}
            />
            <span className="text-[var(--text-main)] font-bold text-xs md:text-base uppercase tracking-widest hidden xs:inline-block ml-1 group-hover:text-[var(--accent)] transition-colors">投資管理系統</span>
          </button>
        </div>
        <div className="flex items-center gap-3 md:gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[8px] md:text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-widest">資產總市值</span>
            <span className="text-xs md:text-sm font-mono font-bold text-[var(--accent)]">${stats.totalMarketValue.toLocaleString()}</span>
          </div>
          <div className="h-8 w-[1px] bg-[var(--border)] hidden sm:block" />
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-[8px] md:text-[10px] text-[var(--text-dim)] font-bold uppercase tracking-widest">總損益 (含歷史+股息)</span>
            <div className={cn("text-xs md:text-sm font-mono font-bold", stats.totalPL >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
              {stats.totalPL >= 0 ? '▲' : '▼'} ${Math.abs(stats.totalPL).toLocaleString()}
              <span className="ml-2 text-[10px] md:text-xs">({stats.roi.toFixed(2)}%)</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar: Navigation Controller */}
        <aside className={cn(
          "bg-[var(--bg-secondary)] border-r border-[var(--border)] p-6 flex flex-col gap-8 transition-all duration-300 z-[100] fixed top-16 left-0 h-[calc(100vh-64px)] overflow-y-auto shadow-2xl",
          isSidebarOpen ? "translate-x-0 w-[260px]" : "-translate-x-full lg:translate-x-0 lg:w-[80px] lg:px-4"
        )}>
          <div>
            <span className={cn(
              "text-[10px] font-bold text-[var(--text-dim)] uppercase tracking-widest pl-2 mb-4 block transition-opacity",
              !isSidebarOpen && "lg:opacity-0"
            )}>
              Navigator
            </span>
            <nav className="flex flex-col gap-2">
              {[
                { id: 'A', label: '交易/明細', icon: Plus, desc: 'Groups & Entry' },
                { id: 'B', label: '未實現損益', icon: LayoutDashboard, desc: 'Portfolio' },
                { id: 'C', label: '已實現損益', icon: History, desc: 'History ROI' },
                { id: 'D', label: '系統設定', icon: SettingsIcon, desc: 'Settings' },
              ].map((nav) => (
                <button
                  key={nav.id}
                  onClick={() => {
                    setActiveView(nav.id as any);
                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all border group relative overflow-hidden",
                    activeView === nav.id
                      ? "bg-[var(--bg-tertiary)] border-[var(--accent)] text-[var(--accent)] shadow-[0_0_20px_rgba(0,242,255,0.1)]"
                      : "bg-transparent border-transparent text-[var(--text-dim)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--text-main)]",
                    !isSidebarOpen && "lg:px-0 lg:justify-center"
                  )}
                >
                  {activeView === nav.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--accent)] blur-[2px]" />}
                  <nav.icon size={18} />
                  <div className={cn(
                    "flex flex-col items-start leading-none text-left transition-all",
                    !isSidebarOpen && "lg:hidden"
                  )}>
                    <span className="text-sm font-bold">{nav.label}</span>
                  </div>
                </button>
              ))}
            </nav>
          </div>

        </aside>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <main className={cn(
          "flex-1 overflow-y-auto px-2 py-4 md:p-8 bg-[var(--bg-primary)] transition-all duration-300",
          isSidebarOpen ? "lg:ml-[260px]" : "lg:ml-[80px]"
        )}>
          {activeView === 'A' && (
            <div id="tx-form-container" className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6 pt-2">
              <div>
                <h2 className="text-xl font-black mb-4 flex items-center gap-3 text-[var(--text-main)] transition-all">
                  {editingTxId ? (
                    <><Edit2 className="text-orange-500 animate-pulse" /> <span className="text-orange-500">編輯交易紀錄</span> <span className="text-[10px] bg-orange-500/20 text-orange-500 px-3 py-1 rounded-full ml-auto font-bold uppercase tracking-widest">編輯模式</span></>
                  ) : (
                    <><Plus className="text-[var(--accent)]" /> 交易/明細</>
                  )}
                </h2>

                <div className={cn("elegant-card space-y-6 transition-all", editingTxId && "border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.1)]")}>
                  {/* SPLIT INPUTS with Auto-Mapping */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <label className="elegant-label text-xs">股票代號</label>
                      <div className="relative">
                        <input
                          type="text"
                          className="elegant-input text-lg uppercase pl-10"
                          placeholder="e.g. 2330"
                          value={formData.ticker}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            const mappedName = stockMap.tMap[val];
                            setFormData({
                              ...formData,
                              ticker: val,
                              name: mappedName || formData.name // Auto-fill name if found
                            });
                          }}
                        />
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" size={18} />
                      </div>
                    </div>
                    <div className="relative">
                      <label className="elegant-label text-xs">股票名稱</label>
                      <div className="relative">
                        <input
                          type="text"
                          className="elegant-input text-lg pl-10"
                          placeholder="e.g. 台積電"
                          value={formData.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            const mappedTicker = stockMap.nMap[val.toUpperCase()];
                            setFormData({
                              ...formData,
                              name: val,
                              ticker: mappedTicker || formData.ticker // Auto-fill ticker if found
                            });
                          }}
                        />
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" size={18} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="elegant-label text-xs">交易日期</label>
                      <div
                        className="relative group cursor-pointer"
                        onClick={(e) => {
                          const input = e.currentTarget.querySelector('input');
                          if (input) {
                            try {
                              input.showPicker();
                            } catch (err) {
                              input.focus();
                            }
                          }
                        }}
                      >
                        <input
                          type="date"
                          className="elegant-input w-full block cursor-pointer text-left"
                          value={formData.date}
                          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="elegant-label text-xs">備註 (Notes)</label>
                      <input
                        type="text"
                        className="elegant-input w-full h-[42px] text-sm"
                        placeholder="e.g. 分批買入, 突破買入..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="col-span-2 md:col-span-1">
                      <label className="elegant-label">交易方向</label>
                      <div className="flex bg-[var(--bg-primary)] p-1 border border-[var(--border)] rounded h-[46px] items-stretch">
                        {(['BUY', 'SELL', 'DIVIDEND'] as TransactionDirection[]).map(dir => (
                          <button
                            key={dir}
                            onClick={() => setFormData({ ...formData, direction: dir })}
                            className={cn(
                              "flex-1 flex items-center justify-center text-[10px] font-bold rounded transition-all",
                              formData.direction === dir
                                ? (dir === 'BUY' ? "bg-[var(--danger)] text-white" : dir === 'SELL' ? "bg-[var(--success)] text-white" : "bg-yellow-500 text-black")
                                : "text-[var(--text-dim)]"
                            )}
                          >
                            {dir === 'BUY' ? '買入' : dir === 'SELL' ? '賣出' : '股息'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="elegant-label">{formData.direction === 'DIVIDEND' ? '每股股息' : '單價'}</label>
                      <input
                        type="number"
                        className="elegant-input h-[46px]"
                        value={formData.unitPrice || ''}
                        onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="elegant-label">股數</label>
                      <input
                        type="number"
                        className="elegant-input h-[46px]"
                        value={formData.quantity || ''}
                        onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl p-6 relative overflow-hidden">
                    <div className="relative z-10">
                      <span className="elegant-label mb-4 flex items-center gap-2 text-[var(--accent)]">
                        <Calculator size={14} /> 即時預覽估算 (Live Calc)
                      </span>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 items-end">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-tighter mb-1 font-bold">{preview.feeLabel}</span>
                          <div className="relative group">
                            <input
                              type="number"
                              className="bg-transparent border-none p-0 text-2xl font-mono text-[var(--text-main)] font-black w-full focus:outline-none focus:ring-0 placeholder:opacity-20"
                              value={formData.manualFee}
                              placeholder={preview.autoFee?.toString()}
                              onChange={(e) => setFormData({ ...formData, manualFee: e.target.value })}
                            />
                            <div className="absolute bottom-0 left-0 w-full h-px bg-[var(--accent)] opacity-10 group-hover:opacity-40 transition-opacity" />
                          </div>
                        </div>

                        <div className="flex flex-col text-right lg:text-left">
                          <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-tighter mb-1 font-bold">{preview.taxLabel}</span>
                          <span className="text-2xl font-mono text-[var(--text-main)] font-black">${preview.tax.toLocaleString()}</span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-[10px] text-[var(--accent)] uppercase tracking-tighter mb-1 font-bold">淨交割 (Net Total)</span>
                          <span className={cn(
                            "text-2xl md:text-3xl font-mono font-black tracking-tighter",
                            formData.direction === 'BUY' ? "text-[var(--danger)]" : formData.direction === 'SELL' ? "text-[var(--success)]" : "text-orange-400"
                          )}>${Math.abs(preview.total).toLocaleString()}</span>
                        </div>

                        <div className="flex gap-2">
                          {editingTxId && (
                            <button
                              onClick={() => {
                                setEditingTxId(null);
                                setFormData(prev => ({ ...prev, ticker: '', name: '', unitPrice: 0, quantity: 1000, notes: '' }));
                              }}
                              className="w-1/3 bg-[var(--accent)] text-white h-[48px] md:h-[56px] rounded-xl font-black text-sm md:text-base hover:opacity-90 active:scale-[0.95] transition-all flex items-center justify-center gap-2"
                            >
                              取消
                            </button>
                          )}
                          <button
                            onClick={handleAddTransaction}
                            disabled={!formData.ticker || formData.unitPrice <= 0 || formData.quantity <= 0}
                            className={cn(
                              "bg-[var(--accent)] text-[var(--bg-primary)] h-[48px] md:h-[56px] rounded-xl font-black text-sm md:text-base hover:brightness-110 shadow-[0_0_20px_rgba(0,242,255,0.2)] active:scale-[0.95] transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed",
                              editingTxId ? "w-2/3" : "w-full"
                            )}
                          >
                            {editingTxId ? '儲存修改' : '確認記錄'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border)] text-[var(--accent)]">
                        <Briefcase size={18} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-[var(--text-main)] leading-tight">投資組合明細</h4>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateMarket}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border bg-[var(--bg-secondary)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text-main)] hover:border-[var(--accent)] flex items-center gap-2"
                      >
                        <TrendingUp size={12} /> 一鍵更新
                      </button>
                      <button
                        onClick={() => setIsEditingTickers(!isEditingTickers)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2",
                          isEditingTickers
                            ? "bg-[var(--success)] text-white border-[var(--success)]"
                            : "bg-[var(--bg-secondary)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text-main)]"
                        )}
                      >
                        {isEditingTickers ? <><Check size={12} /> 完成排序</> : <><Palette size={12} /> 編輯順序</>}
                      </button>
                    </div>
                  </div>

                  {/* Modern Ticker Navigation */}
                  <div className="overflow-x-auto scrollbar-none touch-pan-x">
                    <TickerPillList
                      tickerOrder={tickerOrder}
                      setTickerOrder={setTickerOrder}
                      selectedTicker={selectedTicker}
                      setSelectedTicker={setSelectedTicker}
                      stockMap={stockMap.tMap}
                      holdingsMap={appData.holdingsMap}
                      onRenameTicker={handleRenameTicker}
                      onDeleteTicker={handleDeleteHolding}
                      onImportBackup={() => fileInputRef.current?.click()}
                      onUpdateMarket={handleUpdateMarket}
                      isEditing={isEditingTickers}
                      allTickers={Object.keys(appData.stockGroups)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {(selectedTicker || Object.keys(appData.stockGroups)[0]) ? (
                    (() => {
                      const ticker = selectedTicker || Object.keys(appData.stockGroups).sort()[0];
                      const txs = appData.stockGroups[ticker] || [];
                      const h = appData.holdingsMap[ticker] || { name: ticker, currentShares: 0, avgCost: 0, totalInvested: 0, realizedPL: 0 };
                      const latestWeekly = weeklyPrices.filter(wp => wp.ticker === ticker).sort((a, b) => b.date.localeCompare(a.date))[0]?.price;
                      const curPrice = marketData.prices[ticker] || latestWeekly || h.avgCost;
                      const unrealizedPL = ((curPrice - h.avgCost) * h.currentShares) + ((h as any).unrealizedDividends || 0);
                      const totalPL = unrealizedPL + (h.realizedPL || 0);

                      const roi = h.avgCost > 0
                        ? ((curPrice / h.avgCost) - 1) * 100
                        : (h.totalInvested === 0 && h.realizedPL !== 0 ? 100 : 0);
                      const displayName = txs.length > 0 ? txs[0].name : h.name;

                      return (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                          <div className="elegant-card bg-[var(--bg-secondary)] overflow-hidden p-0 border-[var(--border)] shadow-2xl space-y-px">
                            <div className="flex flex-col bg-[var(--bg-tertiary)] border-b border-[var(--border)]">
                              <div className="p-4 md:p-8 bg-[var(--bg-secondary)] flex flex-col justify-center">
                                <div className="flex flex-row items-end justify-between gap-2 md:gap-6 mb-4 md:mb-6">
                                  <div className="flex flex-col min-w-0 flex-shrink">
                                    <h5
                                      onClick={() => handleRenameTicker(ticker)}
                                      className="text-xl md:text-3xl lg:text-4xl font-black text-[var(--text-main)] tracking-tighter mb-1 md:mb-2 truncate cursor-pointer hover:text-[var(--accent)] transition-colors"
                                      title="點擊修改名稱或代號"
                                    >
                                      {displayName}
                                    </h5>
                                    <div className="flex items-center gap-1 md:gap-2">
                                      <span
                                        onClick={() => handleRenameTicker(ticker)}
                                        className="px-1.5 py-0.5 md:px-2 md:py-1 bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--accent)] rounded text-[9px] md:text-xs font-mono font-bold tracking-widest leading-none cursor-pointer hover:bg-[var(--accent)] hover:text-[var(--bg-primary)] transition-all"
                                        title="點擊修改代號"
                                      >
                                        {ticker}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-right flex-shrink-0 mt-2 md:mt-0">
                                    <p className="text-2xl md:text-4xl lg:text-5xl font-mono font-black text-[var(--accent)] tracking-tighter leading-none mb-1 md:mb-2">${(h.currentShares * curPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                    <p className={cn("text-[10px] md:text-xs font-bold font-mono", unrealizedPL >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
                                      {unrealizedPL >= 0 ? '▲' : '▼'} ${(Math.abs(unrealizedPL)).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({roi.toFixed(2)}%)
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 pt-8 border-t border-[var(--border)]">
                                  <div>
                                    <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.2em] font-black opacity-60 block mb-2">持有股數</span>
                                    <p className="text-2xl md:text-3xl lg:text-4xl font-mono font-black text-[var(--text-main)] leading-none">{h.currentShares.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.2em] font-black opacity-60 block mb-2">目前市價</span>
                                    <p className="text-2xl md:text-3xl lg:text-4xl font-mono font-black text-[var(--text-main)] leading-none">${curPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text(--var-text-dim)] uppercase tracking-[0.2em] font-black opacity-60 block mb-2">平均成本</span>
                                    <p className="text-2xl md:text-3xl lg:text-4xl font-mono font-black text-[var(--text-main)] leading-none">${h.avgCost.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-[0.2em] font-black opacity-60 block mb-2">總投入本金</span>
                                    <p className="text-2xl md:text-3xl lg:text-4xl font-mono font-black text-[var(--text-main)] leading-none">${h.totalInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                                <div className="px-6 py-3 flex items-center justify-between bg-[var(--bg-tertiary)]">
                                  <span className="text-[9px] font-black tracking-[0.2em] text-[var(--text-dim)] uppercase">歷史交易明細表</span>
                                  <span className="text-[9px] font-mono text-[var(--text-dim)] border border-[var(--border)] px-2 py-0.5 rounded italic opacity-50">{txs.length} 筆資料</span>
                                </div>
                                <div className="">
                                  <AnimatePresence initial={false}>
                                    {[...(txs as Transaction[])].sort((a, b) => b.date.localeCompare(a.date)).map(tx => (
                                      <TransactionRow
                                        key={tx.id}
                                        tx={tx}
                                        onEdit={handleEditTx}
                                        onDelete={handleDeleteTransaction}
                                        onToggleRealized={handleToggleRealized}
                                      />
                                    ))}
                                  </AnimatePresence>
                                </div>
                              </div>

                              <div className="p-4 md:p-8 bg-[var(--bg-primary)] border-t border-[var(--border)]">
                                <div className="h-[300px] md:h-[450px] rounded-xl overflow-hidden border border-[var(--border)] relative group">
                                  <StockChartWidget ticker={ticker} transactions={txs} weeklyPrices={weeklyPrices.filter(wp => wp.ticker === ticker)} marketData={marketData} />
                                </div>
                              </div>
                            </div>

                            <div className="bg-[var(--bg-tertiary)] p-3 md:p-6 border-b border-[var(--border)] space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black tracking-[0.2em] text-[var(--text-dim)] uppercase">收盤價登錄</span>
                                <div className="flex gap-2">
                                  <input
                                    type="file"
                                    ref={weeklyFileInputRef}
                                    onChange={(e) => handleWeeklyCsvImport(e, ticker)}
                                    accept=".csv"
                                    className="hidden"
                                  />
                                  <button
                                    onClick={() => weeklyFileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[8px] font-bold text-[var(--text-dim)] hover:text-[var(--text-main)] transition-all uppercase tracking-widest"
                                  >
                                    <FileUp size={10} /> 匯入 CSV
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <div className="flex gap-2">
                                  <input
                                    type="date"
                                    className="elegant-input flex-[1.4] px-2 py-2 text-xs text-left"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                  />
                                  <input
                                    type="number"
                                    className="elegant-input flex-1 px-2 py-2 text-xs"
                                    placeholder="Price"
                                    value={formData.unitPrice || ''}
                                    onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })}
                                  />
                                </div>
                                <button
                                  className="w-full bg-[var(--accent)] text-[var(--bg-primary)] py-2.5 rounded-lg font-bold text-xs shadow-xl active:scale-[0.98] transition-all"
                                  onClick={() => {
                                    const others = weeklyPrices.filter(p => !(p.date === formData.date && p.ticker === ticker));
                                    const newPrices = [...others, { date: formData.date, ticker, price: formData.unitPrice }]
                                      .sort((a, b) => a.date.localeCompare(b.date));
                                    setWeeklyPrices(newPrices);
                                  }}
                                >新增紀錄</button>
                              </div>
                              <div className="space-y-2 mt-4">
                                {weeklyPrices.filter(wp => wp.ticker === ticker)
                                  .sort((a, b) => b.date.localeCompare(a.date))
                                  .map((wp, i) => {
                                    const pastTxs = txs.filter(t => t.date <= wp.date);
                                    let historicalShares = 0;
                                    let historicalCost = 0;

                                    pastTxs.forEach(t => {
                                      if (t.direction === 'BUY') {
                                        historicalShares += t.quantity;
                                        historicalCost += t.totalAmount;
                                      } else if (t.direction === 'SELL') {
                                        const currentAvg = historicalShares > 0 ? historicalCost / historicalShares : 0;
                                        historicalShares -= t.quantity;
                                        historicalCost -= (currentAvg * t.quantity);
                                      }
                                    });

                                    const historicalAvgCost = historicalShares > 0 ? historicalCost / historicalShares : 0;
                                    const historicalPL = (wp.price - historicalAvgCost) * historicalShares;
                                    const historicalRoi = historicalAvgCost > 0 ? ((wp.price / historicalAvgCost) - 1) * 100 : 0;

                                    return (
                                      <div key={i} className="flex justify-between items-center bg-[var(--bg-primary)] border border-[var(--border)] p-3 rounded-xl text-xs font-mono group hover:bg-[var(--bg-secondary)] transition-all">
                                        <div className="flex flex-col gap-1 flex-1">
                                          <div className="flex items-center gap-3">
                                            <span className="opacity-50 text-[10px]">{wp.date}</span>
                                            <span className="font-bold text-[var(--accent)]">${wp.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                            {historicalShares > 0 && (
                                              <span className="text-[9px] px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--text-dim)]">
                                                {historicalShares.toLocaleString(undefined, { maximumFractionDigits: 2 })} 股
                                              </span>
                                            )}
                                          </div>
                                          {historicalShares > 0 && (
                                            <div className="flex items-center gap-3 opacity-80">
                                              <span className={cn("text-[10px] font-bold", historicalPL >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]")}>
                                                {historicalPL >= 0 ? '▲' : '▼'} ${Math.abs(historicalPL).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                              </span>
                                              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-sm", historicalPL >= 0 ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--danger)]/10 text-[var(--danger)]")}>
                                                {historicalRoi >= 0 ? '+' : ''}{historicalRoi.toFixed(2)}%
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <button
                                            className="text-[var(--accent)] hover:underline flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100"
                                            onClick={() => {
                                              setFormData({ ...formData, date: wp.date, unitPrice: wp.price });
                                              const entryHeader = Array.from(document.querySelectorAll('span')).find(el => el.textContent === '收盤價登錄');
                                              entryHeader?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            }}
                                          >
                                            <Edit2 size={10} /> 編輯
                                          </button>
                                          <button
                                            className="text-[var(--danger)] hover:underline flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100"
                                            onClick={() => {
                                              if (window.confirm('確定要刪除這筆收盤價紀錄嗎？')) {
                                                setWeeklyPrices(weeklyPrices.filter(item => !(item.date === wp.date && item.ticker === wp.ticker)));
                                              }
                                            }}
                                          >
                                            <Trash2 size={10} /> 刪除
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="elegant-card p-16 text-center text-[var(--text-dim)] italic border-dashed border-[var(--border)] bg-[var(--bg-secondary)]">
                      尚未登錄 any 交易明細，請於上方輸入第一筆資料。
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeView === 'B' && (
            <PortfolioView
              stats={stats}
              chartData={finalChartData}
              appData={appData}
              marketData={marketData}
              weeklyPrices={weeklyPrices}
              setSelectedTicker={setSelectedTicker}
              setActiveView={setActiveView}
              tickerOrder={tickerOrder}
              setWeeklyPrices={setWeeklyPrices}
              tickerMetadata={tickerMetadata}
              onUpdateAssetClass={handleUpdateTickerAssetClass}
            />
          )}

          {activeView === 'C' && (
            <RealizedView
              appData={appData}
              onImport={handleHistoryCsvImport}
              onUpdateNotes={handleUpdateTransactionNotes}
              onToggleRealized={handleToggleRealized}
              netWorthEntries={netWorthEntries}
              setNetWorthEntries={setNetWorthEntries}
              historicalChartData={finalChartData}
              tickerMetadata={tickerMetadata}
              holdings={appData.activeHoldings}
              marketPrices={marketData.prices}
            />
          )}

          {activeView === 'D' && (
            <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pt-4 pb-20">
              <div className="flex items-center gap-4 mb-8 px-2">
                <div className="p-3 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border)] text-[var(--accent)] shadow-xl">
                  <SettingsIcon size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-[var(--text-main)]">系統設定</h2>
                  <p className="text-xs text-[var(--text-dim)]">管理您的 PIN 碼鎖與應用程式資料</p>
                </div>
              </div>

              <div className="elegant-card space-y-8">
                {/* PIN Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                    <Shield size={16} className="text-[var(--accent)]" />
                    {appPassword ? '修改 PIN 碼鎖' : '啟用 PIN 碼鎖'}
                  </h3>
                  <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl border border-[var(--border)]">
                    <label className="text-[10px] font-bold text-[var(--text-dim)] uppercase mb-3 block">
                      請輸入 4-6 位數字
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="••••••"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl px-4 py-3 text-center font-mono tracking-[1em] text-2xl mb-4 focus:border-[var(--accent)] outline-none transition-all"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          if (newPass.length >= 4) {
                            setAppPassword(newPass);
                            setNewPass('');
                            alert('密碼設定成功！');
                          } else {
                            alert('請輸入 4-6 位數字');
                          }
                        }}
                        className="flex-1 bg-[var(--accent)] text-[var(--bg-primary)] py-3 rounded-xl text-sm font-black shadow-lg shadow-[var(--accent-glow)] active:scale-95 transition-transform"
                      >
                        儲存新密碼
                      </button>
                      {appPassword && (
                        <button
                          onClick={() => {
                            if (window.confirm('確定要關閉密碼鎖嗎？')) {
                              setAppPassword('');
                              setNewPass('');
                            }
                          }}
                          className="flex-1 bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/30 py-3 rounded-xl text-sm font-bold hover:bg-[var(--danger)]/20 active:scale-95 transition-all"
                        >
                          解除密碼鎖
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Backup & Recovery */}
                <div className="pt-6 border-t border-[var(--border)] space-y-4">
                  <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                    <Database size={16} className="text-[var(--accent)]" />
                    數據備份與恢復
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={handleExportFullJson}
                      className="flex flex-col items-center gap-3 p-6 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl hover:border-[var(--accent)] transition-all group shadow-lg"
                    >
                      <div className="p-3 bg-[var(--accent)]/10 rounded-full text-[var(--accent)] group-hover:scale-110 transition-transform">
                        <FileUp size={20} />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-black">匯出全系統備份</div>
                        <div className="text-[9px] text-[var(--text-dim)] mt-1">最完整！搬家與永久存檔專用</div>
                      </div>
                    </button>

                    <label className="flex flex-col items-center gap-3 p-6 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-2xl hover:border-[var(--accent)] cursor-pointer transition-all group shadow-lg">
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleImportFullJson}
                      />
                      <div className="p-3 bg-[var(--accent)]/10 rounded-full text-[var(--accent)] group-hover:scale-110 transition-transform">
                        <History size={20} />
                      </div>
                      <div className="text-center">
                        <div className="text-xs font-black">匯入系統還原</div>
                        <div className="text-[9px] text-[var(--text-dim)] mt-1">完全覆蓋並恢復所有資料</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="pt-6 border-t border-[var(--border)]">
                  <h3 className="text-sm font-bold text-[var(--danger)] flex items-center gap-2 mb-4">
                    <AlertCircle size={16} /> 危險區域
                  </h3>
                  <div className="p-4 bg-[var(--danger)]/5 rounded-xl border border-[var(--danger)]/20 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-xs font-bold text-[var(--text-main)] mb-1">重置所有資料</div>
                      <p className="text-[10px] text-[var(--text-dim)] leading-relaxed">
                        這將立即清除所有存儲在本地的交易紀錄、匯入的收盤價以及所有個人設定。此操作無法撤銷。
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm('【確認 1/3】警告：這將徹底清除所有資料！確定要繼續嗎？')) {
                          if (window.confirm('【確認 2/3】資料將永久遺失，真的真的確定嗎？')) {
                            if (window.confirm('【最後確認 3/3】點擊後所有紀錄將被刪除。您確定嗎？')) {
                              localStorage.clear();
                              window.location.reload();
                            }
                          }
                        }
                      }}
                      className="shrink-0 bg-[var(--danger)] text-white px-4 py-2.5 rounded-lg text-xs font-black shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <Skull size={14} /> 立刻重置
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
