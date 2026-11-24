import type { Transaction } from '../types';

export function usesEstimatedTwdAmount(tx: Pick<Transaction, 'currency' | 'twdAmount' | 'totalAmount'>): boolean {
  return tx.currency === 'USD' && !tx.twdAmount && Math.abs(tx.totalAmount) > 0;
}

export const US_BENCHMARKS = [
  { ticker: '^GSPC', label: '標普 500', roiKey: 'sp500Roi' },
  { ticker: '^IXIC', label: '那斯達克', roiKey: 'nasdaqRoi' },
  { ticker: '^DJI', label: '道瓊工業', roiKey: 'dowRoi' },
] as const;

export function getBenchmarkSummary(chartData: any[], isUsSector: boolean, ticker = '^GSPC') {
  const benchmark = isUsSector
    ? US_BENCHMARKS.find(item => item.ticker === ticker) ?? US_BENCHMARKS[0]
    : { ticker: '^TWII', label: '台股大盤', roiKey: 'marketRoi' };
  const last = chartData[chartData.length - 1];
  const alpha = (last?.portfolioRoi || 0) - (last?.[benchmark.roiKey] || 0);
  const winRate = chartData.filter(row => row.portfolioRoi > row[benchmark.roiKey]).length / (chartData.length || 1) * 100;
  return { ...benchmark, alpha, winRate };
}
