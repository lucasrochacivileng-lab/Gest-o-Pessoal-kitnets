import React, { useEffect, useMemo, useState } from 'react';
import { repository } from '../../repository/index.js';
import { Plus, Trash2 } from 'lucide-react';

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

export default function EntityPage({ title, subtitle, entity, fields, cardFields, relations = [] }) {
  const [rows, setRows] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({});
  const [relationData, setRelationData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const promises = [repository.list(entity)];
    relations.forEach((relation) => promises.push(repository.list(relation.entity)));
    const results = await Promise.all(promises);
    setRows(results[0]);
    const relationState = relations.reduce((acc, relation, index) => {
      acc[relation.key] = results[index + 1];
      return acc;
    }, {});
    setRelationData(relationState);
    setLoading(false);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    const payload = fields.reduce((acc, field) => {
      const fieldName = getFieldName(field);
      let value = form[fieldName];
      if (field.type === 'number') value = Number(value || 0);
      if (field.type === 'checkbox') value = Boolean(value);
      acc[fieldName] = value;
      return acc;
    }, {});
    await repository.create(entity, { ...payload, active: true });
    setForm({});
    setFormOpen(false);
    await loadData();
  };

  const handleRemove = async (id) => {
    await repository.removeSoft(entity, id);
    await loadData();
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
        <button
          type="button"
          onClick={() => setFormOpen((state) => !state)}
          className="ds-btn ds-btn-primary"
        >
          <Plus className="h-4 w-4" /> Novo
        </button>
      </div>

      {formOpen ? (
        <form onSubmit={handleCreate} className="ds-card">
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
                      {(field.options || relationList || []).map((option) => (
                        <option key={option.value ?? option.id ?? option.name} value={option.value ?? option.id ?? option.name}>
                          {option.label ?? option.name ?? option.title ?? option.competence ?? option.process_number ?? option.id}
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
            <button type="submit" className="ds-btn ds-btn-primary">
              Salvar
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="ds-btn ds-btn-secondary">
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
                  {row.notes ? <p className="mt-2 text-sm text-slate-500">{row.notes}</p> : null}
                </div>
                <button type="button" onClick={() => handleRemove(row.id)} className="rounded-full border border-[var(--color-border)] p-2 text-[var(--color-text-muted)] transition hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="ds-card text-[var(--color-text-muted)]">Nenhum registro encontrado.</div>
        )}
      </div>
    </div>
  );
}
