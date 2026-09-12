export type PricingCurrency = 'USD' | 'ZMW';

export type MoneyDisplayOptions = {
  currency?: PricingCurrency;
  usdToZmwRate?: number;
};

const DEFAULT_USD_TO_ZMW = 18.5;

export function convertFromUsd(
  amountUsd: number,
  currency: PricingCurrency = 'USD',
  usdToZmwRate = DEFAULT_USD_TO_ZMW
) {
  if (currency === 'ZMW') {
    return amountUsd * usdToZmwRate;
  }
  return amountUsd;
}

export function formatMoney(amountUsd: number, options: MoneyDisplayOptions = {}) {
  const currency = options.currency === 'ZMW' ? 'ZMW' : 'USD';
  const rate = options.usdToZmwRate && options.usdToZmwRate > 0 ? options.usdToZmwRate : DEFAULT_USD_TO_ZMW;
  const value = convertFromUsd(amountUsd, currency, rate);

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}
