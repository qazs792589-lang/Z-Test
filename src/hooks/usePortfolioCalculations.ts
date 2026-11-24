import { ensureTransactionSequence } from '../lib/transactionOrder';
import { addShares, getSaleAllocation } from '../lib/shareMath';
import { compareSpotTransactions } from '../lib/spotInventory';
import { usesEstimatedTwdAmount } from '../lib/usDisplay';
import { useMemo } from 'react';
import { Holding, RealizedProfit, Transaction, WeeklyPrice } from '../types';
import { getSellNetAmounts, getDividendNetAmounts, isTxRealized } from '../lib/txUtils';

export const usePortfolioCalculations = (transactions: Transaction[], marketData: { updated: string | null; prices: Record<string, number> }, weeklyPrices: WeeklyPrice[]) => {
  const appData = useMemo(() => {
    const holdings: Record<string, Holding & {
      totalBuyFees: number;
      firstBuyDate?: string;
      unrealizedDividends: number;
      _mathShares: number;
      _mathCost: number;
      _mathFees: number;
      // 額外台幣欄位
      totalInvestedTwd: number;
      realizedPLTwd: number;
      unrealizedDividendsTwd: number;
      avgCostTwd: number;
      _mathCostTwd: number;
      hasEstimatedTwdCost: boolean;
      latestPrice?: number;
      unrealizedPL?: number;
      unrealizedPLTwd?: number;
    }> = {};
    const realizedList: RealizedProfit[] = [];
    const stockGroups: Record<string, Transaction[]> = {};

    // Sort transactions by date for correct sequential calculation
    const sortedTxs = [...ensureTransactionSequence(transactions)].sort(compareSpotTransactions);

    // Use separate pools for 'Display/Active' and 'Mathematical/Global' tracking
    sortedTxs.forEach(tx => {
      if (!stockGroups[tx.ticker]) stockGroups[tx.ticker] = [];
      stockGroups[tx.ticker].push(tx);

      const isRealized = isTxRealized(tx);
      const isUS = tx.currency === 'USD';

      if (!holdings[tx.ticker]) {
        holdings[tx.ticker] = {
          ticker: tx.ticker, name: tx.name,
          currentShares: 0, avgCost: 0, totalInvested: 0, realizedPL: 0, totalBuyFees: 0,
          unrealizedDividends: 0,
          _mathShares: 0, _mathCost: 0, _mathFees: 0, // Shadow math tracking
          totalInvestedTwd: 0,
          realizedPLTwd: 0,
          unrealizedDividendsTwd: 0,
          avgCostTwd: 0,
          _mathCostTwd: 0,
          hasEstimatedTwdCost: false
        };
      }

      const h = holdings[tx.ticker];
      
      // 計算台幣實際投入金額（若有 twdAmount 則使用，否則乘以 31）
      const twdBuyAmount = isUS
        ? (tx.twdAmount || (Math.abs(tx.totalAmount) * 31))
        : Math.abs(tx.totalAmount);

      if (tx.direction === 'BUY') {
        // Update Shadow Math (Always tracks everything to maintain a correct cost basis)
        const newMathShares = addShares(h._mathShares, tx.quantity);
        const newMathCost = h._mathCost + Math.abs(tx.totalAmount);
        const newMathCostTwd = h._mathCostTwd + twdBuyAmount;

        h.avgCost = newMathShares > 0 ? newMathCost / newMathShares : 0;
        h.avgCostTwd = newMathShares > 0 ? newMathCostTwd / newMathShares : 0;

        h._mathShares = newMathShares;
        h._mathCost = newMathCost;
        h._mathCostTwd = newMathCostTwd;
        h._mathFees += tx.fee + tx.tax;

        // Update Active Holding (Only if NOT manually marked realized)
        if (!isRealized) {
          if (h.currentShares === 0) h.firstBuyDate = tx.date;
          h.currentShares = addShares(h.currentShares, tx.quantity);
          h.totalInvested += Math.abs(tx.totalAmount);
          h.totalInvestedTwd += twdBuyAmount;
          h.hasEstimatedTwdCost = h.hasEstimatedTwdCost || usesEstimatedTwdAmount(tx);
          h.totalBuyFees += tx.fee + tx.tax;
        }
      } else if (tx.direction === 'SELL') {
        // Use the Global Average Cost for calculations
        const sale = getSaleAllocation(h._mathShares, tx.quantity);
        const sellQty = sale.quantity;
        if (sellQty <= 0) return;

        const costBasis = sale.isFullSale ? h._mathCost : h.avgCost * sellQty;
        const costBasisTwd = sale.isFullSale ? h._mathCostTwd : h.avgCostTwd * sellQty;
        const allocatedBuyFees = sale.isFullSale ? h._mathFees : (h._mathFees / h._mathShares) * sellQty;

        const { original: sellRevenue, twd: sellRevenueTwd } = getSellNetAmounts(tx);

        const profit = sellRevenue - costBasis;
        const profitTwd = sellRevenueTwd - costBasisTwd;

        if (isRealized) {
          h.realizedPL += profit;
          h.realizedPLTwd += profitTwd;

          let daysHeld = 0;
          if (h.firstBuyDate) {
            const start = new Date(h.firstBuyDate).getTime();
            const end = new Date(tx.date).getTime();
            daysHeld = Math.floor((end - start) / (1000 * 60 * 60 * 24));
          }

          realizedList.push({
            ticker: tx.ticker, name: tx.name, shares: sellQty, buyPrice: h.avgCost, sellPrice: sellRevenue / sellQty,
            totalCost: costBasis, totalRevenue: sellRevenue, totalFees: allocatedBuyFees + tx.fee + tx.tax,
            profit: profit, roi: costBasis > 0 ? (profit / costBasis) * 100 : 0, daysHeld: daysHeld,
            closeDate: tx.date, notes: tx.notes, sellTxId: tx.id,
            // 附帶台幣盈虧、成本、收入
            profitTwd: profitTwd,
            totalCostTwd: costBasisTwd,
            totalRevenueTwd: sellRevenueTwd
          } as any);
        }

        // Reduce both pools
        h._mathShares = sale.remainingShares;
        h._mathCost = sale.isFullSale ? 0 : h._mathCost - costBasis;
        h._mathCostTwd = sale.isFullSale ? 0 : h._mathCostTwd - costBasisTwd;
        h._mathFees = sale.isFullSale ? 0 : h._mathFees - allocatedBuyFees;

        const activeSale = getSaleAllocation(h.currentShares, tx.quantity);
        const activeSellQty = activeSale.quantity;
        if (activeSellQty > 0) {
          const activeCostBasis = activeSale.isFullSale ? h.totalInvested : h.avgCost * activeSellQty;
          const activeCostBasisTwd = activeSale.isFullSale ? h.totalInvestedTwd : h.avgCostTwd * activeSellQty;
          const activeBuyFees = activeSale.isFullSale ? h.totalBuyFees : (h.totalBuyFees / h.currentShares) * activeSellQty;
          
          h.currentShares = activeSale.remainingShares;
          h.totalInvested = activeSale.isFullSale ? 0 : h.totalInvested - activeCostBasis;
          h.totalInvestedTwd = activeSale.isFullSale ? 0 : h.totalInvestedTwd - activeCostBasisTwd;
          h.totalBuyFees = activeSale.isFullSale ? 0 : h.totalBuyFees - activeBuyFees;
        }

        if (h._mathShares <= 0) {
          h._mathShares = 0; h._mathCost = 0; h._mathFees = 0; h._mathCostTwd = 0;
        }
        if (h.currentShares <= 0) {
          h.currentShares = 0; h.totalInvested = 0; h.totalBuyFees = 0; h.firstBuyDate = undefined; h.totalInvestedTwd = 0;
          h.hasEstimatedTwdCost = false;
        }
      } else if (tx.direction === 'DIVIDEND') {
        const { original: dividendAmount, twd: dividendAmountTwd } = getDividendNetAmounts(tx);

        if (isRealized) {
          h.realizedPL += dividendAmount;
          h.realizedPLTwd += dividendAmountTwd;
          realizedList.push({
            ticker: tx.ticker, name: tx.name, shares: 0, buyPrice: 0, sellPrice: 0, totalCost: 0, totalRevenue: dividendAmount,
            totalFees: tx.fee + tx.tax, profit: dividendAmount, roi: 0, daysHeld: 0, closeDate: tx.date, notes: tx.notes || '股息收入', sellTxId: tx.id,
            profitTwd: dividendAmountTwd,
            totalCostTwd: 0,
            totalRevenueTwd: dividendAmountTwd
          } as any);
        } else {
          h.unrealizedDividends += dividendAmount;
          h.unrealizedDividendsTwd += dividendAmountTwd;
        }
      }
    });

    Object.values(holdings).forEach(h => {
      const latestWeekly = weeklyPrices
        .filter(wp => wp.ticker === h.ticker)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.price;

      const price = marketData.prices[h.ticker] || latestWeekly || h.avgCost;
      h.latestPrice = price;

      // 原幣未實現
      h.unrealizedPL = (price * h.currentShares - h.totalInvested) + (h.unrealizedDividends || 0);

      // 台幣未實現
      const isUS = h.ticker && /^[A-Z]+$/.test(h.ticker) && h.ticker.length <= 5;
      const twdValue = isUS ? (price * h.currentShares * 31) : (price * h.currentShares);
      const twdInvested = isUS ? (h.totalInvestedTwd || (h.totalInvested * 31)) : h.totalInvested;
      const twdUnrealizedDiv = isUS ? (h.unrealizedDividendsTwd || (h.unrealizedDividends * 31)) : h.unrealizedDividends;

      h.unrealizedPLTwd = twdValue - twdInvested + (twdUnrealizedDiv || 0);
    });

    const activeHoldings = Object.values(holdings).filter(h => h.currentShares > 0 || h.unrealizedDividends !== 0);

    return { activeHoldings, realizedList, stockGroups, holdingsMap: holdings };
  }, [transactions, marketData, weeklyPrices]);

  const stats = useMemo(() => {
    let totalMarketValue = 0;
    let totalInvested = 0;
    const totalRealizedPL = appData.realizedList.reduce((sum, r) => sum + r.profit, 0);

    let totalMarketValueTwd = 0;
    let totalInvestedTwd = 0;
    const totalRealizedPLTwd = appData.realizedList.reduce((sum, r) => sum + ((r as any).profitTwd ?? r.profit), 0);

    appData.activeHoldings.forEach(h => {
      const latestWeekly = weeklyPrices
        .filter(wp => wp.ticker === h.ticker)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.price;

      const price = marketData.prices[h.ticker] || latestWeekly || h.avgCost;
      const originalValue = price * h.currentShares;
      
      // USD / 原幣
      totalMarketValue += originalValue;
      totalInvested += h.totalInvested;
      totalMarketValue += h.unrealizedDividends || 0;

      // TWD (美股乘 31)
      const isUS = h.ticker && /^[A-Z]+$/.test(h.ticker) && h.ticker.length <= 5;
      const twdValue = isUS ? (originalValue * 31) : originalValue;
      const twdInvested = isUS ? (h.totalInvestedTwd || (h.totalInvested * 31)) : h.totalInvested;
      const twdUnrealizedDiv = isUS ? (h.unrealizedDividendsTwd || (h.unrealizedDividends * 31)) : h.unrealizedDividends;

      totalMarketValueTwd += twdValue;
      totalInvestedTwd += twdInvested;
      totalMarketValueTwd += twdUnrealizedDiv;
    });

    const totalRealizedCost = appData.realizedList.reduce((sum, r) => sum + (r.totalCost || 0), 0);
    const totalCost = totalRealizedCost + totalInvested;
    const unrealizedPL = totalMarketValue - totalInvested;
    const unrealizedRoi = totalInvested > 0 ? (unrealizedPL / totalInvested) * 100 : 0;
    const totalPL = unrealizedPL + totalRealizedPL;
    const roi = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

    const totalRealizedCostTwd = appData.realizedList.reduce((sum, r) => sum + ((r as any).totalCostTwd ?? r.totalCost ?? 0), 0);
    const totalCostTwd = totalRealizedCostTwd + totalInvestedTwd;
    const unrealizedPLTwd = totalMarketValueTwd - totalInvestedTwd;
    const unrealizedRoiTwd = totalInvestedTwd > 0 ? (unrealizedPLTwd / totalInvestedTwd) * 100 : 0;
    const totalPLTwd = unrealizedPLTwd + totalRealizedPLTwd;
    const roiTwd = totalCostTwd > 0 ? (totalPLTwd / totalCostTwd) * 100 : 0;

    return { 
      totalMarketValue, totalInvested, unrealizedPL, totalRealizedPL, totalPL, roi, unrealizedRoi,
      totalMarketValueTwd, totalInvestedTwd, unrealizedPLTwd, totalRealizedPLTwd, totalPLTwd, roiTwd, unrealizedRoiTwd,
      hasEstimatedTwdCost: appData.activeHoldings.some(h => h.hasEstimatedTwdCost)
    };
  }, [appData.activeHoldings, appData.realizedList, marketData.prices, weeklyPrices]);

  return { appData, stats };
};
