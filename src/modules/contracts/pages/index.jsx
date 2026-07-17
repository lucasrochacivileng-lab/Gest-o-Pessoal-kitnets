import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ExternalLink, FileText, Landmark, Mail, Phone, Plus, Upload, UserRound, XCircle } from 'lucide-react';
import { repository } from '../../../repository/index.js';
import { financialService } from '../../../services/financialService';
import { formatDateBR } from '../../../services/dateUtils.js';
import { contractService, calculateBreakFine } from '../services/contractService.js';
import { useEntitySync } from '../../../hooks/useEntitySync.js';
import NotificationActionDialog from '../../notifications/components/NotificationActionDialog.jsx';
import notificationService from '../../notifications/services/notificationService.js';
import { NOTIFICATION_ENTITY } from '../../notifications/types/notification.types.js';
import ModalShell from '../../../components/ui/ModalShell.jsx';
import {
  RENTAL_DOCUMENT_LABELS,
  RENTAL_DOCUMENT_TYPES,
  documentsForContract,
  getRentalDocumentStatus,
  hasRentalDocumentFile,
  openRentalDocument,
  upsertRentalDocument,
} from '../../../services/rentalDocumentService.js';

const inputClass = 'ds-input';
const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  tenantMode: 'novo',
  tenantId: '',
  tenantName: '',
  tenantCpf: '',
  tenantPhone: '',
  tenantWhatsapp: '',
  tenantEmail: '',
  tenantProfession: '',
  guarantorName: '',
  guarantorCpf: '',
  guarantorPhone: '',
  kitnetId: '',
  rentValue: '',
  startDate: '',
  endDate: '',
  dueDay: '10',
  fineMonths: '3',
  bankAccountId: '',
};

