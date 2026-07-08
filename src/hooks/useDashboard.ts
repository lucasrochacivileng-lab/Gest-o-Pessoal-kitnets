import { useCallback, useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboardService';
import { useEntitySync } from './useEntitySync.js';

export function useDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const result = await dashboardService.getDashboardData();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEntitySync(
    ['Kitnet', 'Receivable', 'Payment', 'Expense', 'Contract'],
    () => load({ silent: true }),
  );

  return { loading, data };
}
