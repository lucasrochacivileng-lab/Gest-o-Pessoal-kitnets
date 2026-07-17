import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ArrowUpCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { repository } from '../repository/index.js';
import { buildIncomeInbox } from '../services/incomeInboxService.js';
import { receivableService } from '../modules/receivables/services/receivableService.js';
import { ReceivePaymentDialog } from '../modules/receivables/components/ReceivePaymentDialog.jsx';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import { financialService } from '../services/financialService';
import { formatDateBR } from '../services/dateUtils.js';
import AddIncomeModal from './income/AddIncomeModal.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import StatePanel from '../components/ui/StatePanel.jsx';

const money = (value) => financialService.formatCurrency(value);
const currentMonthKey = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

const TYPE_LABELS = { aluguel: 'Aluguel', pericia: 'Perícia', projeto: 'Projeto', salario: 'Salário', pessoal: 'Pessoal' };
const ENTITIES = ['Payment', 'Receivable', 'Contract', 'Kitnet', 'Tenant', 'ComplementaryProject', 'ExpertReport', 'PersonalIncome'];

function SummaryCard({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="ds-card">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{money(value)}</p>
    </div>
  );
}

export default function Income() {
  const [searchParams, setSearchParams] = useSearchParams();
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

  useEffect(() => {
    if (searchParams.get('novo') !== '1') return;
    setShowAdd(true);
    const next = new URLSearchParams(searchParams);
    next.delete('novo');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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
      <PageHeader title="Receitas" description="Aluguéis, perícias, projetos e renda pessoal reunidos por competência." actions={(
        <button type="button" onClick={() => setShowAdd(true)} className="ds-btn ds-btn-primary">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      )} />

      <MonthChips value={month} onChange={setMonth} />

      {loading || !data ? (
        <StatePanel type="loading" title="Carregando receitas" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard label="Recebido" value={inbox.summary.received} tone="text-emerald-600" />
            <SummaryCard label="Previsto" value={inbox.summary.previsto} tone="text-blue-600" />
            <SummaryCard label="Total do mês" value={inbox.summary.total} />
          </div>

          <div className="space-y-2">
            {inbox.rows.length === 0 ? (
              <StatePanel title="Nenhuma receita neste mês" description="Use Adicionar para lançar uma receita ou escolha outra competência." />
            ) : inbox.rows.map((row) => (
              <div key={row.id} className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-slate-200 bg-white p-3.5 transition hover:bg-slate-50">
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
