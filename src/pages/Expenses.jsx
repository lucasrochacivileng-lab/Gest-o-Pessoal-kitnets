import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import EntityPage from '../components/ui/EntityPage.jsx';
import { NOTIFICATION_ENTITY } from '../modules/notifications/types/notification.types.js';
import { recurringExpenseService } from '../services/recurringExpenseService.js';
import { findExpenseDuplicateOf } from '../services/duplicateCheckService.js';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import { repository } from '../repository/index.js';
import { useEntitySync } from '../hooks/useEntitySync.js';
import { buildCardInvoices, buildCardInvoiceSummary } from '../services/cardInvoiceService.js';
import { financialService } from '../services/financialService';
import { formatDateBR } from '../services/dateUtils.js';

const fields = [
  { name: 'date', label: 'Data', type: 'date' },
  { name: 'category', label: 'Categoria', type: 'select', options: [
    { value: 'manutencao', label: 'Manutenção' },
    { value: 'agua', label: 'Água' },
    { value: 'luz', label: 'Luz' },
    { value: 'energia_solar', label: 'Energia solar (parcela)' },
    { value: 'moveis', label: 'Móveis/eletrodomésticos (parcela)' },
    { value: 'internet', label: 'Internet' },
    { value: 'iptu', label: 'IPTU' },
    { value: 'seguro', label: 'Seguro' },
    { value: 'limpeza', label: 'Limpeza' },
    { value: 'material', label: 'Material' },
    { value: 'pessoal', label: 'Pessoal' },
    { value: 'obra', label: 'Obra' },
    { value: 'outro', label: 'Outro' },
  ] },
  { name: 'type', label: 'Tipo', type: 'select', options: [
    { value: 'fixa', label: 'Fixa' },
    { value: 'variavel', label: 'Variável' },
  ] },
  { name: 'kitnet_id', label: 'Kitnet', type: 'select', optionsEntity: 'Kitnet', extraOptions: [
    { value: 'geral', label: 'Geral (todas as kitnets)' },
  ] },
  { name: 'description', label: 'Descrição', type: 'textarea', placeholder: 'Descrição da despesa' },
  { name: 'value', label: 'Valor', type: 'number', placeholder: '1200' },
  { name: 'payment_method', label: 'Forma de pagamento', placeholder: 'Pix, dinheiro, transferência' },
  { name: 'account', label: 'Conta', placeholder: 'Mercado Pago, Itaú, Nubank' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'pendente', label: 'Pendente' },
    { value: 'pago', label: 'Pago' },
  ] },
  { name: 'recurring', label: 'Despesa recorrente', type: 'checkbox', help: 'Repete todo mês (água, parcelas de cartão...)' },
  { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Ex: comprovante anexo' },
];

const columns = [
  { field: 'date', label: 'Data', format: 'date' },
  { field: 'description', label: 'Descrição' },
  { field: 'kitnet_id', label: 'Kitnet', format: 'relation', relation: 'Kitnet' },
  { field: 'category', label: 'Categoria' },
  { field: 'value', label: 'Valor', format: 'currency', align: 'right' },
  { field: 'status', label: 'Status', format: 'badge' },
];

const STATUS_BADGE_COLORS = {
  pago: 'ds-badge-success',
  pendente: 'ds-badge-warning',
};

const ORIGIN_LABELS = {
  kitnets: 'Kitnets',
  pessoal: 'Pessoal',
};

const COST_TYPE_LABELS = {
  custeio: 'Custeio',
  investimento: 'Investimento',
  financiamento: 'Financiamento',
};

export const filterExpensesByCompetence = (rows = [], competence = '') => (
  rows.filter((row) => String(row.date || '').startsWith(competence))
);

// Água, luz, internet e mútua costumam ir de boleto; esquadria/móveis, de
// Pix — o campo "forma de pagamento" é texto livre, então a comparação é
// por trecho (case-insensitive) para aceitar "Boleto", "boleto bancário" etc.
export const groupExpensesByPaymentMethod = (rows = []) => (
  rows.reduce((acc, row) => {
    const method = String(row.payment_method || '').toLowerCase();
    const key = method.includes('boleto') ? 'boleto' : method.includes('pix') ? 'pix' : 'outros';
    acc[key] += Number(row.value ?? 0);
    return acc;
  }, { boleto: 0, pix: 0, outros: 0 })
);

function SummaryCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{financialService.formatCurrency(value)}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function CardInvoicesPanel({ invoices, summary, selectedCard, onSelectCard, paymentMethodSummary }) {
  const selectedInvoice = invoices.find((invoice) => invoice.cardName === selectedCard) || invoices[0] || null;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Faturas do mês" value={summary.invoiceTotal} sub={`${invoices.length} cartão(ões)`} />
        <SummaryCard label="Cartão pessoal" value={summary.personalTotal} sub="origem pessoal" />
        <SummaryCard label="Cartão nas kitnets" value={summary.kitnetsTotal} sub="inclui obra/investimento" />
        <SummaryCard label="Investimento/financiamento" value={summary.investmentTotal} sub={`${summary.reviewCount} item(ns) a revisar`} />
      </div>

      {!invoices.length ? (
        <p className="ds-card text-sm text-slate-500">Nenhuma fatura de cartão encontrada para este mês.</p>
      ) : null}

      {/* Boleto/Pix das despesas diretas ficam no mesmo grid das faturas de
          cartão, ocupando o espaço vazio ao lado em vez de um bloco à parte. */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {invoices.map((invoice) => {
          const active = invoice.cardName === selectedInvoice?.cardName;
          return (
            <button
              key={invoice.cardName}
              type="button"
              onClick={() => onSelectCard(invoice.cardName)}
              className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{invoice.cardName}</p>
                  <p className="mt-1 text-xs text-slate-500">Vencimento {formatDateBR(invoice.dueDate)}</p>
                </div>
                {invoice.reviewCount ? <span className="ds-badge ds-badge-warning">{invoice.reviewCount} revisar</span> : <span className="ds-badge ds-badge-success">ok</span>}
              </div>
              <p className="mt-3 text-xl font-semibold text-slate-900">{financialService.formatCurrency(invoice.total)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Kitnets {financialService.formatCurrency(invoice.kitnetsTotal)} · Pessoal {financialService.formatCurrency(invoice.personalTotal)}
              </p>
            </button>
          );
        })}
        <SummaryCard label="Boleto" value={paymentMethodSummary.boleto} sub="água, energia, internet, mútua..." />
        <SummaryCard label="Pix" value={paymentMethodSummary.pix} sub="esquadrias, móveis..." />
        <SummaryCard label="Outros" value={paymentMethodSummary.outros} sub="sem boleto/Pix identificado" />
      </div>

      {selectedInvoice ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Classificação</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Parcela</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {selectedInvoice.items.map((item) => (
                <tr key={item.id || item.origin_hash} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">{formatDateBR(item.date)}</td>
                  <td className="px-4 py-3 text-slate-900">{item.description || item.category || 'Compra no cartão'}</td>
                  <td className="px-4 py-3 text-slate-600">{ORIGIN_LABELS[item.origin] || item.origin}</td>
                  <td className="px-4 py-3 text-slate-600">{item.category || 'sem categoria'}</td>
                  <td className="px-4 py-3 text-slate-600">{COST_TYPE_LABELS[item.costType] || item.costType}</td>
                  <td className="px-4 py-3 text-slate-600">{item.installment || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{financialService.formatCurrency(item.value)}</td>
                  <td className="px-4 py-3">
                    <span className={`ds-badge ${item.status === 'pago' ? 'ds-badge-success' : 'ds-badge-warning'}`}>{item.status || 'revisar'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default function Expenses() {
  const { id } = useParams();
  const [competence, setCompetence] = useState(() => new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [personalRows, setPersonalRows] = useState([]);
  const [expenseRows, setExpenseRows] = useState([]);
  const [selectedCard, setSelectedCard] = useState('');
  const filterBySelectedMonth = useCallback(
    (rows) => filterExpensesByCompetence(rows, competence),
    [competence],
  );
  const cardInvoices = useMemo(() => buildCardInvoices({ personal: personalRows, month: competence }), [personalRows, competence]);
  const cardSummary = useMemo(() => buildCardInvoiceSummary(cardInvoices), [cardInvoices]);
  const paymentMethodSummary = useMemo(
    () => groupExpensesByPaymentMethod(filterExpensesByCompetence(expenseRows, competence)),
    [expenseRows, competence],
  );

  const loadCardTransactions = useCallback(async () => {
    const rows = await repository.list('PersonalIncome');
    setPersonalRows(rows);
  }, []);

  useEffect(() => {
    loadCardTransactions();
  }, [loadCardTransactions]);

  useEntitySync(['PersonalIncome'], loadCardTransactions);

  useEffect(() => {
    if (!cardInvoices.length) {
      setSelectedCard('');
      return;
    }

    if (!cardInvoices.some((invoice) => invoice.cardName === selectedCard)) {
      setSelectedCard(cardInvoices[0].cardName);
    }
  }, [cardInvoices, selectedCard]);

  const handleGenerate = async () => {
    setGenerating(true);
    setMessage('');

    try {
      const result = await recurringExpenseService.generateForCompetence(competence);
      setMessage(result.created > 0
        ? `${result.created} despesa(s) recorrente(s) lançada(s) para ${competence}.`
        : `Nenhuma despesa nova: as recorrentes de ${competence} já estão lançadas (ou nenhuma despesa está marcada como recorrente).`);
      setReloadKey((key) => key + 1);
    } catch {
      setMessage('Não foi possível gerar as despesas. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <MonthChips value={competence} onChange={setCompetence} />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !competence}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {generating ? 'Gerando...' : `Gerar despesas de ${competence}`}
        </button>
      </div>

      {message ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</div>
      ) : null}

      <CardInvoicesPanel
        invoices={cardInvoices}
        summary={cardSummary}
        selectedCard={selectedCard}
        onSelectCard={setSelectedCard}
        paymentMethodSummary={paymentMethodSummary}
      />

      <EntityPage
        key={reloadKey}
        title="Despesas diretas"
        subtitle="Boletos, Pix e contas lançadas diretamente. Faturas de cartão aparecem acima para não contar duas vezes."
        entity="Expense"
        fields={fields}
        cardFields={['date', 'description']}
        columns={columns}
        badgeColors={STATUS_BADGE_COLORS}
        relations={[{ key: 'Kitnet', entity: 'Kitnet' }]}
        selectedId={id}
        deepLinkEntity={NOTIFICATION_ENTITY.EXPENSE}
        deepLinkBasePath="/despesas"
        getDeepLinkLabel={(item) => item.description || item.category || item.id}
        checkDuplicate={findExpenseDuplicateOf}
        filterRows={filterBySelectedMonth}
        onRowsChange={setExpenseRows}
      />
    </div>
  );
}
