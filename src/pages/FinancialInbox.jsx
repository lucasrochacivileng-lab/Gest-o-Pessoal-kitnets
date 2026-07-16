import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, CreditCard, FileText, Inbox, RefreshCw, X } from 'lucide-react';
import { repository } from '../repository/index.js';
import { financialService } from '../services/financialService';
import financialInboxService from '../services/financialInboxService.js';
import { CARD_CATEGORY_OPTIONS } from '../services/categoryCatalog.js';

const TYPE_META = {
  purchase: { label: 'Compra no cartão', icon: CreditCard, tone: 'bg-violet-50 text-violet-700' },
  pix_sent: { label: 'Pix enviado', icon: ArrowUpRight, tone: 'bg-rose-50 text-rose-700' },
  pix_received: { label: 'Pix recebido', icon: ArrowDownLeft, tone: 'bg-emerald-50 text-emerald-700' },
  boleto_issued: { label: 'Boleto emitido', icon: FileText, tone: 'bg-amber-50 text-amber-700' },
  internal_transfer: { label: 'Transferência entre contas próprias', icon: ArrowRightLeft, tone: 'bg-blue-50 text-blue-700' },
};

const STATUS_LABELS = {
  pending: 'Revisar',
  confirmed: 'Confirmada',
  ignored: 'Ignorada',
  error: 'Erro',
};

const COST_CENTERS = [
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'kitnets', label: 'Kitnets' },
  { value: 'pericias', label: 'Perícias' },
  { value: 'projetos', label: 'Projetos' },
  { value: 'trabalho', label: 'Trabalho / Servidor' },
];

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '-';

