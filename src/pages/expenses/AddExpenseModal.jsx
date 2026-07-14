import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Gavel, Briefcase, User, CreditCard } from 'lucide-react';
import ModalShell from '../../components/ui/ModalShell.jsx';
import { repository } from '../../repository/index.js';
import { EXPENSE_CATEGORY_OPTIONS } from '../../services/categoryCatalog.js';

const today = () => new Date().toISOString().slice(0, 10);
const inputClass = 'ds-input';

const PAYMENT_METHODS = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'outros', label: 'Outros' },
];

// Cada tipo define o segmento da despesa e (quando vinculado) qual entidade
// listar para o vínculo. 'cartao' e 'pessoal' têm tratamento próprio.
const TYPES = [
  { key: 'kitnets', label: 'Despesa de kitnet', icon: Building2, desc: 'Custo do imóvel / de uma unidade', linkEntity: 'Kitnet', linkField: 'kitnet_id', linkExtra: [{ value: 'geral', label: 'Geral (rateado)' }] },
  { key: 'pericias', label: 'Despesa de perícia', icon: Gavel, desc: 'Custo vinculado a uma perícia', linkEntity: 'ExpertReport', linkField: 'expert_report_id' },
  { key: 'projetos', label: 'Despesa de projeto', icon: Briefcase, desc: 'Custo vinculado a um projeto', linkEntity: 'ComplementaryProject', linkField: 'project_id' },
  { key: 'pessoal', label: 'Despesa pessoal', icon: User, desc: 'Gasto pessoal (vai p/ Finanças Pessoais)' },
  { key: 'cartao', label: 'Compra no cartão', icon: CreditCard, desc: 'Importar fatura de cartão' },
];

const linkOptionLabel = (row) => (
  [row.name, row.client, row.process_number, row.project_type].filter(Boolean).join(' — ') || row.id
);

function TypePicker({ onPick, onClose }) {
  return (
    <ModalShell title="Adicionar despesa" subtitle="Escolha o tipo — kitnet, perícia e projeto vinculam o custo ao cadastro." onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        {TYPES.map(({ key, label, icon: Icon, desc }) => (
          <button key={key} type="button" onClick={() => onPick(key)} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-500 hover:bg-blue-50">
            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><Icon className="h-5 w-5" /></span>
            <span>
              <span className="block font-semibold text-slate-900">{label}</span>
              <span className="block text-xs text-slate-500">{desc}</span>
            </span>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

// Despesa direta (Expense) com segmento fixo pelo tipo e vínculo condicional.
function ExpenseForm({ type, onClose, onSaved }) {
  const [links, setLinks] = useState([]);
  const [form, setForm] = useState({ date: today(), description: '', value: '', category: 'outro', link: '', payment_method: 'boleto', status: 'pendente' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!type.linkEntity) return;
    repository.list(type.linkEntity).then(setLinks);
  }, [type.linkEntity]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await repository.create('Expense', {
        date: form.date,
        segment: type.key,
        [type.linkField]: form.link || '',
        description: form.description,
        category: form.category,
        type: 'variavel',
        value: Math.max(Number(form.value || 0), 0),
        payment_method: form.payment_method,
        status: form.status,
        active: true,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const linkOptions = useMemo(() => (type.linkExtra || []).concat(links.map((row) => ({ value: row.id, label: linkOptionLabel(row) }))), [links, type.linkExtra]);

  return (
    <ModalShell title={type.label} subtitle="Despesa direta vinculada ao segmento escolhido." onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="ds-form-field sm:col-span-2">Descrição
          <input className={inputClass} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Descrição da despesa" />
        </label>
        {type.linkEntity ? (
          <label className="ds-form-field sm:col-span-2">{type.linkEntity === 'Kitnet' ? 'Kitnet' : type.linkEntity === 'ExpertReport' ? 'Perícia' : 'Projeto'}
            <select className={inputClass} value={form.link} onChange={(e) => set({ link: e.target.value })}>
              <option value="">Selecione</option>
              {linkOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </label>
        ) : null}
        <label className="ds-form-field">Valor (R$)
          <input type="number" className={inputClass} value={form.value} onChange={(e) => set({ value: e.target.value })} placeholder="1200" />
        </label>
        <label className="ds-form-field">Data
          <input type="date" className={inputClass} value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <label className="ds-form-field">Categoria
          <select className={inputClass} value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {EXPENSE_CATEGORY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </label>
        <label className="ds-form-field">Forma de pagamento
          <select className={inputClass} value={form.payment_method} onChange={(e) => set({ payment_method: e.target.value })}>
            {PAYMENT_METHODS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </label>
        <label className="ds-form-field">Status
          <select className={inputClass} value={form.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
          </select>
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={save} disabled={saving || !form.value} className="ds-btn ds-btn-primary disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar despesa'}</button>
        <button type="button" onClick={onClose} className="ds-btn ds-btn-secondary">Cancelar</button>
      </div>
    </ModalShell>
  );
}

// Despesa pessoal → PersonalIncome (type expense, contexto pessoal).
function PersonalExpenseForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ date: today(), description: '', value: '', category: '', status: 'pago' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await repository.create('PersonalIncome', {
        type: 'expense',
        context: 'pessoal',
        description: form.description,
        category: form.category,
        value: Math.max(Number(form.value || 0), 0),
        date: form.date,
        status: form.status,
        active: true,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Despesa pessoal" subtitle="Gasto pessoal — vai para Finanças Pessoais." onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="ds-form-field sm:col-span-2">Descrição
          <input className={inputClass} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ex: mercado, farmácia..." />
        </label>
        <label className="ds-form-field">Valor (R$)
          <input type="number" className={inputClass} value={form.value} onChange={(e) => set({ value: e.target.value })} />
        </label>
        <label className="ds-form-field">Data
          <input type="date" className={inputClass} value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <label className="ds-form-field">Categoria
          <input className={inputClass} value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder="alimentação, transporte..." />
        </label>
        <label className="ds-form-field">Status
          <select className={inputClass} value={form.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
          </select>
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={save} disabled={saving || !form.value} className="ds-btn ds-btn-primary disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar despesa'}</button>
        <button type="button" onClick={onClose} className="ds-btn ds-btn-secondary">Cancelar</button>
      </div>
    </ModalShell>
  );
}

export default function AddExpenseModal({ onClose, onSaved }) {
  const navigate = useNavigate();
  const [typeKey, setTypeKey] = useState('');

  const pick = (key) => {
    if (key === 'cartao') { onClose(); navigate('/cartoes'); return; }
    setTypeKey(key);
  };

  if (!typeKey) return <TypePicker onPick={pick} onClose={onClose} />;
  if (typeKey === 'pessoal') return <PersonalExpenseForm onClose={onClose} onSaved={onSaved} />;
  const type = TYPES.find((t) => t.key === typeKey);
  return <ExpenseForm type={type} onClose={onClose} onSaved={onSaved} />;
}
