import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileSignature, Plus, XCircle } from 'lucide-react';
import { repository } from '../../../repository/index.js';
import { financialService } from '../../../services/financialService';
import { contractService, calculateBreakFine } from '../services/contractService.js';
import { useEntitySync } from '../../../hooks/useEntitySync.js';
import NotificationActionDialog from '../../notifications/components/NotificationActionDialog.jsx';
import notificationService from '../../notifications/services/notificationService.js';
import { NOTIFICATION_ENTITY } from '../../notifications/types/notification.types.js';

const inputClass = 'ds-input';
const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  tenantMode: 'novo',
  tenantId: '',
  tenantName: '',
  tenantPhone: '',
  tenantEmail: '',
  kitnetId: '',
  rentValue: '',
  startDate: '',
  endDate: '',
  dueDay: '10',
  fineMonths: '3',
};

export default function Contracts() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [kitnets, setKitnets] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [terminating, setTerminating] = useState(null); // contrato sendo encerrado
  const [exitDate, setExitDate] = useState(today());
  const [launchFine, setLaunchFine] = useState(true);
  const [actionItem, setActionItem] = useState(null);

  const loadData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [contractRows, kitnetRows, tenantRows] = await Promise.all([
      repository.list('Contract'),
      repository.list('Kitnet'),
      repository.list('Tenant'),
    ]);
    setContracts(contractRows);
    setKitnets(kitnetRows);
    setTenants(tenantRows);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEntitySync(['Contract', 'Kitnet', 'Tenant'], () => loadData({ silent: true }));

  const kitnetById = useMemo(() => Object.fromEntries(kitnets.map((row) => [row.id, row])), [kitnets]);
  const tenantById = useMemo(() => Object.fromEntries(tenants.map((row) => [row.id, row])), [tenants]);

  const sortedContracts = useMemo(() => {
    return [...contracts].sort((a, b) => {
      const activeOrder = (a.status === 'encerrado') - (b.status === 'encerrado');
      if (activeOrder !== 0) return activeOrder;
      return String(b.start_date || '').localeCompare(String(a.start_date || ''));
    });
  }, [contracts]);

  const availableKitnets = useMemo(() => {
    const occupiedIds = new Set(contracts.filter((row) => row.status === 'ativo').map((row) => row.kitnet_id));
    return kitnets.map((row) => ({ ...row, occupied: occupiedIds.has(row.id) }));
  }, [contracts, kitnets]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const selectKitnet = (kitnetId) => {
    const kitnet = kitnetById[kitnetId];
    setForm((prev) => ({
      ...prev,
      kitnetId,
      // sugere o valor de aluguel cadastrado na kitnet
      rentValue: prev.rentValue || String(kitnet?.rent_value || ''),
    }));
  };

  const closeForm = () => {
    setForm(emptyForm);
    setFormOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage('');

    try {
      const result = await contractService.createRental({
        tenantId: form.tenantMode === 'existente' ? form.tenantId : '',
        tenant: {
          name: form.tenantName,
          phone: form.tenantPhone,
          email: form.tenantEmail,
        },
        contract: {
          kitnet_id: form.kitnetId,
          start_date: form.startDate,
          end_date: form.endDate,
          rent_value: Number(form.rentValue || 0),
          due_day: Number(form.dueDay || 10),
          fine_months: Number(form.fineMonths || 3),
        },
      });

      const lastCompetence = result.receivables[result.receivables.length - 1]?.competence;
      setMessage(`Contrato criado com ${result.receivables.length} aluguel(éis) lançado(s)${lastCompetence ? ` até ${lastCompetence}` : ''}. A kitnet foi marcada como ocupada.`);
      closeForm();
      await loadData({ silent: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar o contrato.');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteSchedule = async (contract) => {
    const created = await contractService.generateScheduleForContract(contract);
    setMessage(created.length > 0
      ? `${created.length} aluguel(éis) que faltavam foram lançados para este contrato.`
      : 'O carnê deste contrato já está completo.');
    await loadData({ silent: true });
  };

  const openTerminate = (contract) => {
    setTerminating(contract);
    setExitDate(today());
    setLaunchFine(true);
  };

  const fineInfo = useMemo(() => {
    if (!terminating) return null;
    return calculateBreakFine(terminating, exitDate);
  }, [exitDate, terminating]);

  const isEarlyExit = terminating && exitDate < String(terminating.end_date || '').slice(0, 10);

  const [terminatingBusy, setTerminatingBusy] = useState(false);

  const handleTerminate = async () => {
    if (terminatingBusy) return;
    setTerminatingBusy(true);

    try {
      const result = await contractService.terminateContract(terminating, {
        exitDate,
        launchFine: launchFine && isEarlyExit,
      });

      const fineText = result.fineReceivable
        ? ` Multa de ${financialService.formatCurrency(result.fine.fine)} lançada como recebível.`
        : '';
      setMessage(`Contrato encerrado. ${result.canceledReceivables} aluguel(éis) futuro(s) cancelado(s), kitnet liberada.${fineText}`);
      setTerminating(null);
      await loadData({ silent: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível encerrar o contrato. Tente novamente.');
    } finally {
      setTerminatingBusy(false);
    }
  };

  // Deep link de notificações (/contratos/:id)
  useEffect(() => {
    if (!id || loading) return;
    const row = contracts.find((item) => item.id === id);
    if (!row) return;
    setActionItem(row);
    notificationService.markOpenedByTarget(NOTIFICATION_ENTITY.CONTRACT, id);
  }, [contracts, id, loading]);

  const closeActionDialog = () => {
    setActionItem(null);
    navigate('/contratos');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Contratos</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Cadastre o inquilino, vincule à kitnet e o carnê de aluguéis é lançado automaticamente.
          </p>
        </div>
        <button type="button" onClick={() => (formOpen ? closeForm() : setFormOpen(true))} className="ds-btn ds-btn-primary">
          <Plus className="h-4 w-4" /> Novo aluguel
        </button>
      </div>

      {message ? <div className="ds-alert ds-alert-info">{message}</div> : null}

      {formOpen ? (
        <form onSubmit={handleSubmit} className="ds-card space-y-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <FileSignature className="h-5 w-5" /> Novo aluguel
            </h2>
            <p className="text-sm text-slate-500">Inquilino + contrato num passo só. Ao salvar, todos os aluguéis do período são lançados.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">1. Inquilino</p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input type="radio" checked={form.tenantMode === 'novo'} onChange={() => updateForm('tenantMode', 'novo')} />
                Novo inquilino
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={form.tenantMode === 'existente'} onChange={() => updateForm('tenantMode', 'existente')} />
                Já cadastrado
              </label>
            </div>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              {form.tenantMode === 'existente' ? (
                <label className="ds-form-field">
                  Inquilino
                  <select value={form.tenantId} onChange={(event) => updateForm('tenantId', event.target.value)} className={inputClass} required>
                    <option value="">Selecione</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="ds-form-field">
                    Nome
                    <input value={form.tenantName} onChange={(event) => updateForm('tenantName', event.target.value)} className={inputClass} placeholder="Nome completo" required />
                  </label>
                  <label className="ds-form-field">
                    Telefone (WhatsApp)
                    <input value={form.tenantPhone} onChange={(event) => updateForm('tenantPhone', event.target.value)} className={inputClass} placeholder="(64) 99999-8888" />
                  </label>
                  <label className="ds-form-field">
                    E-mail (opcional)
                    <input type="email" value={form.tenantEmail} onChange={(event) => updateForm('tenantEmail', event.target.value)} className={inputClass} placeholder="email@exemplo.com" />
                  </label>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">2. Contrato</p>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <label className="ds-form-field">
                Kitnet
                <select value={form.kitnetId} onChange={(event) => selectKitnet(event.target.value)} className={inputClass} required>
                  <option value="">Selecione</option>
                  {availableKitnets.map((kitnet) => (
                    <option key={kitnet.id} value={kitnet.id}>
                      {kitnet.name} {kitnet.occupied ? '— ocupada' : '— vaga'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ds-form-field">
                Valor do aluguel (R$)
                <input type="number" step="0.01" value={form.rentValue} onChange={(event) => updateForm('rentValue', event.target.value)} className={inputClass} placeholder="800" required />
              </label>
              <label className="ds-form-field">
                Dia do vencimento
                <input type="number" min="1" max="31" value={form.dueDay} onChange={(event) => updateForm('dueDay', event.target.value)} className={inputClass} required />
              </label>
              <label className="ds-form-field">
                Início
                <input type="date" value={form.startDate} onChange={(event) => updateForm('startDate', event.target.value)} className={inputClass} required />
              </label>
              <label className="ds-form-field">
                Término
                <input type="date" value={form.endDate} onChange={(event) => updateForm('endDate', event.target.value)} className={inputClass} required />
              </label>
              <label className="ds-form-field">
                Multa por quebra (nº de aluguéis)
                <input type="number" min="0" step="0.5" value={form.fineMonths} onChange={(event) => updateForm('fineMonths', event.target.value)} className={inputClass} />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="submit" disabled={saving} className="ds-btn ds-btn-primary disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar e lançar aluguéis'}
            </button>
            <button type="button" onClick={closeForm} className="ds-btn ds-btn-secondary">Cancelar</button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {loading ? (
          <div className="ds-card text-[var(--color-text-muted)]">Carregando...</div>
        ) : sortedContracts.length > 0 ? (
          sortedContracts.map((contract) => {
            const kitnet = kitnetById[contract.kitnet_id];
            const tenant = tenantById[contract.tenant_id];
            const isActive = contract.status !== 'encerrado';

            return (
              <div key={contract.id} className="ds-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{kitnet?.name || 'Kitnet não informada'}</p>
                    <p className="text-sm text-slate-500">{tenant?.name || 'Locatário não informado'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`ds-badge ${isActive ? 'ds-badge-success' : 'ds-badge-info'}`}>
                        {isActive ? 'ativo' : 'encerrado'}
                      </span>
                      <span className="ds-badge ds-badge-info">{financialService.formatCurrency(contract.rent_value)}</span>
                      <span className="ds-badge ds-badge-info">vence dia {contract.due_day || '-'}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Vigência: {contract.start_date || '-'} até {contract.end_date || '-'}
                      {contract.fine_months ? ` · multa de quebra: ${contract.fine_months} aluguel(éis)` : ''}
                    </p>
                  </div>
                </div>
                {isActive ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleCompleteSchedule(contract)} className="ds-btn ds-btn-secondary">
                      Completar carnê
                    </button>
                    <button
                      type="button"
                      onClick={() => openTerminate(contract)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" /> Encerrar contrato
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="ds-card text-[var(--color-text-muted)]">Nenhum contrato cadastrado. Clique em "Novo aluguel" para começar.</div>
        )}
      </div>

      {terminating ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Encerrar contrato</h2>
            <p className="mt-1 text-sm text-slate-500">
              {kitnetById[terminating.kitnet_id]?.name || 'Kitnet'} · {tenantById[terminating.tenant_id]?.name || 'Locatário'}
            </p>

            <label className="ds-form-field mt-4">
              Data de saída
              <input type="date" value={exitDate} onChange={(event) => setExitDate(event.target.value)} className={inputClass} />
            </label>

            {isEarlyExit && fineInfo ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Quebra antecipada de contrato</p>
                <p className="mt-1">
                  Multa proporcional: <strong>{financialService.formatCurrency(fineInfo.fine)}</strong>
                  {' '}({fineInfo.fineMonths} aluguel(éis) = {financialService.formatCurrency(fineInfo.baseFine)}, proporcional a {fineInfo.remainingDays} de {fineInfo.totalDays} dias restantes)
                </p>
                <label className="mt-3 flex items-center gap-2">
                  <input type="checkbox" checked={launchFine} onChange={(event) => setLaunchFine(event.target.checked)} />
                  Lançar a multa como recebível para cobrança
                </label>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Encerramento no fim da vigência (ou depois): sem multa.</p>
            )}

            <p className="mt-4 text-sm text-slate-500">
              Os aluguéis pendentes dos meses após a saída serão cancelados e a kitnet ficará como "vaga".
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleTerminate}
                disabled={terminatingBusy}
                className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" /> {terminatingBusy ? 'Encerrando...' : 'Confirmar encerramento'}
              </button>
              <button type="button" onClick={() => setTerminating(null)} className="ds-btn ds-btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}

      {actionItem ? (
        <NotificationActionDialog
          entity={NOTIFICATION_ENTITY.CONTRACT}
          itemLabel={`${kitnetById[actionItem.kitnet_id]?.name || 'Contrato'} - ${tenantById[actionItem.tenant_id]?.name || ''}`}
          onConfirm={async () => {
            await notificationService.confirmTarget(NOTIFICATION_ENTITY.CONTRACT, actionItem.id);
            closeActionDialog();
          }}
          onSnooze={async () => {
            await notificationService.snoozeTarget(NOTIFICATION_ENTITY.CONTRACT, actionItem.id);
            closeActionDialog();
          }}
          onIgnore={async () => {
            await notificationService.ignoreTarget(NOTIFICATION_ENTITY.CONTRACT, actionItem.id);
            closeActionDialog();
          }}
          onClose={closeActionDialog}
        />
      ) : null}
    </div>
  );
}
