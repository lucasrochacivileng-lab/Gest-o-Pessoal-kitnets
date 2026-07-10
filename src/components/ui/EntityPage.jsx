import React, { useEffect, useMemo, useState } from 'react';
import { repository } from '../../repository/index.js';
import { PencilLine, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NotificationActionDialog from '../../modules/notifications/components/NotificationActionDialog.jsx';
import notificationService from '../../modules/notifications/services/notificationService.js';
import { useEntitySync } from '../../hooks/useEntitySync.js';
import { formatCompetenceBR, formatDateBR } from '../../services/dateUtils.js';
import { financialService } from '../../services/financialService';

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

// Formata o valor de UM campo de acordo com o "format" declarado em columns/
// detailFields — usado tanto no modo tabela quanto no cartão com rótulos.
function formatFieldValue(row, config, relationOptions) {
  const raw = row[config.field];
  if (raw === undefined || raw === null || raw === '') return '';

  switch (config.format) {
    case 'currency':
      return financialService.formatCurrency(raw);
    case 'date':
      return formatDateBR(raw);
    case 'competence':
      return formatCompetenceBR(raw);
    case 'boolean':
      return raw ? 'Sim' : 'Não';
    case 'relation': {
      // 'geral' é um sentinela reservado (não é id de nenhuma relação real)
      // para lançamentos que não pertencem a um item específico — ex.: conta
      // de água/energia que cobre todas as kitnets do imóvel.
      if (raw === 'geral') return 'Geral';
      const list = (relationOptions[config.relation] || []);
      const match = list.find((item) => item.id === raw);
      // Sem match, o id não aponta mais pra nada (registro apagado ou
      // referência quebrada) — mostrar o uuid cru confunde mais do que
      // ajuda, então cai no mesmo "—" de campo vazio.
      return match?.name || match?.title || '';
    }
    default:
      return String(raw);
  }
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
  checkDuplicate,
  filterRows,
  // Modo tabela (desktop: <table>; celular: cartões empilhados com rótulo).
  columns,
  // Modo cartão avançado: linhas "Rótulo: valor" + um valor em destaque.
  detailFields,
  headlineField,
  headlineFormat = 'currency',
  // Avisa a página-mãe sempre que os registros são recarregados, para um
  // painel de resumo ao lado (ex.: divisão por forma de pagamento) usar a
  // mesma lista/instante da tabela — em vez de buscar a entidade de novo e
  // ficar defasado logo após um Novo/Editar/Excluir feito aqui dentro.
  onRowsChange,
  // Preenche campos que faltam num registro antigo a partir de uma relação
  // já carregada (ex.: Pagamento sem kitnet_id/tenant_id próprios, mas com
  // receivable_id — resolve pelo Recebível). Roda só na exibição, não grava
  // nada no banco. Recebe (row, relationOptions) e devolve a linha completa.
  enrichRow,
  // Campos fixos gravados junto do formulário, mas que o usuário não edita
  // (ex.: `type: 'card_transaction'` para o lançamento entrar nos mesmos
  // relatórios de quem importa fatura). Só se aplica ao CRIAR, não ao editar.
  defaultValues = {},
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
      onRowsChange?.(results[0]);
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
      // Todo campo numérico deste formulário é valor em R$, dia do mês ou
      // contagem de parcela — nenhum é legitimamente negativo. Sem esse piso,
      // um "-" digitado por engano na frente do valor entra direto no banco
      // e some das somas (uma despesa negativa aumenta o lucro em vez de
      // reduzi-lo, por exemplo).
      if (field.type === 'number') value = Math.max(Number(value || 0), 0);
      if (field.type === 'checkbox') value = Boolean(value);
      acc[fieldName] = value;
      return acc;
    }, {});

    // Só checa duplicidade ao CRIAR: editar um lançamento que já é o "original"
    // de um grupo não deveria travar em si mesmo.
    if (!editingId && checkDuplicate) {
      const conflict = checkDuplicate(payload, rows);

      if (conflict) {
        const conflictLabel = conflict.description || conflict.category || 'lançamento';
        const confirmed = window.confirm(
          `Já existe um lançamento parecido este mês: "${conflictLabel}" de `
          + `${financialService.formatCurrency(conflict.value)} em ${formatDateBR(conflict.date)}. `
          + 'Continuar mesmo assim?',
        );

        if (!confirmed) {
          setSaving(false);
          return;
        }
      }
    }

    try {
      if (editingId) {
        await repository.update(entity, editingId, payload);
      } else {
        await repository.create(entity, { ...defaultValues, ...payload, active: true });
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
    const label = getCardTitle(row);
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

  // cardFields aceita nome de campo puro ('name') ou config formatada
  // ({ field, format, relation }), para o título do cartão poder mostrar
  // "Kitnet 03 · 07/2026" em vez do valor cru do banco.
  const getCardTitle = (row) => cardFields
    .map((entry) => (typeof entry === 'string' ? row[entry] : formatFieldValue(row, entry, relationOptions)))
    .filter(Boolean)
    .join(' — ') || row.id;

  const enrichedRows = useMemo(() => (
    typeof enrichRow === 'function' ? rows.map((row) => enrichRow(row, relationOptions)) : rows
  ), [rows, enrichRow, relationOptions]);

  const visibleRows = useMemo(() => (
    typeof filterRows === 'function' ? filterRows(enrichedRows) : enrichedRows
  ), [filterRows, enrichedRows]);

  // Modo tabela: mais recente primeiro, usando a primeira coluna de data.
  const sortedRows = useMemo(() => {
    if (!columns) return visibleRows;
    const dateColumn = columns.find((column) => column.format === 'date');
    if (!dateColumn) return visibleRows;
    return [...visibleRows].sort((a, b) => String(b[dateColumn.field] || '').localeCompare(String(a[dateColumn.field] || '')));
  }, [visibleRows, columns]);

  const renderBadge = (value) => (
    <span className={`ds-badge ${badgeColors[value] || 'ds-badge-info'}`}>{value}</span>
  );

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
                      {(field.extraOptions || []).map((option, optionIndex) => (
                        <option key={`${fieldName}-extra-${getOptionValue(option) || optionIndex}`} value={getOptionValue(option)}>
                          {getOptionLabel(option)}
                        </option>
                      ))}
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

      {loading ? (
        <div className="ds-card text-[var(--color-text-muted)]">Carregando...</div>
      ) : visibleRows.length === 0 ? (
        <div className="ds-card text-[var(--color-text-muted)]">Nenhum registro encontrado.</div>
      ) : columns ? (
        <>
          {/* Desktop/tablet: tabela de verdade. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-alt)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <tr>
                  {columns.map((column) => (
                    <th key={column.field} className={`px-4 py-3 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
                      {column.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--color-border)] transition hover:bg-[var(--color-surface-alt)]">
                    {columns.map((column) => {
                      const value = row[column.field];
                      return (
                        <td
                          key={column.field}
                          className={`px-4 py-3 ${column.align === 'right' ? 'text-right tabular-nums' : ''} ${column.format === 'currency' ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}
                        >
                          {column.format === 'badge'
                            ? (value ? renderBadge(value) : '—')
                            : (formatFieldValue(row, column, relationOptions) || '—')}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" onClick={() => startEdit(row)} title="Editar" aria-label="Editar registro" className="rounded-xl border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] transition hover:bg-blue-50 hover:text-blue-600">
                          <PencilLine className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleRemove(row)} title="Excluir" aria-label="Excluir registro" className="rounded-xl border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] transition hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: mesma informação, em cartões empilhados com rótulo. */}
          <div className="space-y-3 md:hidden">
            {sortedRows.map((row) => (
              <div key={row.id} className="ds-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {columns.map((column) => {
                      const value = row[column.field];
                      if (!value && value !== 0) return null;

                      return (
                        <p key={column.field} className="text-sm">
                          <span className="text-[var(--color-text-muted)]">{column.label}: </span>
                          {column.format === 'badge' ? renderBadge(value) : (
                            <span className={column.format === 'currency' ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-text)]'}>
                              {formatFieldValue(row, column, relationOptions)}
                            </span>
                          )}
                        </p>
                      );
                    })}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button type="button" onClick={() => startEdit(row)} title="Editar" aria-label="Editar registro" className="rounded-2xl border border-[var(--color-border)] p-3 text-[var(--color-text-muted)] transition hover:bg-blue-50 hover:text-blue-600">
                      <PencilLine className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => handleRemove(row)} title="Excluir" aria-label="Excluir registro" className="rounded-2xl border border-[var(--color-border)] p-3 text-[var(--color-text-muted)] transition hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {visibleRows.map((row) => (
            <div key={row.id} className="ds-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{getCardTitle(row)}</p>
                  {badgeField && row[badgeField] ? (
                    <span className={`ds-badge mt-2 ${badgeColors[row[badgeField]] || 'ds-badge-info'}`}>
                      {row[badgeField]}
                    </span>
                  ) : null}
                  {detailFields ? (
                    <div className="mt-2 space-y-1">
                      {detailFields.map((config) => {
                        const value = formatFieldValue(row, config, relationOptions);
                        if (!value) return null;
                        return (
                          <p key={config.field} className="text-sm">
                            <span className="text-[var(--color-text-muted)]">{config.label}: </span>
                            <span className="text-[var(--color-text)]">{value}</span>
                          </p>
                        );
                      })}
                    </div>
                  ) : null}
                  {row.notes ? (
                    <p className="mt-2 text-sm text-slate-500">{detailFields ? `Observações: ${row.notes}` : row.notes}</p>
                  ) : null}
                </div>
                {headlineField ? (
                  <p className="flex-shrink-0 text-lg font-bold tabular-nums text-[var(--color-text)]">
                    {formatFieldValue(row, { field: headlineField, format: headlineFormat }, relationOptions)}
                  </p>
                ) : (
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button type="button" onClick={() => startEdit(row)} title="Editar" aria-label="Editar registro" className="rounded-2xl border border-[var(--color-border)] p-3 text-[var(--color-text-muted)] transition hover:bg-blue-50 hover:text-blue-600">
                      <PencilLine className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => handleRemove(row)} title="Excluir" aria-label="Excluir registro" className="rounded-2xl border border-[var(--color-border)] p-3 text-[var(--color-text-muted)] transition hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
              {headlineField ? (
                <div className="mt-3 flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-3">
                  <button type="button" onClick={() => startEdit(row)} title="Editar" aria-label="Editar registro" className="rounded-2xl border border-[var(--color-border)] p-2.5 text-[var(--color-text-muted)] transition hover:bg-blue-50 hover:text-blue-600">
                    <PencilLine className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => handleRemove(row)} title="Excluir" aria-label="Excluir registro" className="rounded-2xl border border-[var(--color-border)] p-2.5 text-[var(--color-text-muted)] transition hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

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
