import { useMemo, useState } from 'react';
import { useReceivables } from '../hooks/useReceivables.js';
import { ReceivableSummary } from '../components/ReceivableSummary.jsx';
import { ReceivableFilters } from '../components/ReceivableFilters.jsx';
import { ReceivableCard } from '../components/ReceivableCard.jsx';
import { ReceivePaymentDialog } from '../components/ReceivePaymentDialog.jsx';
import { RECEIVABLE_FILTERS } from '../types/receivable.types.js';

export default function ReceivablesPage() {
  const { receivables, loading, summary, filters, kitnets, tenants, pay, setFilter, setKitnetFilter, setSearchFilter, refresh } = useReceivables();
  const [selectedReceivable, setSelectedReceivable] = useState(null);
  const [contracts, setContracts] = useState([]);

  const handlePay = (receivable) => {
    setSelectedReceivable(receivable);
  };

  const handleSubmit = async (payload) => {
    await pay(selectedReceivable, payload);
    setSelectedReceivable(null);
  };

  const handleSearch = (value) => {
    setSearchFilter(value);
  };

  const contractOptions = useMemo(() => {
    const list = [];
    const seen = new Set();
    receivables.forEach((receivable) => {
      if (receivable.contract_id && !seen.has(receivable.contract_id)) {
        seen.add(receivable.contract_id);
        list.push({ id: receivable.contract_id });
      }
    });
    return list;
  }, [receivables]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recebimentos</h1>
          <p className="text-sm text-slate-500">Controle de recebíveis e confirmações de pagamento</p>
        </div>
      </div>

      <ReceivableSummary summary={summary} />

      <ReceivableFilters
        filter={filters.statusFilter}
        setFilter={setFilter}
        search={filters.search}
        setSearch={handleSearch}
        kitnets={kitnets}
        tenants={tenants}
        filters={{ ...filters, contracts: contractOptions }}
        setKitnetFilter={setKitnetFilter}
        setContractFilter={() => {}}
        setTenantFilter={() => {}}
        setCompetenceFilter={() => {}}
      />

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">Carregando recebíveis...</div>
        ) : null}
        {!loading && receivables.length > 0 ? receivables.map((row) => (
          <ReceivableCard key={row.id} receivable={row} onPay={handlePay} onEdit={() => {}} onHistory={() => {}} />
        )) : null}
        {!loading && !receivables.length ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">Nenhum recebível encontrado.</div>
        ) : null}
      </div>

      <ReceivePaymentDialog
        receivable={selectedReceivable}
        contracts={contractOptions}
        kitnets={kitnets}
        tenants={tenants}
        onSubmit={handleSubmit}
        onClose={() => setSelectedReceivable(null)}
      />
    </div>
  );
}