function Summary({ label, value, tone }) {
  return (
    <div className="ds-card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

const providerTerms = {
  nubank: ['nubank'], inter: ['inter'], itau: ['itau', 'itaú'], caixa: ['caixa'], mercado_pago: ['mercado pago'],
};

const uniqueAccountForProvider = (accounts, provider) => {
  const explicit = accounts.find((account) => (
    account.notification_provider === provider
    && account.is_primary_transaction_account === true
  ));
  if (explicit) return explicit;

  const terms = providerTerms[provider] || [];
  const matches = accounts.filter((account) => terms.some((term) => `${account.name || ''} ${account.institution || ''}`.toLowerCase().includes(term)));
  return matches.length === 1 ? matches[0] : null;
};

function TransactionCard({ row, accounts, cards, onConfirm, onIgnore, onUnpair, busy }) {
  const meta = TYPE_META[row.transaction_type] || TYPE_META.purchase;
  const Icon = meta.icon;
  const nubankCard = cards.find((card) => String(card.name || card.bank || '').toLowerCase().includes('nubank'));
  const suggestedSource = uniqueAccountForProvider(accounts, row.provider);
  const suggestedDestination = uniqueAccountForProvider(accounts, row.destination_provider);
  const [form, setForm] = useState({
    category: row.category_confirmed || row.category_suggested || 'outros',
    costCenter: row.cost_center_confirmed || row.cost_center_suggested || 'pessoal',
    bankAccountId: row.bank_account_id || suggestedSource?.id || '',
    destinationBankAccountId: row.destination_bank_account_id || suggestedDestination?.id || '',
    creditCardId: row.credit_card_id || nubankCard?.id || '',
    dueDate: row.due_date || '',
  });
  const pending = row.status === 'pending';
  const isInternalTransfer = row.transaction_type === 'internal_transfer';
  const needsBankAccount = ['pix_sent', 'pix_received'].includes(row.transaction_type);

  const confirm = () => {
    if (needsBankAccount && !form.bankAccountId) {
      window.alert('Selecione a conta bancária em que o Pix entrou ou saiu.');
      return;
    }
    if (isInternalTransfer && (!form.bankAccountId || !form.destinationBankAccountId)) {
      window.alert('Selecione as contas de origem e destino da transferência.');
      return;
    }
    if (isInternalTransfer && form.bankAccountId === form.destinationBankAccountId) {
      window.alert('A conta de destino deve ser diferente da conta de origem.');
      return;
    }
    onConfirm(row.id, { ...form, transactionType: row.transaction_type });
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.tone}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{row.description}</p>
              <p className="mt-0.5 text-xs text-slate-500">{meta.label} · {formatDateTime(row.occurred_at)}</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold tabular-nums ${row.direction === 'in' ? 'text-emerald-600' : 'text-slate-900'}`}>
                {row.direction === 'in' ? '+' : '-'} {financialService.formatCurrency(row.amount)}
              </p>
              <span className={`ds-badge ${row.status === 'confirmed' ? 'ds-badge-success' : row.status === 'pending' ? 'ds-badge-warning' : 'ds-badge-info'}`}>
                {STATUS_LABELS[row.status] || row.status}
              </span>
            </div>
          </div>

          {pending ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {isInternalTransfer ? (
                <>
                  <label className="ds-form-field">Conta de origem
                    <select className="ds-input" value={form.bankAccountId} onChange={(event) => setForm((current) => ({ ...current, bankAccountId: event.target.value }))}>
                      <option value="">Selecione</option>
                      {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </label>
                  <label className="ds-form-field">Conta de destino
                    <select className="ds-input" value={form.destinationBankAccountId} onChange={(event) => setForm((current) => ({ ...current, destinationBankAccountId: event.target.value }))}>
                      <option value="">Selecione</option>
                      {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                    </select>
                  </label>
                </>
              ) : (
                <>
              <label className="ds-form-field">Categoria
                <select className="ds-input" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                  {CARD_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="ds-form-field">Centro de custo
                <select className="ds-input" value={form.costCenter} onChange={(event) => setForm((current) => ({ ...current, costCenter: event.target.value }))}>
                  {COST_CENTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              {row.transaction_type === 'boleto_issued' ? (
                <label className="ds-form-field">Vencimento
                  <input type="date" className="ds-input" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
                </label>
              ) : needsBankAccount ? (
                <label className="ds-form-field">Conta bancária
                  <select className="ds-input" value={form.bankAccountId} onChange={(event) => setForm((current) => ({ ...current, bankAccountId: event.target.value }))}>
                    <option value="">Selecione</option>
                    {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </label>
              ) : (
                <label className="ds-form-field">Cartão
                  <select className="ds-input" value={form.creditCardId} onChange={(event) => setForm((current) => ({ ...current, creditCardId: event.target.value }))}>
                    <option value="">Selecionar depois</option>
                    {cards.map((card) => <option key={card.id} value={card.id}>{card.name || card.bank || card.id}</option>)}
                  </select>
                </label>
              )}
                </>
              )}
            </div>
          ) : null}

          {pending ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={confirm} disabled={busy} className="ds-btn ds-btn-primary disabled:opacity-60">
                {isInternalTransfer ? 'Confirmar transferência interna' : row.transaction_type === 'boleto_issued' ? 'Adicionar às despesas previstas' : 'Confirmar lançamento'}
              </button>
              {isInternalTransfer ? (
                <button type="button" onClick={() => onUnpair(row.id)} disabled={busy} className="ds-btn ds-btn-secondary disabled:opacity-60">
                  Não é transferência interna
                </button>
              ) : null}
              <button type="button" onClick={() => onIgnore(row.id)} disabled={busy} className="ds-btn ds-btn-secondary disabled:opacity-60">
                Ignorar
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function FinancialInbox() {
  const [inbox, setInbox] = useState({ transactions: [], unrecognized: [] });
  const [accounts, setAccounts] = useState([]);
  const [cards, setCards] = useState([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [nextInbox, nextAccounts, nextCards] = await Promise.all([
        financialInboxService.list(),
        repository.list('BankAccount'),
        repository.list('CreditCard'),
      ]);
      setInbox(nextInbox);
      setAccounts(nextAccounts);
      setCards(nextCards);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a caixa de entrada.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load({ silent: true }), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const visible = useMemo(() => inbox.transactions.filter((row) => status === 'all' || row.status === status), [inbox.transactions, status]);
  const pendingCount = inbox.transactions.filter((row) => row.status === 'pending').length;

  const run = async (id, action) => {
    setBusyId(id);
    try {
      await action();
      await load({ silent: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'A operação não pôde ser concluída.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Caixa de Entrada Financeira</h1>
          <p className="text-sm text-slate-500">Notificações bancárias capturadas pelo MacroDroid aguardando sua revisão.</p>
        </div>
        <button type="button" onClick={() => load()} className="ds-btn ds-btn-secondary self-start"><RefreshCw className="h-4 w-4" /> Atualizar</button>
      </div>

      {message ? <div className="ds-alert ds-alert-info">{message}</div> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="A revisar" value={pendingCount} tone="text-amber-600" />
        <Summary label="Confirmadas" value={inbox.transactions.filter((row) => row.status === 'confirmed').length} tone="text-emerald-600" />
        <Summary label="Não reconhecidas" value={inbox.unrecognized.length} tone="text-slate-700" />
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {[{ value: 'pending', label: 'A revisar' }, { value: 'confirmed', label: 'Confirmadas' }, { value: 'all', label: 'Todas' }].map((option) => (
          <button key={option.value} type="button" onClick={() => setStatus(option.value)} className={`rounded-md px-3 py-2 text-sm font-semibold ${status === option.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{option.label}</button>
        ))}
      </div>

      {loading ? <div className="ds-card text-slate-500">Carregando movimentações...</div> : (
        <div className="space-y-3">
          {visible.map((row) => (
            <TransactionCard
              key={row.id}
              row={row}
              accounts={accounts}
              cards={cards}
              busy={busyId === row.id}
              onConfirm={(id, values) => run(id, () => financialInboxService.confirm(id, values))}
              onIgnore={(id) => run(id, () => financialInboxService.ignore(id))}
              onUnpair={(id) => run(id, () => financialInboxService.unpair(id))}
            />
          ))}
          {!visible.length ? <div className="ds-card text-center text-sm text-slate-500"><Inbox className="mx-auto mb-2 h-6 w-6" />Nenhuma movimentação nesta lista.</div> : null}
        </div>
      )}

      {inbox.unrecognized.length ? (
        <section className="space-y-3">
          <div><h2 className="text-lg font-semibold text-slate-900">Não reconhecidas</h2><p className="text-sm text-slate-500">Foram preservadas, mas não alteram o financeiro.</p></div>
          {inbox.unrecognized.map((notification) => (
            <div key={notification.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <Inbox className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
              <div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{notification.raw_title || 'Notificação bancária'}</p><p className="mt-1 text-sm text-slate-600">{notification.raw_text}</p><p className="mt-1 text-xs text-slate-400">{formatDateTime(notification.received_at)}</p></div>
              <button type="button" title="Ignorar" onClick={() => run(notification.id, () => financialInboxService.ignoreNotification(notification.id))} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
