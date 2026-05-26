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
    manualFee: '' as string | number // Added for manual override
  });

  const preview = useMemo(() => {
    const subtotal = formData.unitPrice * formData.quantity;
    const config = configs[formData.category];
    let fee = 0;
    let tax = 0;

    if (formData.direction === 'DIVIDEND') {
      const total = -subtotal;
      return {
        fee: 0,
        tax: 0,
        total,
        feeLabel: '免手續費',
        feeFormula: '股息發放不扣券商手續費',
        taxLabel: '免徵交稅',
        taxFormula: '股息不屬於證券交易，故無交易稅'
      };
    }

    // Calculate auto fee first
    const feeRate = formData.direction === 'BUY' ? config.buyFeeRate : config.sellFeeRate;
    const autoFee = Math.max(config.minFee, Math.floor(subtotal * feeRate * config.discount));

    // Use manual fee if provided, otherwise use auto/custom logic
    if (formData.manualFee !== '') {
      fee = parseFloat(formData.manualFee as string) || 0;
    } else if (formData.category === 'Custom') {
      fee = formData.customFee;
      tax = formData.customTax;
    } else {
      fee = autoFee;
      tax = formData.direction === 'SELL' ? Math.floor(subtotal * config.taxRate) : 0;
    }
    const total = formData.direction === 'BUY' ? subtotal + fee + tax : -(subtotal - fee - tax);

    // Formulas strings for display
    const feeFormula = formData.manualFee !== '' 
      ? `手動輸入: ${fee.toLocaleString()}` 
      : `max(${config.minFee}, floor(${subtotal.toLocaleString()} × ${formData.direction === 'BUY' ? config.buyFeeRate : config.sellFeeRate} × ${config.discount}))`;
    const taxFormula = formData.direction === 'SELL' ? `floor(${subtotal.toLocaleString()} × ${config.taxRate})` : '免徵';

    // Plain language explanations
    const feeFormulaPlain = formData.manualFee !== ''
      ? `已使用手動輸入的手續費 $${fee.toLocaleString()}。`
      : formData.direction === 'DIVIDEND'
      ? '股息領取無需付給券商手續費'
      : fee === config.minFee
        ? `手續費不足 ${config.minFee} 元，以最低 ${config.minFee} 元計收。`
        : `成交金額 $${subtotal.toLocaleString()} 乘以費率 ${configs[formData.category].buyFeeRate * 100}% 再打 ${configs[formData.category].discount * 10} 折。`;

    const taxFormulaPlain = formData.direction === 'SELL'
      ? `賣出金額 $${subtotal.toLocaleString()} 乘以稅率 ${(config.taxRate * 100).toFixed(2)}%。`
      : formData.direction === 'BUY' ? '只有在賣出股票時才需要繳納證交稅。' : '免徵稅';

    const feeLabel = formData.manualFee !== '' ? '手續費 (手動)' : `手續費 (${(config.discount * 10).toFixed(1)}折)`;
    const taxLabel = `證券交易稅 (${(config.taxRate * 100).toFixed(2)}%)`;

    return { fee, tax, total, feeFormula, taxFormula, feeLabel, taxLabel, feeFormulaPlain, taxFormulaPlain, autoFee };
  }, [formData, configs]);

  return { formData, setFormData, preview };
};
