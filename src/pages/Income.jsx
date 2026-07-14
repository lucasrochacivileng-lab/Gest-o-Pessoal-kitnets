import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ArrowUpCircle } from 'lucide-react';
import { repository } from '../repository/index.js';
import { buildIncomeInbox } from '../services/incomeInboxService.js';
import { receivableService } from '../modules/receivables/services/receivableService.js';
import { ReceivePaymentDialog } from '../modules/receivables/components/ReceivePaymentDialog.jsx';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import { financialService } from '../services/financialService';
import { formatDateBR } from '../services/dateUtils.js';
import AddIncomeModal from './income/AddIncomeModal.jsx';

const money = (value) => financialService.formatCurrency(value);
const currentMonthKey = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

const TYPE_LABELS = { aluguel: 'Aluguel', pericia: 'Perícia', projeto: 'Projeto', salario: 'Salário', pessoal: 'Pessoal' };
const ENTITIES = ['Payment', 'Receivable', 'Contract', 'Kitnet', 'Tenant', 'ComplementaryProject', 'ExpertReport', 'PersonalIncome'];

function SummaryCard({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{money(value)}</p>
    </div>
  );
}

export default function Income() {
  const [month, setMonth] = useState(currentMonthKey);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [payReceivable, setPayReceivable] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(ENTITIES.map((entity) => repository.list(entity)));
    const [payments, receivables, contracts, kitnets, tenants, projects, expertReports, personal] = results;
    setData({ payments, receivables, contracts, kitnets, tenants, projects, expertReports, personal });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const inbox = useMemo(() => (data ? buildIncomeInbox({ ...data, month }) : { rows: [], summary: { received: 0, previsto: 0, total: 0 } }), [data, month]);

  const handleReceive = async (row) => {
    if (row.tipo === 'aluguel' && row.receivable) {
      setPayReceivable(row.receivable);
      return;
    }
    if (!window.confirm(`Confirmar recebimento de "${row.label}" (${money(row.value)})?`)) return;
    if (row.sourceEntity === 'PersonalIncome') {
      await repository.update('PersonalIncome', row.sourceId, { status: 'recebido' });
    } else {
      await repository.update(row.sourceEntity, row.sourceId, { status: 'recebido', received_date: today() });
    }
    await load();
  };

  const handlePaymentSubmit = async (values) => {
    await receivableService.registerPayment(payReceivable, values);
    setPayReceivable(null);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Receitas</h1>
          <p className="text-sm text-slate-500">Tudo que entra no mês — aluguéis, perícias, projetos e renda pessoal, num lugar só.</p>
        </div>
        <button type="button" onClick={() => setShowAdd(true)} className="ds-btn ds-btn-primary self-start">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>

      <MonthChips value={month} onChange={setMonth} />

      {loading || !data ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">Carregando receitas...</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard label="Recebido" value={inbox.summary.received} tone="text-emerald-600" />
            <SummaryCard label="Previsto" value={inbox.summary.previsto} tone="text-blue-600" />
            <SummaryCard label="Total do mês" value={inbox.summary.total} />
          </div>

          <div className="space-y-2">
            {inbox.rows.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                Nenhuma receita neste mês. Use "Adicionar" para lançar.
              </div>
            ) : inbox.rows.map((row) => (
              <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${row.status === 'recebido' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                  <ArrowUpCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.label}</p>
                  <p className="truncate text-xs text-slate-500">
                    <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{TYPE_LABELS[row.tipo] || row.tipo}</span>
                    {[row.detail, formatDateBR(row.date)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <span className={`ds-badge ${row.status === 'recebido' ? 'ds-badge-success' : 'ds-badge-info'}`}>{row.status}</span>
                  <span className="text-sm font-bold tabular-nums text-slate-900">{money(row.value)}</span>
                  {row.status === 'previsto' ? (
                    <button type="button" onClick={() => handleReceive(row)} className="ds-btn ds-btn-secondary whitespace-nowrap px-3 py-1.5 text-xs">Receber</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showAdd ? (
        <AddIncomeModal month={month} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      ) : null}

      {payReceivable ? (
        <ReceivePaymentDialog
          receivable={payReceivable}
          contracts={data?.contracts || []}
          kitnets={data?.kitnets || []}
          tenants={data?.tenants || []}
          mode="payment"
          onSubmit={handlePaymentSubmit}
          onClose={() => setPayReceivable(null)}
        />
      ) : null}
    </div>
  );
}
