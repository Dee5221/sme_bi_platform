import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../lib/api';
import type { PricingCurrency } from '../lib/money';
import * as settingsApi from '../services/customerPortalSettingsService';

export type CustomerCurrencyState = {
  loading: boolean;
  error: string | null;
  preferredCurrency: PricingCurrency;
  usdToZmwRate: number;
  refresh: () => Promise<void>;
};

export function useCustomerCurrency(): CustomerCurrencyState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState<PricingCurrency>('USD');
  const [usdToZmwRate, setUsdToZmwRate] = useState(18.5);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await settingsApi.fetchCustomerPortalSettings();
      setPreferredCurrency(
        result.settings.customer.preferredCurrency === 'ZMW' ? 'ZMW' : 'USD'
      );
      setUsdToZmwRate(result.settings.business.usdToZmwRate || 18.5);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Unable to load currency settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading,
    error,
    preferredCurrency,
    usdToZmwRate,
    refresh,
  };
}
