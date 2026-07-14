import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, FileText, History, PencilLine, Plus, Trash2, Upload, User } from 'lucide-react';
import { repository } from '../../../repository/index.js';
import { financialService } from '../../../services/financialService';
import { formatDateBR } from '../../../services/dateUtils.js';
import { useEntitySync } from '../../../hooks/useEntitySync.js';
import {
  RENTAL_DOCUMENT_LABELS,
  RENTAL_DOCUMENT_TYPES,
  documentsForContract,
  getRentalDocumentStatus,
  openRentalDocument,
  upsertRentalDocument,
} from '../../../services/rentalDocumentService.js';

const fields = [
  { key: 'name', label: 'Nome', type: 'text', placeholder: 'Kitnet 01' },
  { key: 'address', label: 'Endereço', type: 'text', placeholder: 'Rua Kaikang, nº 25, Jardim Santa Paula, Goiatuba-GO' },
  { key: 'rent_value', label: 'Valor do aluguel', type: 'number', placeholder: '800' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'vaga', label: 'Vaga' },
      { value: 'ocupada', label: 'Ocupada' },
      { value: 'manutencao', label: 'Manutenção' },
    ],
  },
  {
    key: 'finish_standard',
    label: 'Padrão de acabamento',
    type: 'select',
    options: [
      { value: 'antigo', label: 'Antigo' },
      { value: 'novo', label: 'Novo' },
    ],
  },
  {
    key: 'garage',
    label: 'Garagem',
    type: 'select',
    options: [
      { value: 'carro', label: 'Carro' },
      { value: 'moto', label: 'Moto' },
      { value: 'nenhuma', label: 'Nenhuma' },
    ],
  },
  {
    key: 'furnished',
    label: 'Mobiliada',
    type: 'select',
    options: [
      { value: 'nao', label: 'Não' },
      { value: 'sim', label: 'Sim' },
    ],
  },
  { key: 'description', label: 'Descrição', type: 'textarea', placeholder: 'Características e observações da unidade' },
];

// Sem fallback pro contrato mais recente quando não há um ativo: uma kitnet
// vaga não tem contrato vigente, e cair pro último contrato ENCERRADO
// mostraria o ex-locatário como se fosse o atual (e anexaria um novo PDF de
// contrato/vistoria ao tenant_id/contract_id de quem já saiu).
export const getActiveContract = (kitnetContracts = []) => (
  kitnetContracts.find((contract) => contract.status === 'ativo') || null
);

// Cor por status: ocupada é positivo, vaga precisa de ação, manutenção é alerta.
const STATUS_BADGE_CLASS = {
  ocupada: 'ds-badge-success',
  vaga: 'ds-badge-warning',
  manutencao: 'ds-badge-danger',
};

const inputClass = 'ds-input';

function fieldValue(value, type) {
  if (type === 'number') return value || '';
  return value || '';
}

