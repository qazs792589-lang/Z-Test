// Sample the existing plotted dates; never drop or interpolate data points.
export function getEvenDateTicks(dates: string[], containerWidth: number): string[] {
  const values = [...new Set(dates.filter(Boolean))];
  const width = Number.isFinite(containerWidth) ? containerWidth : 360;
  const count = Math.min(values.length, width < 640 ? 7 : 10);
  if (values.length <= 1) return values;
  return Array.from({ length: count }, (_, index) => values[Math.round(index * (values.length - 1) / (count - 1))]);
}

export function inclusiveUnrealizedRoi(profitIncludingDividends: number, remainingCost: number): number | null {
  return remainingCost > 0 ? (profitIncludingDividends / remainingCost) * 100 : null;
}
