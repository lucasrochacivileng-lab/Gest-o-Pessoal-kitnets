import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Gavel, Briefcase, User, CreditCard, Receipt } from 'lucide-react';
import ModalShell from '../../components/ui/ModalShell.jsx';
import { repository } from '../../repository/index.js';
import { EXPENSE_CATEGORY_OPTIONS } from '../../services/categoryCatalog.js';
import { buildCardBalances } from '../../services/cardBalanceService.js';
import { CARD_PAYMENT_TYPE } from '../../services/personalMovementClassifier.js';

const today = () => new Date().toISOString().slice(0, 10);
const inputClass = 'ds-input';
const money = (value = 0) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
  { key: 'fatura', label: 'Pagamento de fatura', icon: Receipt, desc: 'Quita o cartão — sai da conta, não é gasto novo' },
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

// Pagamento da FATURA do cartão. Não é gasto novo (a compra já foi contada
// quando entrou); é a quitação da dívida do cartão — dinheiro saindo do banco.
// Por isso grava com type 'card_payment': fica fora de "gastos por categoria"
// e do resultado, mas entra na conciliação do banco e abate o saldo do cartão.
function CardInvoicePaymentForm({ onClose, onSaved }) {
  const [balances, setBalances] = useState({ cards: [] });
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ card_name: '', value: '', date: today(), bank_account_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    (async () => {
      const [personal, bankAccounts] = await Promise.all([
        repository.list('PersonalIncome'),
        repository.list('BankAccount'),
      ]);
      setBalances(buildCardBalances({ personal }));
      setAccounts(bankAccounts);
    })();
  }, []);

  const selectedCard = balances.cards.find((card) => card.cardName === form.card_name) || null;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await repository.create('PersonalIncome', {
        type: CARD_PAYMENT_TYPE,
        card_name: form.card_name,
        description: `Pagamento da fatura — ${form.card_name}`,
        value: Math.max(Number(form.value || 0), 0),
        date: form.date,
        bank_account_id: form.bank_account_id || '',
        status: 'pago',
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
    <ModalShell
      title="Pagamento de fatura"
      subtitle="Não conta como gasto novo (as compras já entraram) — abate a dívida do cartão e sai da conta."
      onClose={onClose}
    >
      {balances.cards.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum cartão com lançamentos ainda. Importe uma fatura ou lance uma compra primeiro.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="ds-form-field sm:col-span-2">Cartão
            <select className={inputClass} value={form.card_name} onChange={(e) => {
              const card = balances.cards.find((item) => item.cardName === e.target.value);
              // Sugere o saldo devedor como valor — o caso comum é pagar a fatura cheia.
              set({ card_name: e.target.value, value: card && card.balance > 0 ? String(card.balance) : '' });
            }}>
              <option value="">Selecione</option>
              {balances.cards.map((card) => (
                <option key={card.key} value={card.cardName}>
                  {card.cardName} — devendo {money(card.balance)}
                </option>
              ))}
            </select>
          </label>
          <label className="ds-form-field">Valor pago (R$)
            <input type="number" className={inputClass} value={form.value} onChange={(e) => set({ value: e.target.value })} />
          </label>
          <label className="ds-form-field">Data do pagamento
            <input type="date" className={inputClass} value={form.date} onChange={(e) => set({ date: e.target.value })} />
          </label>
          <label className="ds-form-field sm:col-span-2">Conta que pagou
            <select className={inputClass} value={form.bank_account_id} onChange={(e) => set({ bank_account_id: e.target.value })}>
              <option value="">Selecione (opcional)</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name || account.id}</option>)}
            </select>
          </label>
          {selectedCard ? (
            <p className="sm:col-span-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
              {selectedCard.cardName}: {money(selectedCard.charged)} em compras − {money(selectedCard.paid)} já pagos ={' '}
              <strong>{money(selectedCard.balance)}</strong> em aberto. Depois deste pagamento de{' '}
              {money(Number(form.value || 0))}, fica {money(selectedCard.balance - Number(form.value || 0))}.
            </p>
          ) : null}
        </div>
      )}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={save} disabled={saving || !form.card_name || !form.value} className="ds-btn ds-btn-primary disabled:opacity-60">
          {saving ? 'Salvando...' : 'Registrar pagamento'}
        </button>
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
  if (typeKey === 'fatura') return <CardInvoicePaymentForm onClose={onClose} onSaved={onSaved} />;
  const type = TYPES.find((t) => t.key === typeKey);
  return <ExpenseForm type={type} onClose={onClose} onSaved={onSaved} />;
}
