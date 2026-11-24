export interface SaleAllocation {
  quantity: number;
  remainingShares: number;
  isFullSale: boolean;
}

/** Decimal share updates allow exact equality; never erase a saved small remainder. */
export function getSaleAllocation(availableShares: number, requestedShares: number): SaleAllocation {
  const available = Math.max(0, availableShares);
  const requested = Math.max(0, requestedShares);
  const isFullSale = Number.isFinite(available) && available > 0 && available === requested;
  const quantity = isFullSale ? requested : Math.min(available, requested);
  return { quantity, remainingShares: isFullSale ? 0 : subtractShares(available, quantity), isFullSale };
}
const decimalParts = (value: number): { units: bigint; scale: number } => {
  const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  const scale = fraction.length - Number(exponent);
  const units = BigInt(whole + fraction);
  return scale >= 0 ? { units, scale } : { units: units * 10n ** BigInt(-scale), scale: 0 };
};

const combineShares = (a: number, b: number, subtract: boolean): number => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return subtract ? a - b : a + b;
  const left = decimalParts(a);
  const right = decimalParts(b);
  const scale = Math.max(left.scale, right.scale);
  const leftUnits = left.units * 10n ** BigInt(scale - left.scale);
  const rightUnits = right.units * 10n ** BigInt(scale - right.scale);
  const units = subtract ? leftUnits - rightUnits : leftUnits + rightUnits;
  // Parsing the scaled decimal avoids overflow from converting a large BigInt first.
  return Number(`${units}e-${scale}`);
};

/** Decimal arithmetic is limited to share quantities; money retains its existing rules. */
export const addShares = (a: number, b: number): number => combineShares(a, b, false);
export const subtractShares = (a: number, b: number): number => combineShares(a, b, true);

