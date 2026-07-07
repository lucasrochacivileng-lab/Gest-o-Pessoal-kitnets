import { useCallback, useEffect, useMemo, useState } from 'react';
import receivableService from '../services/receivableService.js';
import { RECEIVABLE_FILTERS } from '../types/receivable.types.js';

export function useReceivables() {
  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    toReceiveToday: 0,
    overdueValue: 0,
    next7DaysValue: 0,
    receivedThisMonthValue: 0,
  });
  const [filters, setFilters] = useState({
    statusFilter: RECEIVABLE_FILTERS.ALL,
    search: '',
    kitnetFilter: '',
    contractFilter: '',
    tenantFilter: '',
    competenceFilter: '',
  });
  const [kitnets, setKitnets] = useState([]);
  const [tenants, setTenants] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await receivableService.loadPageData();
    setReceivables(result.receivables);
    setSummary(result.summary);
    setKitnets(result.kitnets);
    setTenants(result.tenants);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleReceivables = useMemo(() => receivableService.filterReceivables(receivables, filters), [filters, receivables]);

  const setFilter = useCallback((statusFilter) => {
    setFilters((current) => ({ ...current, statusFilter }));
  }, []);

  const setKitnetFilter = useCallback((kitnetFilter) => {
    setFilters((current) => ({ ...current, kitnetFilter }));
  }, []);

  const setSearchFilter = useCallback((search) => {
    setFilters((current) => ({ ...current, search }));
  }, []);

  const save = useCallback(async (payload) => {
    await receivableService.create(payload);
    await load();
  }, [load]);

  const pay = useCallback(async (receivable, paymentPayload) => {
    await receivableService.registerPayment(receivable, paymentPayload);
    await load();
  }, [load]);

  const remove = useCallback(async (id) => {
    await receivableService.remove(id);
    await load();
  }, [load]);

  const restore = useCallback(async (id) => {
    await receivableService.restore(id);
    await load();
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  return {
    receivables: visibleReceivables,
    allReceivables: receivables,
    loading,
    summary,
    filters,
    kitnets,
    tenants,
    load,
    save,
    pay,
    remove,
    restore,
    setFilter,
    setKitnetFilter,
    setSearchFilter,
    refresh,
  };
}

export default useReceivables;