export default function Kitnets() {
  const [kitnets, setKitnets] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const [kitnetRows, contractRows, tenantRows, documentRows] = await Promise.all([
      repository.list('Kitnet'),
      repository.list('Contract'),
      repository.list('Tenant'),
      repository.list('Document'),
    ]);

    setKitnets(kitnetRows);
    setContracts(contractRows);
    setTenants(tenantRows);
    setDocuments(documentRows);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEntitySync(['Kitnet', 'Contract', 'Tenant', 'Document'], () => loadData({ silent: true }));

  const contractsByKitnet = useMemo(() => {
    return contracts.reduce((acc, contract) => {
      if (!contract.kitnet_id) return acc;
      acc[contract.kitnet_id] = [...(acc[contract.kitnet_id] || []), contract];
      acc[contract.kitnet_id].sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')));
      return acc;
    }, {});
  }, [contracts]);

  const tenantById = useMemo(() => {
    return tenants.reduce((acc, tenant) => ({ ...acc, [tenant.id]: tenant }), {});
  }, [tenants]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = fields.reduce((acc, field) => {
      let value = form[field.key];
      if (field.type === 'number') value = Number(value || 0);
      acc[field.key] = value;
      return acc;
    }, {});

    if (editingId) {
      await repository.update('Kitnet', editingId, payload);
      setMessage('Kitnet atualizada.');
    } else {
      await repository.create('Kitnet', { ...payload, active: true });
      setMessage('Kitnet cadastrada.');
    }

    setForm({});
    setEditingId(null);
    setFormOpen(false);
    await loadData();
  };

  const startEdit = (kitnet) => {
    const values = fields.reduce((acc, field) => {
      acc[field.key] = kitnet[field.key];
      return acc;
    }, {});
    setForm(values);
    setEditingId(kitnet.id);
    setFormOpen(true);
  };

  const closeForm = () => {
    setForm({});
    setEditingId(null);
    setFormOpen(false);
  };

  const handleRemove = async (kitnet) => {
    const confirmed = window.confirm(`Excluir "${kitnet.name || kitnet.id}"? O registro sai das telas, mas continua no backup.`);
    if (!confirmed) return;

    await repository.removeSoft('Kitnet', kitnet.id);
    setMessage('Kitnet removida.');
    await loadData();
  };

  const handleDocumentUpload = async ({ kitnet, contract, tenant, documentType, file }) => {
    if (!file) return;
    try {
      await upsertRentalDocument({ documents, file, type: documentType, kitnet, contract, tenant, source: 'Kitnets' });
      setMessage(`${RENTAL_DOCUMENT_LABELS[documentType]} anexado com sucesso.`);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível anexar o documento.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">Kitnets</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Gerencie suas unidades, documentos PDF e histórico de locações.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (formOpen ? closeForm() : setFormOpen(true))}
          className="ds-btn ds-btn-primary"
        >
          <Plus className="h-4 w-4" /> Novo
        </button>
      </div>

      {message ? (
        <div className="ds-alert ds-alert-info">{message}</div>
      ) : null}

      {formOpen ? (
        <form onSubmit={handleSubmit} className="ds-card">
          <div className="grid gap-4 lg:grid-cols-2">
            {fields.map((field) => (
              <label key={field.key} className="ds-form-field">
                {field.label}
                {field.type === 'textarea' ? (
                  <textarea
                    rows="3"
                    value={fieldValue(form[field.key], field.type)}
                    onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                    className={inputClass}
                    placeholder={field.placeholder || ''}
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={fieldValue(form[field.key], field.type)}
                    onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Selecione</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type || 'text'}
                    value={fieldValue(form[field.key], field.type)}
                    onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                    className={inputClass}
                    placeholder={field.placeholder || ''}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <button type="submit" className="ds-btn ds-btn-primary">
              {editingId ? 'Salvar alterações' : 'Salvar'}
            </button>
            <button type="button" onClick={closeForm} className="ds-btn ds-btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {loading ? (
          <div className="ds-card text-[var(--color-text-muted)]">Carregando...</div>
        ) : kitnets.length > 0 ? (
          kitnets.map((kitnet) => {
            const kitnetContracts = contractsByKitnet[kitnet.id] || [];
            const activeContract = getActiveContract(kitnetContracts);
            const activeTenant = activeContract ? tenantById[activeContract.tenant_id] : null;
            const contractDocuments = documentsForContract(documents, activeContract?.id);
            const contractDocument = contractDocuments.find((document) => document.type === RENTAL_DOCUMENT_TYPES.contract);
            const inspectionDocument = contractDocuments.find((document) => document.type === RENTAL_DOCUMENT_TYPES.inspection);

            return (
              <div key={kitnet.id} className="ds-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-slate-900">{kitnet.name}</p>
                    <p className="text-sm text-slate-500">{kitnet.address || 'Endereço não informado'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`ds-badge ${STATUS_BADGE_CLASS[kitnet.status] || 'ds-badge-info'}`}>{kitnet.status || 'sem status'}</span>
                      <span className="ds-badge ds-badge-success">{financialService.formatCurrency(kitnet.rent_value)}</span>
                      {kitnet.finish_standard ? <span className="ds-badge ds-badge-info">padrão {kitnet.finish_standard}</span> : null}
                      {kitnet.garage && kitnet.garage !== 'nenhuma' ? <span className="ds-badge ds-badge-info">garagem {kitnet.garage}</span> : null}
                      {kitnet.furnished === 'sim' ? <span className="ds-badge ds-badge-info">mobiliada</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(kitnet)}
                      className="rounded-2xl border border-[var(--color-border)] p-3 text-[var(--color-text-muted)] transition hover:bg-blue-50 hover:text-blue-600"
                      aria-label={`Editar ${kitnet.name}`}
                    >
                      <PencilLine className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(kitnet)}
                      className="rounded-2xl border border-[var(--color-border)] p-3 text-[var(--color-text-muted)] transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Excluir ${kitnet.name}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-600">
                  <p className="flex items-center gap-1.5">
                    {activeTenant ? <User className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" /> : null}
                    {activeTenant ? activeTenant.name : kitnet.status === 'ocupada' ? 'Locatário não vinculado' : 'Disponível para alugar'}
                    {activeContract?.due_day ? ` · vence dia ${activeContract.due_day}` : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => setExpandedId((current) => (current === kitnet.id ? null : kitnet.id))}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    {expandedId === kitnet.id ? 'Recolher' : 'Detalhes'}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedId === kitnet.id ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {expandedId === kitnet.id ? (<>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-900">Contrato atual</p>
                  {activeContract ? (
                    <div className="mt-2 space-y-1 text-slate-600">
                      <p>Locatário: {activeTenant?.name || 'Não informado'}</p>
                      <p>Vigência: {formatDateBR(activeContract.start_date) || '-'} até {formatDateBR(activeContract.end_date) || '-'}</p>
                      <p>Vencimento: dia {activeContract.due_day || '-'}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-slate-500">Nenhum contrato vinculado a esta kitnet.</p>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-slate-900">
                    <FileText className="h-4 w-4" /> Documentos PDF
                  </p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs text-slate-500">Contrato: {getRentalDocumentStatus(contractDocument)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openRentalDocument(contractDocument)}
                          disabled={!contractDocument}
                          className="ds-btn ds-btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ExternalLink className="h-4 w-4" /> Abrir contrato
                        </button>
                        <label className="ds-btn ds-btn-secondary cursor-pointer">
                          <Upload className="h-4 w-4" /> {contractDocument ? 'Trocar contrato' : 'Subir contrato'}
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
                            onChange={(event) => handleDocumentUpload({
                              kitnet,
                              contract: activeContract,
                              tenant: activeTenant,
                              documentType: RENTAL_DOCUMENT_TYPES.contract,
                              file: event.target.files?.[0],
                            })}
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Termo de vistoria: {getRentalDocumentStatus(inspectionDocument)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openRentalDocument(inspectionDocument)}
                          disabled={!inspectionDocument}
                          className="ds-btn ds-btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ExternalLink className="h-4 w-4" /> Abrir vistoria
                        </button>
                        <label className="ds-btn ds-btn-secondary cursor-pointer">
                          <Upload className="h-4 w-4" /> {inspectionDocument ? 'Trocar vistoria' : 'Subir vistoria'}
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
                            onChange={(event) => handleDocumentUpload({
                              kitnet,
                              contract: activeContract,
                              tenant: activeTenant,
                              documentType: RENTAL_DOCUMENT_TYPES.inspection,
                              file: event.target.files?.[0],
                            })}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-slate-900">
                    <History className="h-4 w-4" /> Histórico de locações
                  </p>
                  {kitnetContracts.length ? (
                    <div className="mt-3 space-y-2">
                      {kitnetContracts.map((contract) => {
                        const tenant = tenantById[contract.tenant_id];
                        return (
                          <div key={contract.id} className="rounded-xl bg-white p-3 text-slate-600">
                            <p className="font-medium text-slate-900">{tenant?.name || 'Locatário não informado'}</p>
                            <p>{formatDateBR(contract.start_date) || '-'} até {formatDateBR(contract.end_date) || '-'}</p>
                            <p>Status: {contract.status || 'sem status'}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-slate-500">Nenhum histórico de contrato registrado.</p>
                  )}
                </div>

                {kitnet.description ? (
                  <p className="mt-3 text-sm text-slate-500">{kitnet.description}</p>
                ) : null}
                </>) : null}
              </div>
            );
          })
        ) : (
          <div className="ds-card text-[var(--color-text-muted)]">Nenhuma kitnet encontrada.</div>
        )}
      </div>
    </div>
  );
}
