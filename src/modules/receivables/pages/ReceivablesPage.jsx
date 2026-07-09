import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReceivables } from '../hooks/useReceivables.js';
import { ReceivableSummary } from '../components/ReceivableSummary.jsx';
import { ReceivableFilters } from '../components/ReceivableFilters.jsx';
import { ReceivableCard } from '../components/ReceivableCard.jsx';
import { ReceivePaymentDialog } from '../components/ReceivePaymentDialog.jsx';
import { ReceivableHistoryDialog } from '../components/ReceivableHistoryDialog.jsx';
import { MonthChips } from '../../../components/ui/MonthChips.jsx';
import NotificationActionDialog from '../../notifications/components/NotificationActionDialog.jsx';
import notificationService from '../../notifications/services/notificationService.js';
import { NOTIFICATION_ENTITY } from '../../notifications/types/notification.types.js';

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
  const [generateCompetence, setGenerateCompetence] = useState(() => new Date().toISOString().slice(0, 7));
  const [generateMessage, setGenerateMessage] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateMessage('');

    try {
      const result = await generate(generateCompetence);
      setGenerateMessage(result.created > 0
        ? `${result.created} recebível(is) gerado(s) para ${generateCompetence}.`
        : `Nenhum recebível novo: os contratos ativos de ${generateCompetence} já estão lançados.`);
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

  const contractOptions = useMemo(() => contracts.map((contract) => ({
    id: contract.id,
    kitnet_id: contract.kitnet_id,
    tenant_id: contract.tenant_id,
  })), [contracts]);

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

      <MonthChips value={generateCompetence} onChange={setGenerateCompetence} />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !generateCompetence}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {generating ? 'Gerando...' : `Gerar aluguéis de ${generateCompetence}`}
        </button>
      </div>

      {generateMessage ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{generateMessage}</div>
      ) : null}

      <ReceivableSummary summary={summary} />

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
        setCompetenceFilter={setCompetenceFilter}
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
        {!loading && receivables.length > 0 ? receivables.map((row) => (
          <ReceivableCard key={row.id} receivable={row} onPay={setSelectedReceivable} onEdit={setEditingReceivable} onHistory={setHistoryReceivable} />
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
