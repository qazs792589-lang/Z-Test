export type TransactionCategory = 'General' | 'ETF' | 'DayTrade' | 'Custom';
export type TransactionDirection = 'BUY' | 'SELL' | 'DIVIDEND';

export interface Transaction {
  id: string;
  date: string;
  ticker: string;
  name: string;
  direction: TransactionDirection;
  quantity: number;
  unitPrice: number; 
  category: TransactionCategory;
  fee: number;
  tax: number;
  totalAmount: number; 
  notes?: string;
  isManualRealized?: boolean;
  isUncleared?: boolean;
  currency?: 'TWD' | 'USD'; // 交易貨幣（預設 TWD）
  twdRate?: number; // 交易時台幣匯率（例如 31.5）
  twdAmount?: number; // 實際台幣總額（unitPrice * quantity * twdRate）
}

export interface Config {
  category: TransactionCategory;
  buyFeeRate: number;
  sellFeeRate: number;
  taxRate: number;
  minFee: number;
  discount: number;
}

export interface Holding {
  ticker: string;
  name: string;
  currentShares: number;
  avgCost: number;
  totalInvested: number;
  realizedPL: number;
}

export interface RealizedProfit {
  ticker: string;
  name: string;
  shares: number;
  buyPrice: number;
  sellPrice: number;
  totalCost: number;
  totalRevenue: number;
  totalFees: number; // Fees + Taxes
  profit: number;
  roi: number;
  daysHeld: number;
  closeDate: string;
  notes?: string;
  sellTxId?: string;
}

export interface WeeklyPrice {
  date: string;
  ticker: string;
  price: number;
}
