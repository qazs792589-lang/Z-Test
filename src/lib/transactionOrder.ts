import { Transaction } from '../types';

const groupKey = (tx: Transaction) => JSON.stringify([tx.ticker.trim().toUpperCase(), tx.date]);
const hasSequence = (tx: Transaction) => Number.isSafeInteger(tx.sequence) && tx.sequence! >= 0;
const legacyOrder = (a: Transaction, b: Transaction) => Number(b.direction === 'BUY') - Number(a.direction === 'BUY');

/** Old backups lack execution times. Preserve their previous accounting order once. */
export function ensureTransactionSequence(transactions: Transaction[]): Transaction[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = groupKey(tx);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }
  const assigned = new Map<Transaction, number>();
  for (const group of groups.values()) {
    const used = new Set<number>();
    let next = Math.max(0, ...group.filter(hasSequence).map(tx => tx.sequence!)) + 1;
    const missing: Transaction[] = [];
    for (const tx of group) {
      if (hasSequence(tx) && !used.has(tx.sequence!)) used.add(tx.sequence!);
      else missing.push(tx);
    }
    for (const tx of missing.sort(legacyOrder)) assigned.set(tx, next++);
  }
  return assigned.size ? transactions.map(tx => assigned.has(tx) ? { ...tx, sequence: assigned.get(tx)! } : tx) : transactions;
}

/** Accounting order: date, then the saved within-day sequence. */
export function compareTransactions(a: Transaction, b: Transaction): number {
  return a.date.localeCompare(b.date) || (hasSequence(a) && hasSequence(b) ? a.sequence! - b.sequence! : legacyOrder(a, b));
}

export const compareTransactionsNewestFirst = (a: Transaction, b: Transaction) => compareTransactions(b, a);

/** New/imported rows follow their input order; existing rows keep their saved order. */
export function appendTransactionSequence(existing: Transaction[], incoming: Transaction[]): Transaction[] {
  const normalized = ensureTransactionSequence(existing);
  const used = new Map<string, Set<number>>();
  for (const tx of normalized) {
    const key = groupKey(tx);
    if (!used.has(key)) used.set(key, new Set());
    used.get(key)!.add(tx.sequence!);
  }
  const added = incoming.map(tx => {
    const key = groupKey(tx);
    if (!used.has(key)) used.set(key, new Set());
    const values = used.get(key)!;
    const sequence = hasSequence(tx) && !values.has(tx.sequence!) ? tx.sequence! : Math.max(0, ...values) + 1;
    values.add(sequence);
    return tx.sequence === sequence ? tx : { ...tx, sequence };
  });
  return [...normalized, ...added];
}

export function sequenceForTransaction(transactions: Transaction[], previous: Transaction | undefined, next: Transaction): number {
  const normalized = ensureTransactionSequence(transactions);
  const saved = previous && normalized.find(tx => tx.id === previous.id);
  if (saved && groupKey(saved) === groupKey(next)) return saved.sequence!;
  return Math.max(0, ...normalized.filter(tx => groupKey(tx) === groupKey(next)).map(tx => tx.sequence!)) + 1;
}

/** -1 moves earlier (down on screen); +1 moves later (up on screen). */
export function moveTransactionWithinDay(transactions: Transaction[], id: string, step: -1 | 1): Transaction[] {
  const normalized = ensureTransactionSequence(transactions);
  const current = normalized.find(tx => tx.id === id);
  if (!current) return normalized;
  const group = normalized.filter(tx => groupKey(tx) === groupKey(current)).sort(compareTransactions);
  const index = group.findIndex(tx => tx.id === id);
  const adjacent = group[index + step];
  if (!adjacent) return normalized;
  return normalized.map(tx => tx.id === current.id ? { ...tx, sequence: adjacent.sequence }
    : tx.id === adjacent.id ? { ...tx, sequence: current.sequence } : tx);
}
