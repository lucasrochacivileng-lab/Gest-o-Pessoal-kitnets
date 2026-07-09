import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { RECEIVABLE_FILTERS } from '../types/receivable.types.js';

export function ReceivableFilters({ filter, setFilter, search, setSearch, kitnets, tenants, filters, setKitnetFilter, setContractFilter, setTenantFilter, setCompetenceFilter }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const buttons = [
    { key: RECEIVABLE_FILTERS.ALL, label: 'Todos', active: 'bg-blue-600 text-white border-blue-600' },
    { key: RECEIVABLE_FILTERS.OVERDUE, label: 'Vencidos', active: 'bg-red-600 text-white border-red-600' },
    { key: RECEIVABLE_FILTERS.UPCOMING, label: 'A vencer', active: 'bg-amber-500 text-white border-amber-500' },
    { key: RECEIVABLE_FILTERS.PAID, label: 'Pagos', active: 'bg-emerald-600 text-white border-emerald-600' },
    { key: RECEIVABLE_FILTERS.PARTIAL, label: 'Parciais', active: 'bg-slate-900 text-white border-slate-900' },
    { key: RECEIVABLE_FILTERS.THIS_MONTH, label: 'Este mês', active: 'bg-slate-900 text-white border-slate-900' },
  ];

  const hasAdvanced = filters.kitnetFilter || filters.contractFilter || filters.tenantFilter || filters.competenceFilter;

  return (
    <div className="space-y-3">
      {/* Pílulas de status: rolam na horizontal no celular, sem quebrar a tela */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {buttons.map((button) => (
          <button
            key={button.key}
            type="button"
            onClick={() => setFilter(button.key)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
              filter === button.key ? button.active : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {button.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar kitnet, locatário, mês..."
            aria-label="Buscar recebíveis"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced((state) => !state)}
          aria-label="Mais filtros"
          title="Mais filtros"
          className={`relative rounded-2xl border p-3 transition ${showAdvanced || hasAdvanced ? 'border-blue-300 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
        >
          <SlidersHorizontal className="h-5 w-5" />
          {hasAdvanced ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-500" /> : null}
        </button>
      </div>

      {showAdvanced ? (
        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-2 xl:grid-cols-4">
          <select value={filters.kitnetFilter} onChange={(event) => setKitnetFilter(event.target.value)} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
            <option value="">Todas as kitnets</option>
            {kitnets.map((kitnet) => <option key={kitnet.id} value={kitnet.id}>{kitnet.name}</option>)}
          </select>
          <select value={filters.contractFilter} onChange={(event) => setContractFilter(event.target.value)} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
            <option value="">Todos os contratos</option>
            {filters.contracts?.map((contract) => <option key={contract.id} value={contract.id}>{contract.id}</option>)}
          </select>
          <select value={filters.tenantFilter} onChange={(event) => setTenantFilter(event.target.value)} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
            <option value="">Todos os locatários</option>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
          </select>
          <input value={filters.competenceFilter} onChange={(event) => setCompetenceFilter(event.target.value)} placeholder="Competência (2026-07)" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700" />
        </div>
      ) : null}
    </div>
  );
}
