import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReceivables } from '../hooks/useReceivables.js';
import { ReceivableSummary } from '../components/ReceivableSummary.jsx';
import { ReceivableFilters } from '../components/ReceivableFilters.jsx';
import { ReceivableCard } from '../components/ReceivableCard.jsx';
import { ReceivePaymentDialog } from '../components/ReceivePaymentDialog.jsx';
import { ReceivableHistoryDialog } from '../components/ReceivableHistoryDialog.jsx';
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
