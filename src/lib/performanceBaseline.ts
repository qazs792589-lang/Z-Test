type PerformancePoint = {
  name: string;
  value: number;
  portfolioRoi: number;
  sp500Price: number;
  nasdaqPrice: number;
  dowPrice: number;
  [key: string]: any;
};

/** Use one investment start date for the portfolio and every US comparison index. */
export const rebaseUsPerformance = (points: PerformancePoint[], firstBuyDate?: string) => {
  if (!firstBuyDate) return points;
  const base = points.find(point => point.name === firstBuyDate);
  if (!base) return points;
  const baseFactor = 1 + base.portfolioRoi / 100;
  const relativeReturn = (price: number, basePrice: number) =>
    basePrice > 0 ? (price / basePrice - 1) * 100 : null;
  return points.map(point => {
    const factor = point.name < firstBuyDate || baseFactor <= 0
      ? null : (1 + point.portfolioRoi / 100) / baseFactor;
    return {
      ...point,
      comparisonStartDate: firstBuyDate,
      // Before the first investment, only the historical index lines are meaningful.
      portfolioRoi: factor === null ? null : (factor - 1) * 100,
      adjustedValue: factor === null ? null : Math.floor(base.value * factor),
      sp500Roi: relativeReturn(point.sp500Price, base.sp500Price),
      nasdaqRoi: relativeReturn(point.nasdaqPrice, base.nasdaqPrice),
      dowRoi: relativeReturn(point.dowPrice, base.dowPrice),
    };
  });
};

type PricePoint = { date: string; ticker: string; price: number };

/** Default series are only used when an index is absent; imported history is authoritative. */
export const mergeBenchmarkHistory = (existing: PricePoint[], incoming: PricePoint[]) => {
  const allowed = new Set(['^GSPC', '^IXIC', '^DJI']);
  const existingTickers = new Set(existing.map(point => point.ticker));
  const keys = new Set(existing.map(point => `${point.ticker}|${point.date}`));
  const additions = incoming.filter(point => {
    if (existingTickers.has(point.ticker) || !allowed.has(point.ticker) || !/^\d{4}-\d{2}-\d{2}$/.test(point.date)
      || !Number.isFinite(point.price) || point.price <= 0) return false;
    const key = `${point.ticker}|${point.date}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
  return [...existing, ...additions].sort((a, b) =>
    a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
};
