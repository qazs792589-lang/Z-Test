import { useMemo, useState } from 'react';
import { Config, TransactionCategory, TransactionDirection } from '../types';

export const useTransactionForm = (configs: Record<TransactionCategory, Config>) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    ticker: '',
    name: '',
    direction: 'BUY' as TransactionDirection,
    quantity: 1000,
    unitPrice: 0,
    category: 'General' as TransactionCategory,
    customFee: 0,
    customTax: 0,
    manualFee: 0 as string | number, // Added for manual override
    manualTax: 0 as string | number,
    currency: 'TWD' as 'TWD' | 'USD',
    twdRate: 31.5,
    twdAmount: 0,
    notes: '' as string
  });

  const preview = useMemo(() => {
    const subtotal = formData.unitPrice * formData.quantity;
    const fee = formData.manualFee === '' ? 0 : (parseFloat(String(formData.manualFee)) || 0);
    const tax = formData.manualTax === '' ? 0 : (parseFloat(String(formData.manualTax)) || 0);
    const total = formData.direction === 'BUY' ? subtotal + fee + tax : -(subtotal - fee - tax);
    const feeLabel = '手續費／匯費';
    const taxLabel = formData.direction === 'DIVIDEND' ? '股息扣款' : '證券交易稅';
    return {
      fee, tax, total, feeLabel, taxLabel,
      feeFormula: '手動輸入：' + fee.toLocaleString(),
      taxFormula: '手動輸入：' + tax.toLocaleString(),
      feeFormulaPlain: '預設 0，請依實際交割費用填寫。',
      taxFormulaPlain: '預設 0，請依實際交割稅額或股息扣款填寫。',
      autoFee: 0, autoTax: 0
    };
  }, [formData, configs]);

  return { formData, setFormData, preview };
};
