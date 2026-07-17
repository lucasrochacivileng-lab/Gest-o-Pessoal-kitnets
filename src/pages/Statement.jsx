import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Briefcase, Building2, Clock, Search, User } from 'lucide-react';
import { repository } from '../repository/index.js';
import { buildStatement } from '../services/statementService.js';
import { findAllDuplicates } from '../services/duplicateCheckService.js';
import { formatDateBR } from '../services/dateUtils.js';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';

const money = (value = 0) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonthKey = () => new Date().toISOString().slice(0, 7);

const FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'entrada', label: 'Entradas' },
  { key: 'saida', label: 'Saídas' },
  { key: 'kitnets', label: 'Kitnets' },
  { key: 'extras', label: 'Projetos/perícias' },
  { key: 'pessoal', label: 'Pessoal' },
];

function DuplicatePanel({ groups }) {
  const [open, setOpen] = useState(false);
  if (!groups.length) return null;

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
      <button type="button" onClick={() => setOpen((state) => !state)} className="flex w-full items-center gap-3 text-left">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            {groups.length} possível{groups.length > 1 ? 'is' : ''} duplicidade{groups.length > 1 ? 's' : ''} encontrada{groups.length > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-amber-700">{totalItems} lançamentos parecidos — {open ? 'toque para esconder' : 'toque para revisar'}</p>
        </div>
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          {groups.map((group, index) => (
            <div key={index} className="rounded-[var(--radius-lg)] border border-amber-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-amber-700">
                {group.reason} · {group.origin === 'kitnets' ? 'Kitnets' : 'Pessoal'}
              </p>
              <div className="mt-2 space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-700">{formatDateBR(item.date)} · {item.description || item.category || 'Sem descrição'}</span>
                    <span className="font-semibold text-slate-900">{money(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MovementRow({ movement }) {
  const isIncome = movement.kind === 'entrada';
  const OriginIcon = movement.origin === 'pessoal' ? User : movement.origin === 'extras' ? Briefcase : Building2;

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-3.5">
      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
        {isIncome ? <ArrowUpCircle className="h-5 w-5" /> : <ArrowDownCircle className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{movement.label}</p>
        <p className="flex items-center gap-1 truncate text-xs text-slate-500">
          <OriginIcon className="h-3 w-3 flex-shrink-0" />
          {[movement.detail, formatDateBR(movement.date)].filter(Boolean).join(' · ')}
        </p>
      </div>
      <p className={`flex-shrink-0 text-sm font-bold tabular-nums ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
        {isIncome ? '+' : '−'} {money(movement.value)}
      </p>
    </div>
  );
}

export default function Statement() {
  const [month, setMonth] = useState(currentMonthKey);
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [payments, expenses, personal, receivables, contracts, kitnets, tenants, projects, expertReports] = await Promise.all([
        repository.list('Payment'),
        repository.list('Expense'),
        repository.list('PersonalIncome'),
        repository.list('Receivable'),
        repository.list('Contract'),
        repository.list('Kitnet'),
        repository.list('Tenant'),
        repository.list('ComplementaryProject'),
        repository.list('ExpertReport'),
      ]);
      setData({ payments, expenses, personal, receivables, contracts, kitnets, tenants, projects, expertReports });
      setLoading(false);
    };

    load();
  }, []);

  const statement = useMemo(() => {
    if (!data) return null;
    return buildStatement({ ...data, monthKey: month });
  }, [data, month]);

  // Duplicidades são checadas no histórico inteiro (não só no mês em tela),
  // já que o objetivo é uma auditoria dos dados lançados, não do mês corrente.
  const duplicateGroups = useMemo(() => {
    if (!data) return [];
    return findAllDuplicates({ expenses: data.expenses, personal: data.personal });
  }, [data]);

  const visibleMovements = useMemo(() => {
    if (!statement) return [];

    return statement.movements.filter((movement) => {
      if (filter === 'entrada' && movement.kind !== 'entrada') return false;
      if (filter === 'saida' && movement.kind !== 'saida') return false;
      if (filter === 'kitnets' && movement.origin !== 'kitnets') return false;
      if (filter === 'extras' && movement.origin !== 'extras') return false;
      if (filter === 'pessoal' && movement.origin !== 'pessoal') return false;

      if (search) {
        const text = `${movement.label} ${movement.detail} ${movement.category}`.toLowerCase();
        if (!text.includes(search.toLowerCase())) return false;
      }

      return true;
    });
  }, [statement, filter, search]);

  return (
    <div className="space-y-6">
      <PageHeader title="Extrato" description="Entradas e saídas do mês com conta, categoria e origem de cada lançamento." />

      <MonthChips value={month} onChange={setMonth} />

      {loading || !statement ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">Montando o extrato...</div>
      ) : (
        <>
          <DuplicatePanel groups={duplicateGroups} />

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-normal text-slate-500">Entradas</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">{money(statement.totalIn)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-normal text-slate-500">Saídas</p>
              <p className="mt-2 text-2xl font-semibold text-red-600">{money(statement.totalOut)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-normal text-slate-500">Saldo do mês</p>
              <p className={`mt-2 text-2xl font-semibold ${statement.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{money(statement.balance)}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    filter === item.key ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por descrição, kitnet, categoria..."
                aria-label="Buscar lançamentos"
                className="w-full rounded-[var(--radius-lg)] border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="space-y-2">
            {visibleMovements.length ? (
              visibleMovements.map((movement) => <MovementRow key={movement.id} movement={movement} />)
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                Nenhum lançamento encontrado para este filtro.
              </div>
            )}
          </div>

          {statement.pending.length ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Clock className="h-4 w-4 text-slate-400" /> Ainda pendente este mês ({statement.pending.length})
              </p>
              <div className="mt-3 space-y-1.5">
                {statement.pending.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-sm text-slate-500">
                    <span>{formatDateBR(item.date)} · {item.label}</span>
                    <span className="font-semibold">{money(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
