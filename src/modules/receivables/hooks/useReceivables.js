import { useCallback, useEffect, useMemo, useState } from 'react';
import receivableService from '../services/receivableService.js';
import { RECEIVABLE_FILTERS } from '../types/receivable.types.js';
import { useEntitySync } from '../../../hooks/useEntitySync.js';

const initialSummary = {
  toReceiveToday: 0,
  overdueValue: 0,
  next7DaysValue: 0,
  receivedThisMonthValue: 0,
};

const initialFilters = {
  statusFilter: RECEIVABLE_FILTERS.ALL,
  search: '',
  kitnetFilter: '',
  contractFilter: '',
  tenantFilter: '',
  competenceFilter: '',
};

export function useReceivables() {
  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(initialSummary);
  const [filters, setFilters] = useState(initialFilters);
  const [contracts, setContracts] = useState([]);
  const [kitnets, setKitnets] = useState([]);
  const [tenants, setTenants] = useState([]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const result = await receivableService.loadPageData();
      setReceivables(result.receivables);
      setSummary(result.summary);
      setContracts(result.contracts);
      setKitnets(result.kitnets);
      setTenants(result.tenants);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEntitySync(
    ['Receivable', 'Payment', 'Contract', 'Kitnet', 'Tenant'],
    () => load({ silent: true }),
  );

  const visibleReceivables = useMemo(() => receivableService.filterReceivables(receivables, filters), [filters, receivables]);
  const displayedSummary = useMemo(() => {
    if (!filters.competenceFilter) return summary;

    // Passa a lista inteira (nao so a do mes selecionado): "Em atraso",
    // "A receber hoje" e "Proximos 7 dias" sao indicadores por due_date,
    // nao por competencia — um aluguel de maio ainda em atraso em julho
    // precisa continuar aparecendo mesmo com julho selecionado nos chips.
    // So "Recebido no mes" deve ser restrito ao mes, e o options.month ja
    // faz isso dentro do proprio getSummary.
    return receivableService.getSummary(receivables, { month: filters.competenceFilter });
  }, [filters.competenceFilter, receivables, summary]);

  const updateFilter = useCallback((key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const save = useCallback(async (payload) => {
    await receivableService.create(payload);
    await load();
  }, [load]);

  const pay = useCallback(async (receivable, paymentPayload) => {
    await receivableService.registerPayment(receivable, paymentPayload);
    await load();
  }, [load]);

  const updateReceivable = useCallback(async (receivable, payload) => {
    await receivableService.updateReceivable(receivable, payload);
    await load();
  }, [load]);

  const generate = useCallback(async (competence) => {
    const result = await receivableService.generateForCompetence(competence);
    await load();
    return result;
  }, [load]);

  const remove = useCallback(async (id) => {
    await receivableService.remove(id);
    await load();
  }, [load]);

  const restore = useCallback(async (id) => {
    await receivableService.restore(id);
    await load();
  }, [load]);

  return {
    receivables: visibleReceivables,
    allReceivables: receivables,
    loading,
    error,
    summary: displayedSummary,
    filters,
    contracts,
    kitnets,
    tenants,
    load,
    save,
    generate,
    pay,
    updateReceivable,
    remove,
    restore,
    setFilter: (statusFilter) => updateFilter('statusFilter', statusFilter),
    setKitnetFilter: (kitnetFilter) => updateFilter('kitnetFilter', kitnetFilter),
    setContractFilter: (contractFilter) => updateFilter('contractFilter', contractFilter),
    setTenantFilter: (tenantFilter) => updateFilter('tenantFilter', tenantFilter),
    setCompetenceFilter: (competenceFilter) => updateFilter('competenceFilter', competenceFilter),
    setSearchFilter: (search) => updateFilter('search', search),
    refresh: load,
  };
}

export default useReceivables;