export default function Contracts() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contracts, setContracts] = useState([]);
  const [kitnets, setKitnets] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [documentFiles, setDocumentFiles] = useState({});
  const [uploadingDocument, setUploadingDocument] = useState('');
  const [view, setView] = useState('ativas');
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [terminating, setTerminating] = useState(null); // contrato sendo encerrado
  const [exitDate, setExitDate] = useState(today());
  const [launchFine, setLaunchFine] = useState(true);
  const [actionItem, setActionItem] = useState(null);

  const loadData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [contractRows, kitnetRows, tenantRows, documentRows, bankAccountRows] = await Promise.all([
      repository.list('Contract'),
      repository.list('Kitnet'),
      repository.list('Tenant'),
      repository.list('Document'),
      repository.list('BankAccount'),
    ]);
    setContracts(contractRows);
    setKitnets(kitnetRows);
    setTenants(tenantRows);
    setDocuments(documentRows);
    setBankAccounts(bankAccountRows);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEntitySync(['Contract', 'Kitnet', 'Tenant', 'Document', 'BankAccount'], () => loadData({ silent: true }));

  useEffect(() => {
    if (searchParams.get('novo') !== '1') return;
    setFormOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('novo');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const kitnetById = useMemo(() => Object.fromEntries(kitnets.map((row) => [row.id, row])), [kitnets]);
  const tenantById = useMemo(() => Object.fromEntries(tenants.map((row) => [row.id, row])), [tenants]);
  const accountById = useMemo(() => Object.fromEntries(bankAccounts.map((row) => [row.id, row])), [bankAccounts]);

  const sortedContracts = useMemo(() => {
    return contracts.filter((contract) => {
      if (view === 'ativas') return contract.status !== 'encerrado';
      if (view === 'historico') return contract.status === 'encerrado';
      return true;
    }).sort((a, b) => {
      const activeOrder = (a.status === 'encerrado') - (b.status === 'encerrado');
      if (activeOrder !== 0) return activeOrder;
      return String(b.start_date || '').localeCompare(String(a.start_date || ''));
    });
  }, [contracts, view]);

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
    setDocumentFiles({});
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
          cpf: form.tenantCpf,
          phone: form.tenantPhone,
          whatsapp: form.tenantWhatsapp || form.tenantPhone,
          email: form.tenantEmail,
          profession: form.tenantProfession,
          guarantor_name: form.guarantorName,
          guarantor_cpf: form.guarantorCpf,
          guarantor_phone: form.guarantorPhone,
          kitnet_id: form.kitnetId,
        },
        contract: {
          kitnet_id: form.kitnetId,
          start_date: form.startDate,
          end_date: form.endDate,
          rent_value: Number(form.rentValue || 0),
          due_day: Number(form.dueDay || 10),
          fine_months: Number(form.fineMonths || 3),
          bank_account_id: form.bankAccountId,
        },
      });

      const savedTenant = form.tenantMode === 'existente' ? tenantById[form.tenantId] : result.tenant;
      const savedKitnet = kitnetById[form.kitnetId];
      let uploaded = 0;
      let uploadErrors = 0;

      for (const [type, file] of Object.entries(documentFiles)) {
        if (!file) continue;
        try {
          await upsertRentalDocument({
            documents,
            file,
            type,
            kitnet: savedKitnet,
            contract: result.contract,
            tenant: savedTenant,
            source: 'Locações',
          });
          uploaded += 1;
        } catch {
          uploadErrors += 1;
        }
      }

      const lastCompetence = result.receivables[result.receivables.length - 1]?.competence;
      setMessage(`Locação criada com ${result.receivables.length} aluguel(éis) lançado(s)${lastCompetence ? ` até ${lastCompetence}` : ''}.${uploaded ? ` ${uploaded} documento(s) anexado(s).` : ''}${uploadErrors ? ` ${uploadErrors} anexo(s) não puderam ser salvos; você pode tentar novamente nos detalhes da locação.` : ''} A kitnet foi marcada como ocupada.`);
      closeForm();
      await loadData({ silent: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível criar o contrato.');
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentUpload = async (contract, type, file) => {
    if (!file) return;
    const uploadKey = `${contract.id}:${type}`;
    setUploadingDocument(uploadKey);
    try {
      await upsertRentalDocument({
        documents,
        file,
        type,
        kitnet: kitnetById[contract.kitnet_id],
        contract,
        tenant: tenantById[contract.tenant_id],
        source: 'Locações',
      });
      setMessage(`${RENTAL_DOCUMENT_LABELS[type]} anexado com sucesso.`);
      await loadData({ silent: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível anexar o documento.');
    } finally {
      setUploadingDocument('');
    }
  };

  const handleDocumentOpen = async (document) => {
    try {
      await openRentalDocument(document);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível abrir o documento.');
    }
  };

  const handleCompleteSchedule = async (contract) => {
    const created = await contractService.generateScheduleForContract(contract);
    setMessage(created.length > 0
      ? `${created.length} aluguel(éis) que faltavam foram lançados para este contrato.`
      : 'O carnê deste contrato já está completo.');
    await loadData({ silent: true });
  };

  const handleAccountChange = async (contract, bankAccountId) => {
    await repository.update('Contract', contract.id, { bank_account_id: bankAccountId });
    setMessage('Conta padrão de recebimento atualizada. Os próximos recebimentos usarão esta conta.');
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
    navigate('/locacoes');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Locações</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Locatário, contrato, documentos e histórico reunidos em um só lugar.
          </p>
        </div>
        <button type="button" onClick={() => (formOpen ? closeForm() : setFormOpen(true))} className="ds-btn ds-btn-primary">
          <Plus className="h-4 w-4" /> Nova locação
        </button>
      </div>

      {message ? <div className="ds-alert ds-alert-info">{message}</div> : null}

      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {[
          { value: 'ativas', label: `Ativas (${contracts.filter((row) => row.status !== 'encerrado').length})` },
          { value: 'historico', label: `Histórico (${contracts.filter((row) => row.status === 'encerrado').length})` },
          { value: 'todas', label: 'Todas' },
        ].map((option) => (
          <button key={option.value} type="button" onClick={() => setView(option.value)} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${view === option.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">Locações cadastradas</p><p className="mt-1 text-2xl font-bold text-slate-900">{contracts.length}</p></div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase text-emerald-700">Contratos em PDF</p><p className="mt-1 text-2xl font-bold text-emerald-800">{contracts.filter((contract) => documentsForContract(documents, contract.id).some((document) => document.type === RENTAL_DOCUMENT_TYPES.contract && hasRentalDocumentFile(document))).length}</p></div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase text-amber-700">PDFs pendentes</p><p className="mt-1 text-2xl font-bold text-amber-800">{contracts.filter((contract) => !documentsForContract(documents, contract.id).some((document) => document.type === RENTAL_DOCUMENT_TYPES.contract && hasRentalDocumentFile(document))).length}</p></div>
      </div>

      {formOpen ? (
        <ModalShell title="Nova locação" subtitle="Cadastre o locatário, o contrato e os PDFs no mesmo fluxo." onClose={closeForm} maxWidth="max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
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
                    CPF
                    <input value={form.tenantCpf} onChange={(event) => updateForm('tenantCpf', event.target.value)} className={inputClass} placeholder="000.000.000-00" />
                  </label>
                  <label className="ds-form-field">
                    Telefone
                    <input value={form.tenantPhone} onChange={(event) => updateForm('tenantPhone', event.target.value)} className={inputClass} placeholder="(64) 99999-8888" />
                  </label>
                  <label className="ds-form-field">
                    WhatsApp
                    <input value={form.tenantWhatsapp} onChange={(event) => updateForm('tenantWhatsapp', event.target.value)} className={inputClass} placeholder="Se for diferente do telefone" />
                  </label>
                  <label className="ds-form-field">
                    E-mail (opcional)
                    <input type="email" value={form.tenantEmail} onChange={(event) => updateForm('tenantEmail', event.target.value)} className={inputClass} placeholder="email@exemplo.com" />
                  </label>
                  <label className="ds-form-field">
                    Profissão
                    <input value={form.tenantProfession} onChange={(event) => updateForm('tenantProfession', event.target.value)} className={inputClass} />
                  </label>
                  <label className="ds-form-field">
                    Nome do fiador
                    <input value={form.guarantorName} onChange={(event) => updateForm('guarantorName', event.target.value)} className={inputClass} />
                  </label>
                  <label className="ds-form-field">
                    CPF do fiador
                    <input value={form.guarantorCpf} onChange={(event) => updateForm('guarantorCpf', event.target.value)} className={inputClass} />
                  </label>
                  <label className="ds-form-field">
                    Telefone do fiador
                    <input value={form.guarantorPhone} onChange={(event) => updateForm('guarantorPhone', event.target.value)} className={inputClass} />
                  </label>
                </>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">2. Contrato</p>
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <label className="ds-form-field">
                Kitnet
                <select value={form.kitnetId} onChange={(event) => selectKitnet(event.target.value)} className={inputClass} required>
                  <option value="">Selecione</option>
                  {availableKitnets.map((kitnet) => (
                    <option key={kitnet.id} value={kitnet.id} disabled={kitnet.occupied}>
                      {kitnet.name} {kitnet.occupied ? '— ocupada (encerre o contrato atual antes)' : '— vaga'}
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
              <label className="ds-form-field">
                Conta para receber o aluguel
                <select value={form.bankAccountId} onChange={(event) => updateForm('bankAccountId', event.target.value)} className={inputClass} required>
                  <option value="">Selecione</option>
                  {bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">3. Documentos em PDF</p>
            <p className="mt-1 text-xs text-slate-500">Os anexos são opcionais agora e também podem ser enviados depois nos detalhes da locação.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {Object.entries(RENTAL_DOCUMENT_LABELS).map(([type, label]) => (
                <label key={type} className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-3 transition hover:border-blue-400 hover:bg-blue-50/40">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Upload className="h-5 w-5" /></span>
                  <span className="min-w-0"><span className="block text-sm font-semibold text-slate-800">{label}</span><span className="block truncate text-xs text-slate-500">{documentFiles[type]?.name || 'Selecionar PDF'}</span></span>
                  <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => setDocumentFiles((current) => ({ ...current, [type]: event.target.files?.[0] }))} />
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="submit" disabled={saving} className="ds-btn ds-btn-primary disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar locação e gerar aluguéis'}
            </button>
            <button type="button" onClick={closeForm} className="ds-btn ds-btn-secondary">Cancelar</button>
          </div>
        </form>
        </ModalShell>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {loading ? (
          <div className="ds-card text-[var(--color-text-muted)]">Carregando...</div>
        ) : sortedContracts.length > 0 ? (
          sortedContracts.map((contract) => {
            const kitnet = kitnetById[contract.kitnet_id];
            const tenant = tenantById[contract.tenant_id];
            const isActive = contract.status !== 'encerrado';
            const contractDocuments = documentsForContract(documents, contract.id);
            const attachedDocuments = contractDocuments.filter(hasRentalDocumentFile);
            const hasContractPdf = attachedDocuments.some((document) => document.type === RENTAL_DOCUMENT_TYPES.contract);
            const isExpanded = expandedId === contract.id;

            return (
              <div key={contract.id} className="ds-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{tenant?.name || 'Locatário não informado'}</p>
                    <p className="text-sm text-slate-500">{kitnet?.name || 'Kitnet não informada'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`ds-badge ${isActive ? 'ds-badge-success' : 'ds-badge-info'}`}>
                        {isActive ? 'ativo' : 'encerrado'}
                      </span>
                      <span className="ds-badge ds-badge-info">{financialService.formatCurrency(contract.rent_value)}</span>
                      <span className="ds-badge ds-badge-info">vence dia {contract.due_day || '-'}</span>
                      <span className="ds-badge ds-badge-info">{accountById[contract.bank_account_id]?.name || 'conta não definida'}</span>
                      <span className={`ds-badge ${hasContractPdf ? 'ds-badge-success' : 'ds-badge-warning'}`}>{hasContractPdf ? 'Contrato PDF anexado' : 'Contrato PDF pendente'}</span>
                      <span className="ds-badge ds-badge-info">Documentos {attachedDocuments.length}/{Object.keys(RENTAL_DOCUMENT_LABELS).length}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Vigência: {formatDateBR(contract.start_date) || '-'} até {formatDateBR(contract.end_date) || '-'}
                      {contract.fine_months ? ` · multa de quebra: ${contract.fine_months} aluguel(éis)` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => setExpandedId(isExpanded ? null : contract.id)} className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                    {isExpanded ? 'Recolher' : 'Detalhes'}<ChevronDown className={`h-4 w-4 transition ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {isExpanded ? (
                  <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                    <section>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Landmark className="h-4 w-4 text-blue-600" /> Conta de recebimento</h3>
                      <label className="mt-2 block max-w-md text-sm text-slate-600">
                        Conta padrão deste contrato
                        <select value={contract.bank_account_id || ''} onChange={(event) => handleAccountChange(contract, event.target.value)} className={`${inputClass} mt-2`}>
                          <option value="">Selecione</option>
                          {bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                        </select>
                      </label>
                    </section>
                    <section>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><UserRound className="h-4 w-4 text-blue-600" /> Dados do locatário</h3>
                      <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <p>CPF: {tenant?.cpf || 'Não informado'}</p>
                        <p>Profissão: {tenant?.profession || 'Não informada'}</p>
                        <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {tenant?.whatsapp || tenant?.phone || 'Não informado'}</p>
                        <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {tenant?.email || 'Não informado'}</p>
                        {tenant?.guarantor_name ? <p className="sm:col-span-2">Fiador: {tenant.guarantor_name}{tenant.guarantor_phone ? ` · ${tenant.guarantor_phone}` : ''}</p> : null}
                      </div>
                    </section>

                    <section className="border-t border-slate-100 pt-4">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText className="h-4 w-4 text-blue-600" /> Documentos da locação</h3>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {Object.entries(RENTAL_DOCUMENT_LABELS).map(([type, label]) => {
                          const document = contractDocuments.find((item) => item.type === type);
                          const hasFile = hasRentalDocumentFile(document);
                          const uploadKey = `${contract.id}:${type}`;
                          const isUploading = uploadingDocument === uploadKey;
                          return (
                            <div key={type} className="flex items-center justify-between gap-2 border-b border-slate-100 py-2">
                              <div className="min-w-0"><p className="text-xs font-semibold text-slate-700">{label}</p><p className={`truncate text-xs ${hasFile ? 'text-emerald-700' : 'text-amber-700'}`}>{isUploading ? 'Enviando PDF...' : getRentalDocumentStatus(document)}</p></div>
                              <div className="flex shrink-0 gap-1">
                                {hasFile ? <button type="button" onClick={() => handleDocumentOpen(document)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label={`Abrir ${label}`}><ExternalLink className="h-4 w-4" /></button> : null}
                                <label className={`rounded-lg border border-slate-200 p-2 text-slate-600 ${isUploading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50'}`} aria-label={`Anexar ${label}`}><Upload className="h-4 w-4" /><input type="file" accept="application/pdf,.pdf" className="hidden" disabled={isUploading} onChange={(event) => { handleDocumentUpload(contract, type, event.target.files?.[0]); event.target.value = ''; }} /></label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                ) : null}

                {isActive ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <button type="button" onClick={() => handleCompleteSchedule(contract)} className="ds-btn ds-btn-secondary">
                      Completar carnê
                    </button>
                    <button
                      type="button"
                      onClick={() => openTerminate(contract)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4" /> Encerrar contrato
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="ds-card text-[var(--color-text-muted)]">Nenhuma locação nesta visualização.</div>
        )}
      </div>

      {terminating ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
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
