import { Config, Transaction, TransactionCategory } from './types';

export const DEFAULT_CONFIGS: Record<TransactionCategory, Config> = {
  General: {
    category: 'General',
    buyFeeRate: 0.001425,
    sellFeeRate: 0.001425,
    taxRate: 0.003,
    minFee: 20,
    discount: 0.2
  },
  ETF: {
    category: 'ETF',
    buyFeeRate: 0.001425,
    sellFeeRate: 0.001425,
    taxRate: 0.001,
    minFee: 20,
    discount: 0.2
  },
  DayTrade: {
    category: 'DayTrade',
    buyFeeRate: 0.001425,
    sellFeeRate: 0.001425,
    taxRate: 0.0015,
    minFee: 20,
    discount: 0.2
  },
  Custom: {
    category: 'Custom',
    buyFeeRate: 0,
    sellFeeRate: 0,
    taxRate: 0,
    minFee: 0,
    discount: 1
  }
};

// Initial Mock Data to showcase the UI
export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    date: '2024-03-01',
    ticker: '2330',
    name: '台積電',
    direction: 'BUY',
    quantity: 1000,
    unitPrice: 600,
    category: 'General',
    fee: 513,
    tax: 0,
    totalAmount: 600513
  },
  {
    id: '2',
    date: '2024-03-15',
    ticker: '0050',
    name: '元大台灣50',
    direction: 'BUY',
    quantity: 2000,
    unitPrice: 150,
    category: 'ETF',
    fee: 256,
    tax: 0,
    totalAmount: 300256
  }
];
