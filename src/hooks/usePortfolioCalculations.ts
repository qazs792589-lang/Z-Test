import { useMemo } from 'react';
import { Holding, RealizedProfit, Transaction, WeeklyPrice } from '../types';
import { isTxRealized } from '../lib/txUtils';

export const usePortfolioCalculations = (transactions: Transaction[], marketData: { updated: string | null; prices: Record<string, number> }, weeklyPrices: WeeklyPrice[]) => {
  const appData = useMemo(() => {
    const holdings: Record<string, Holding & { totalBuyFees: number, firstBuyDate?: string }> = {};
    const realizedList: RealizedProfit[] = [];
    const stockGroups: Record<string, Transaction[]> = {};

    // Sort transactions by date for correct sequential calculation
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Use separate pools for 'Display/Active' and 'Mathematical/Global' tracking
    sortedTxs.forEach(tx => {
      if (!stockGroups[tx.ticker]) stockGroups[tx.ticker] = [];
      stockGroups[tx.ticker].push(tx);

      const isRealized = isTxRealized(tx);

      if (!holdings[tx.ticker]) {
        holdings[tx.ticker] = {
          ticker: tx.ticker, name: tx.name,
          currentShares: 0, avgCost: 0, totalInvested: 0, realizedPL: 0, totalBuyFees: 0,
          unrealizedDividends: 0,
          _mathShares: 0, _mathCost: 0, _mathFees: 0 // Shadow math tracking
        } as any;
      }

      const h = holdings[tx.ticker];

      if (tx.direction === 'BUY') {
        // Update Shadow Math (Always tracks everything to maintain a correct cost basis)
        const newMathShares = h._mathShares + tx.quantity;
        const newMathCost = h._mathCost + Math.abs(tx.totalAmount);
        h.avgCost = newMathShares > 0 ? newMathCost / newMathShares : 0;
        h._mathShares = newMathShares;
        h._mathCost = newMathCost;
        h._mathFees += tx.fee + tx.tax;

        // Update Active Holding (Only if NOT manually marked realized)
        if (!isRealized) {
          if (h.currentShares === 0) h.firstBuyDate = tx.date;
          h.currentShares += tx.quantity;
          h.totalInvested += Math.abs(tx.totalAmount);
          h.totalBuyFees += tx.fee + tx.tax;
        }
      } else if (tx.direction === 'SELL') {
        // Use the Global Average Cost for calculations
        const sellQty = Math.min(tx.quantity, h._mathShares);
        if (sellQty <= 0) return;

        const costBasis = h.avgCost * sellQty;
        const sellRevenue = Math.abs(tx.totalAmount);
        const profit = sellRevenue - costBasis;

        if (isRealized) {
          h.realizedPL += profit;

          let daysHeld = 0;
          if (h.firstBuyDate) {
            const start = new Date(h.firstBuyDate).getTime();
            const end = new Date(tx.date).getTime();
            daysHeld = Math.floor((end - start) / (1000 * 60 * 60 * 24));
          }

          realizedList.push({
            ticker: tx.ticker, name: tx.name, shares: sellQty, buyPrice: h.avgCost, sellPrice: sellRevenue / sellQty,
            totalCost: costBasis, totalRevenue: sellRevenue, totalFees: (h._mathFees / h._mathShares) * sellQty + tx.fee + tx.tax,
            profit: profit, roi: costBasis > 0 ? (profit / costBasis) * 100 : 0, daysHeld: daysHeld,
            closeDate: tx.date, notes: tx.notes, sellTxId: tx.id
          });
        }

        // Reduce both pools
        h._mathShares -= sellQty;
        h._mathCost -= costBasis;
        h._mathFees -= h._mathShares > 0 ? (h._mathFees / (h._mathShares + sellQty)) * sellQty : h._mathFees;

        const activeSellQty = Math.min(tx.quantity, h.currentShares);
        if (activeSellQty > 0) {
          const activeCostBasis = h.avgCost * activeSellQty;
          h.currentShares -= activeSellQty;
          h.totalInvested -= activeCostBasis;
          h.totalBuyFees -= h.currentShares > 0 ? (h.totalBuyFees / (h.currentShares + activeSellQty)) * activeSellQty : h.totalBuyFees;
        }

        if (h._mathShares <= 0) {
          h._mathShares = 0; h._mathCost = 0; h._mathFees = 0;
        }
        if (h.currentShares <= 0) {
          h.currentShares = 0; h.totalInvested = 0; h.totalBuyFees = 0; h.firstBuyDate = undefined;
        }
      } else if (tx.direction === 'DIVIDEND') {
        const dividendAmount = Math.abs(tx.totalAmount);
        if (isRealized) {
          h.realizedPL += dividendAmount;
          realizedList.push({
            ticker: tx.ticker, name: tx.name, shares: 0, buyPrice: 0, sellPrice: 0, totalCost: 0, totalRevenue: dividendAmount,
            totalFees: 0, profit: dividendAmount, roi: 0, daysHeld: 0, closeDate: tx.date, notes: tx.notes || '股息收入', sellTxId: tx.id
          });
        } else {
          if (!(h as any).unrealizedDividends) (h as any).unrealizedDividends = 0;
          (h as any).unrealizedDividends += dividendAmount;
        }
      }
    });

    const activeHoldings = Object.values(holdings).filter(h => h.currentShares > 0 || (h as any).unrealizedDividends > 0);

    return { activeHoldings, realizedList, stockGroups, holdingsMap: holdings };
  }, [transactions]);

  const stats = useMemo(() => {
    let totalMarketValue = 0;
    let totalInvested = 0;
    const totalRealizedPL = appData.realizedList.reduce((sum, r) => sum + r.profit, 0);

    appData.activeHoldings.forEach(h => {
      const latestWeekly = weeklyPrices
        .filter(wp => wp.ticker === h.ticker)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.price;

      const price = marketData.prices[h.ticker] || latestWeekly || h.avgCost;
      totalMarketValue += price * h.currentShares;
      totalInvested += h.totalInvested;
      totalMarketValue += (h as any).unrealizedDividends || 0;
    });

    const unrealizedPL = totalMarketValue - totalInvested;
    const unrealizedRoi = totalInvested > 0 ? (unrealizedPL / totalInvested) * 100 : 0;
    const totalPL = unrealizedPL + totalRealizedPL;
    const roi = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    return { totalMarketValue, totalInvested, unrealizedPL, totalRealizedPL, totalPL, roi, unrealizedRoi };
  }, [appData.activeHoldings, appData.realizedList, marketData.prices, weeklyPrices]);

  return { appData, stats };
};
