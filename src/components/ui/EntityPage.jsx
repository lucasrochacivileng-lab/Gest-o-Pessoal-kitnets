import React, { useEffect, useMemo, useState } from 'react';
import { repository } from '../../repository/index.js';
import { PencilLine, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NotificationActionDialog from '../../modules/notifications/components/NotificationActionDialog.jsx';
import notificationService from '../../modules/notifications/services/notificationService.js';
import { useEntitySync } from '../../hooks/useEntitySync.js';

const inputClass = 'ds-input';

function fieldValue(value, type) {
  if (type === 'number') return value || '';
  if (type === 'checkbox') return value === true;
  return value || '';
}

function getFieldName(field) {
  return field.name || field.key;
}

function getRelationEntity(field) {
  return field.optionsEntity || field.entity;
}

function getOptionValue(option) {
  if (typeof option === 'string' || typeof option === 'number') return option;
  return option.value ?? option.id ?? option.name ?? option.title ?? '';
}

function getOptionLabel(option) {
  if (typeof option === 'string' || typeof option === 'number') return option;
  return option.label ?? option.name ?? option.title ?? option.competence ?? option.process_number ?? option.id;
}

export default function EntityPage({
  title,
  subtitle,
  entity,
  fields,
  cardFields,
  relations = [],
  selectedId = '',
  deepLinkEntity = '',
  deepLinkBasePath = '',
  getDeepLinkLabel,
  badgeField = '',
  badgeColors = {},
}) {
  const [rows, setRows] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [relationData, setRelationData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionItem, setActionItem] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const promises = [repository.list(entity)];
      relations.forEach((relation) => promises.push(repository.list(relation.entity)));
      const results = await Promise.all(promises);
      setRows(results[0]);
      const relationState = relations.reduce((acc, relation, index) => {
        acc[relation.key] = results[index + 1];
        return acc;
      }, {});
      setRelationData(relationState);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  useEntitySync(
    [entity, ...relations.map((relation) => relation.entity)],
    () => loadData({ silent: true }),
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage('');

    const payload = fields.reduce((acc, field) => {
      const fieldName = getFieldName(field);
      let value = form[fieldName];
      if (field.type === 'number') value = Number(value || 0);
      if (field.type === 'checkbox') value = Boolean(value);
      acc[fieldName] = value;
      return acc;
    }, {});

    try {
      if (editingId) {
        await repository.update(entity, editingId, payload);
      } else {
        await repository.create(entity, { ...payload, active: true });
      }

      setForm({});
      setEditingId(null);
      setFormOpen(false);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao salvar. Confira sua conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    const values = fields.reduce((acc, field) => {
      const fieldName = getFieldName(field);
      acc[fieldName] = row[fieldName];
      return acc;
    }, {});
    setForm(values);
    setEditingId(row.id);
    setFormOpen(true);
  };

  const closeForm = () => {
    setForm({});
    setEditingId(null);
    setFormOpen(false);
  };

  const handleRemove = async (row) => {
    const label = cardFields.map((field) => row[field]).filter(Boolean).join(' — ') || row.id;
    const confirmed = window.confirm(`Excluir "${label}"? O registro sai das telas, mas continua no backup.`);
    if (!confirmed) return;

    await repository.removeSoft(entity, row.id);
    await loadData();
  };

  useEffect(() => {
    if (!selectedId || !deepLinkEntity || loading) return;

    const row = rows.find((item) => item.id === selectedId);
    if (!row) return;

    setActionItem(row);
    notificationService.markOpenedByTarget(deepLinkEntity, selectedId);
  }, [deepLinkEntity, loading, rows, selectedId]);

  const closeActionDialog = () => {
    setActionItem(null);
    if (deepLinkBasePath) {
      navigate(deepLinkBasePath);
    }
  };

  const handleConfirmAction = async () => {
    await notificationService.confirmTarget(deepLinkEntity, actionItem.id);
    await loadData();
    closeActionDialog();
  };

  const handleSnoozeAction = async () => {
    await notificationService.snoozeTarget(deepLinkEntity, actionItem.id);
    closeActionDialog();
  };

  const handleIgnoreAction = async () => {
    await notificationService.ignoreTarget(deepLinkEntity, actionItem.id);
    closeActionDialog();
  };

  const relationOptions = useMemo(() => {
    return relations.reduce((acc, relation) => {
      acc[relation.key] = relationData[relation.key] || [];
      return acc;
    }, {});
  }, [relationData, relations]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h1>
          {subtitle ? <p className="text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadData()}
            className="ds-btn ds-btn-secondary"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button
            type="button"
            onClick={() => (formOpen ? closeForm() : setFormOpen(true))}
            className="ds-btn ds-btn-primary"
          >
            <Plus className="h-4 w-4" /> Novo
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {formOpen ? (
        <form onSubmit={handleSubmit} className="ds-card">
          <div className="grid gap-4 lg:grid-cols-2">
            {fields.map((field) => {
              const fieldName = getFieldName(field);
              const relationEntity = getRelationEntity(field);
              const relationList = relationEntity ? relationOptions[relationEntity] || [] : null;
              const isSelect = field.type === 'select' || field.type === 'relation';

              return (
                <label key={fieldName} className="ds-form-field">
                  {field.label}
                  {field.type === 'textarea' ? (
                    <textarea
                      rows="3"
                      value={fieldValue(form[fieldName], field.type)}
                      onChange={(event) => setForm((prev) => ({ ...prev, [fieldName]: event.target.value }))}
                      className={inputClass}
                      placeholder={field.placeholder || ''}
                    />
                  ) : isSelect ? (
                    <select
                      value={fieldValue(form[fieldName], field.type)}
                      onChange={(event) => setForm((prev) => ({ ...prev, [fieldName]: event.target.value }))}
                      className={inputClass}
                    >
                      <option value="">Selecione</option>
                      {(field.options || relationList || []).map((option, optionIndex) => (
                        <option key={`${fieldName}-${getOptionValue(option) || optionIndex}`} value={getOptionValue(option)}>
                          {getOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(form[fieldName])}
                        onChange={(event) => setForm((prev) => ({ ...prev, [fieldName]: event.target.checked }))}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-600">{field.help || ''}</span>
                    </div>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={fieldValue(form[fieldName], field.type)}
                      onChange={(event) => setForm((prev) => ({ ...prev, [fieldName]: event.target.value }))}
                      className={inputClass}
                      placeholder={field.placeholder || ''}
                    />
                  )}
                </label>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <button type="submit" disabled={saving} className="ds-btn ds-btn-primary disabled:opacity-60">
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Salvar'}
            </button>
            <button type="button" onClick={closeForm} disabled={saving} className="ds-btn ds-btn-secondary disabled:opacity-60">
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {loading ? (
          <div className="ds-card text-[var(--color-text-muted)]">Carregando...</div>
        ) : rows.length > 0 ? (
          rows.map((row) => (
            <div key={row.id} className="ds-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{cardFields.map((field) => row[field]).filter(Boolean).join(' — ') || row.id}</p>
                  {badgeField && row[badgeField] ? (
                    <span className={`ds-badge mt-2 ${badgeColors[row[badgeField]] || 'ds-badge-info'}`}>
                      {row[badgeField]}
                    </span>
                  ) : null}
                  {row.notes ? <p className="mt-2 text-sm text-slate-500">{row.notes}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => startEdit(row)} title="Editar" aria-label="Editar registro" className="rounded-2xl border border-[var(--color-border)] p-3 text-[var(--color-text-muted)] transition hover:bg-blue-50 hover:text-blue-600">
                    <PencilLine className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => handleRemove(row)} title="Excluir" aria-label="Excluir registro" className="rounded-2xl border border-[var(--color-border)] p-3 text-[var(--color-text-muted)] transition hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="ds-card text-[var(--color-text-muted)]">Nenhum registro encontrado.</div>
        )}
      </div>

      {actionItem ? (
        <NotificationActionDialog
          entity={deepLinkEntity}
          itemLabel={getDeepLinkLabel ? getDeepLinkLabel(actionItem) : actionItem.description || actionItem.name || actionItem.id}
          onConfirm={handleConfirmAction}
          onSnooze={handleSnoozeAction}
          onIgnore={handleIgnoreAction}
          onClose={closeActionDialog}
        />
      ) : null}
    </div>
  );
}
