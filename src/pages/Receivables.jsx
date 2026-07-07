import React, { useEffect, useState } from 'react';
import { repository } from '../repository/index.js';
import { CheckCircle2 } from 'lucide-react';

const currency = (value = 0) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Receivables() {
  const [receivables, setReceivables] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    const data = await repository.list('Receivable');
    setReceivables(data);
  };

  useEffect(() => {
    load();
  }, []);

  const receive = async (row) => {
    await repository.create('Payment', {
      receivable_id: row.id,
      kitnet_id: row.kitnet_id,
      tenant_id: row.tenant_id,
      competence: row.competence,
      paid_value: row.expected_value,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: 'pix',
      destination_account: 'Itaú',
      notes: '',
      active: true,
    });
    await repository.update('Receivable', row.id, { status: 'pago' });
    await load();
  };

  const today = new Date().toISOString().split('T')[0];
  const filtered = receivables.filter((row) => {
    if (filter === 'vencidos') return row.status === 'vencido' || (row.status === 'pendente' && row.due_date < today);
    if (filter === 'avencer') return row.status === 'pendente' && row.due_date >= today;
    if (filter === 'pagos') return row.status === 'pago';
    if (filter === 'mes') return row.competence?.startsWith(today.slice(0, 7));
    return true;
  }).filter((row) => row.competence?.includes(search) || row.due_date?.includes(search) || row.status?.includes(search));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recebimentos</h1>
          <p className="text-sm text-slate-500">Controle de recebíveis e confirmações de pagamento</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr] xl:grid-cols-[1.5fr_1fr_1fr]">
        <button onClick={() => setFilter('all')} className={`rounded-2xl border px-4 py-3 text-sm ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}>Todos</button>
        <button onClick={() => setFilter('vencidos')} className={`rounded-2xl border px-4 py-3 text-sm ${filter === 'vencidos' ? 'bg-red-600 text-white' : 'bg-white text-slate-700'}`}>Vencidos</button>
        <button onClick={() => setFilter('avencer')} className={`rounded-2xl border px-4 py-3 text-sm ${filter === 'avencer' ? 'bg-amber-500 text-white' : 'bg-white text-slate-700'}`}>A vencer</button>
        <button onClick={() => setFilter('pagos')} className={`rounded-2xl border px-4 py-3 text-sm ${filter === 'pagos' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'}`}>Pagos</button>
        <button onClick={() => setFilter('mes')} className={`rounded-2xl border px-4 py-3 text-sm ${filter === 'mes' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`}>Este mês</button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
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

      <div className="space-y-4">
        {filtered.map((row) => (
          <div key={row.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Competência {row.competence}</p>
                <p className="text-sm text-slate-500">Vencimento: {row.due_date}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-lg font-semibold text-slate-900">{currency(row.expected_value)}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{row.status}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {row.status !== 'pago' ? (
                <button onClick={() => receive(row)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Receber aluguel
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {!filtered.length ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">Nenhum recebível encontrado.</div>
        ) : null}
      </div>
    </div>
  );
}
