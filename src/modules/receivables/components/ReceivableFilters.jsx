import { RECEIVABLE_FILTERS } from '../types/receivable.types.js';

export function ReceivableFilters({ filter, setFilter, search, setSearch, kitnets, tenants, filters, setKitnetFilter, setContractFilter, setTenantFilter, setCompetenceFilter }) {
  const buttons = [
    { key: RECEIVABLE_FILTERS.ALL, label: 'Todos', className: filter === RECEIVABLE_FILTERS.ALL ? 'bg-blue-600 text-white' : 'bg-white text-slate-700' },
    { key: RECEIVABLE_FILTERS.OVERDUE, label: 'Vencidos', className: filter === RECEIVABLE_FILTERS.OVERDUE ? 'bg-red-600 text-white' : 'bg-white text-slate-700' },
    { key: RECEIVABLE_FILTERS.UPCOMING, label: 'A vencer', className: filter === RECEIVABLE_FILTERS.UPCOMING ? 'bg-amber-500 text-white' : 'bg-white text-slate-700' },
    { key: RECEIVABLE_FILTERS.PAID, label: 'Pagos', className: filter === RECEIVABLE_FILTERS.PAID ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700' },
    { key: RECEIVABLE_FILTERS.PARTIAL, label: 'Parciais', className: filter === RECEIVABLE_FILTERS.PARTIAL ? 'bg-slate-900 text-white' : 'bg-white text-slate-700' },
    { key: RECEIVABLE_FILTERS.THIS_MONTH, label: 'Este mês', className: filter === RECEIVABLE_FILTERS.THIS_MONTH ? 'bg-slate-900 text-white' : 'bg-white text-slate-700' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr] xl:grid-cols-[1.5fr_1fr_1fr]">
        {buttons.map((button) => (
          <button key={button.key} onClick={() => setFilter(button.key)} className={`rounded-2xl border px-4 py-3 text-sm ${button.className}`}>{button.label}</button>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="relative block w-full text-sm text-slate-500">
            Buscar
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Competência, vencimento ou status"
              className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
        <input value={filters.competenceFilter} onChange={(event) => setCompetenceFilter(event.target.value)} placeholder="Competência" className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700" />
      </div>
    </div>
  );
}
