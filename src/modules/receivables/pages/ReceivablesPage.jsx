import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useReceivables } from '../hooks/useReceivables.js';
import { ReceivableSummary } from '../components/ReceivableSummary.jsx';
import { ReceivableFilters } from '../components/ReceivableFilters.jsx';
import { ReceivableCard } from '../components/ReceivableCard.jsx';
import { ReceivableTable } from '../components/ReceivableTable.jsx';
import { ReceivePaymentDialog } from '../components/ReceivePaymentDialog.jsx';
import { ReceivableHistoryDialog } from '../components/ReceivableHistoryDialog.jsx';
import { MonthChips } from '../../../components/ui/MonthChips.jsx';
import NotificationActionDialog from '../../notifications/components/NotificationActionDialog.jsx';
import notificationService from '../../notifications/services/notificationService.js';
import { NOTIFICATION_ENTITY } from '../../notifications/types/notification.types.js';
import { repository } from '../../../repository/index.js';
import { useEntitySync } from '../../../hooks/useEntitySync.js';
import { buildExtraIncomeRows, buildExtraIncomeSummary } from '../services/extraIncomeService.js';
import { financialService } from '../../../services/financialService';
import { formatDateBR } from '../../../services/dateUtils.js';

function ExtraIncomePanel({ rows, summary }) {
  return (
    <section className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Receitas extras</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{financialService.formatCurrency(summary.total)}</p>
          <p className="mt-1 text-xs text-slate-500">{summary.count} item(ns) no mês</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Já recebido</p>
          <p className="mt-2 text-xl font-semibold text-emerald-700">{financialService.formatCurrency(summary.received)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Previsto/pendente</p>
          <p className="mt-2 text-xl font-semibold text-amber-700">{financialService.formatCurrency(summary.pending)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[760px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Receita</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Abrir</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-600">{formatDateBR(row.date)}</td>
                <td className="px-4 py-3 text-slate-600">{row.kind}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{row.label}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{financialService.formatCurrency(row.value)}</td>
                <td className="px-4 py-3">
                  <span className={`ds-badge ${row.status === 'recebido' ? 'ds-badge-success' : 'ds-badge-warning'}`}>{row.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link to={`${row.entity === 'ExpertReport' ? '/pericias' : '/projetos'}/${row.sourceId}`} className="text-sm font-semibold text-blue-700 hover:underline">
                    Ver
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" className="px-4 py-6 text-center text-slate-500">
                  Nenhum projeto ou perícia com recebimento neste mês.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ReceivablesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    receivables,
    allReceivables,
    loading,
    error,
    summary,
    filters,
    contracts,
    kitnets,
    tenants,
    pay,
    generate,
    updateReceivable,
    setFilter,
    setKitnetFilter,
    setContractFilter,
    setTenantFilter,
    setCompetenceFilter,
    setSearchFilter,
    refresh,
  } = useReceivables();
  const [selectedReceivable, setSelectedReceivable] = useState(null);
  const [editingReceivable, setEditingReceivable] = useState(null);
  const [historyReceivable, setHistoryReceivable] = useState(null);
  const [notificationReceivable, setNotificationReceivable] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [generateMessage, setGenerateMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [projects, setProjects] = useState([]);
  const [expertReports, setExpertReports] = useState([]);
  const extraIncomeRows = useMemo(
    () => buildExtraIncomeRows({ projects, expertReports, month: selectedMonth }),
    [expertReports, projects, selectedMonth],
  );
  const extraIncomeSummary = useMemo(() => buildExtraIncomeSummary(extraIncomeRows), [extraIncomeRows]);

  const loadExtraIncome = async () => {
    const [projectRows, expertRows] = await Promise.all([
      repository.list('ComplementaryProject'),
      repository.list('ExpertReport'),
    ]);
    setProjects(projectRows);
    setExpertReports(expertRows);
  };

  useEffect(() => {
    setCompetenceFilter(selectedMonth);
    loadExtraIncome();
  }, []);

  useEntitySync(['ComplementaryProject', 'ExpertReport'], loadExtraIncome);

  const handleMonthChange = (month) => {
    setSelectedMonth(month);
    setCompetenceFilter(month);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateMessage('');

    try {
      const result = await generate(selectedMonth);
      setGenerateMessage(result.created > 0
        ? `${result.created} recebível(is) gerado(s) para ${selectedMonth}.`
        : `Nenhum recebível novo: os contratos ativos de ${selectedMonth} já estão lançados.`);
    } catch {
      setGenerateMessage('Não foi possível gerar os recebíveis. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePaymentSubmit = async (payload) => {
    await pay(selectedReceivable, payload);
    setSelectedReceivable(null);
  };

  const handleEditSubmit = async (payload) => {
    await updateReceivable(editingReceivable, payload);
    setEditingReceivable(null);
  };

  const contractOptions = useMemo(() => contracts.map((contract) => {
    const kitnetName = kitnets.find((kitnet) => kitnet.id === contract.kitnet_id)?.name;
    const tenantName = tenants.find((tenant) => tenant.id === contract.tenant_id)?.name;

    return {
      id: contract.id,
      kitnet_id: contract.kitnet_id,
      tenant_id: contract.tenant_id,
      label: [kitnetName, tenantName].filter(Boolean).join(' · ') || contract.id,
    };
  }), [contracts, kitnets, tenants]);

  useEffect(() => {
    if (!id || loading) return;

    const receivable = allReceivables.find((item) => item.id === id);
    if (!receivable) return;

    setNotificationReceivable(receivable);
    notificationService.markOpenedByTarget(NOTIFICATION_ENTITY.RECEIVABLE, id);
  }, [allReceivables, id, loading]);

  const closeNotificationDialog = () => {
    setNotificationReceivable(null);
    navigate('/recebimentos');
  };

  const handleNotificationConfirm = async () => {
    await notificationService.confirmTarget(NOTIFICATION_ENTITY.RECEIVABLE, notificationReceivable.id);
    await refresh();
    closeNotificationDialog();
  };

  const handleNotificationSnooze = async () => {
    await notificationService.snoozeTarget(NOTIFICATION_ENTITY.RECEIVABLE, notificationReceivable.id);
    closeNotificationDialog();
  };

  const handleNotificationIgnore = async () => {
    await notificationService.ignoreTarget(NOTIFICATION_ENTITY.RECEIVABLE, notificationReceivable.id);
    closeNotificationDialog();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recebimentos</h1>
          <p className="text-sm text-slate-500">Controle de recebíveis e confirmações de pagamento</p>
        </div>
      </div>

      <MonthChips value={selectedMonth} onChange={handleMonthChange} />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !selectedMonth}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {generating ? 'Gerando...' : `Gerar aluguéis de ${selectedMonth}`}
        </button>
      </div>

      {generateMessage ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{generateMessage}</div>
      ) : null}

      <ReceivableSummary summary={summary} />

      <ExtraIncomePanel rows={extraIncomeRows} summary={extraIncomeSummary} />

      <ReceivableFilters
        filter={filters.statusFilter}
        setFilter={setFilter}
        search={filters.search}
        setSearch={setSearchFilter}
        kitnets={kitnets}
        tenants={tenants}
        filters={{ ...filters, contracts: contractOptions }}
        setKitnetFilter={setKitnetFilter}
        setContractFilter={setContractFilter}
        setTenantFilter={setTenantFilter}
        setCompetenceFilter={handleMonthChange}
      />

      <div className="space-y-4">
        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            Não foi possível carregar os recebíveis. Tente novamente.
          </div>
        ) : null}
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">Carregando recebíveis...</div>
        ) : null}
        {!loading && receivables.length > 0 ? (
          <>
            <ReceivableTable receivables={receivables} onPay={setSelectedReceivable} onEdit={setEditingReceivable} onHistory={setHistoryReceivable} />
            <div className="space-y-4 md:hidden">
              {receivables.map((row) => (
                <ReceivableCard key={row.id} receivable={row} onPay={setSelectedReceivable} onEdit={setEditingReceivable} onHistory={setHistoryReceivable} />
              ))}
            </div>
          </>
        ) : null}
        {!loading && !receivables.length ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">Nenhum recebível encontrado.</div>
        ) : null}
      </div>

      <ReceivePaymentDialog
        receivable={selectedReceivable}
        contracts={contractOptions}
        kitnets={kitnets}
        tenants={tenants}
        mode="payment"
        onSubmit={handlePaymentSubmit}
        onClose={() => setSelectedReceivable(null)}
      />
      <ReceivePaymentDialog
        receivable={editingReceivable}
        contracts={contractOptions}
        kitnets={kitnets}
        tenants={tenants}
        mode="edit"
        onSubmit={handleEditSubmit}
        onClose={() => setEditingReceivable(null)}
      />
      <ReceivableHistoryDialog receivable={historyReceivable} onClose={() => setHistoryReceivable(null)} />
      {notificationReceivable ? (
        <NotificationActionDialog
          entity={NOTIFICATION_ENTITY.RECEIVABLE}
          itemLabel={`${notificationReceivable.competence || notificationReceivable.id} - vencimento ${notificationReceivable.due_date || '-'}`}
          onConfirm={handleNotificationConfirm}
          onSnooze={handleNotificationSnooze}
          onIgnore={handleNotificationIgnore}
          onClose={closeNotificationDialog}
        />
      ) : null}
    </div>
  );
}
