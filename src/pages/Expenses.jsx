import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import AddExpenseModal from './expenses/AddExpenseModal.jsx';
import EntityPage from '../components/ui/EntityPage.jsx';
import { NOTIFICATION_ENTITY } from '../modules/notifications/types/notification.types.js';
import { recurringExpenseService } from '../services/recurringExpenseService.js';
import { findExpenseDuplicateOf } from '../services/duplicateCheckService.js';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import { repository } from '../repository/index.js';
import { useEntitySync } from '../hooks/useEntitySync.js';
import { buildCardInvoices, buildCardInvoiceSummary, findSiblingTransactions, selectInvoiceItems } from '../services/cardInvoiceService.js';
import { resolveExpenseSegment } from '../services/segmentConsolidationService.js';
import { categoryLabel } from '../services/categoryReportService.js';
import { CLASSIFICATION_OPTIONS } from '../services/classificationRuleService.js';
import { EXPENSE_CATEGORY_OPTIONS } from '../services/categoryCatalog.js';
import { financialService } from '../services/financialService';
import { formatDateBR } from '../services/dateUtils.js';

// Segmento (centro de resultado) da despesa — é o que o Consolidado usa para
// separar o custo por frente. Mesmas chaves do segmentConsolidationService.
const SEGMENT_OPTIONS = [
  { value: 'kitnets', label: 'Kitnets' },
  { value: 'pericias', label: 'Perícias' },
  { value: 'projetos', label: 'Projetos' },
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'trabalho', label: 'Trabalho / Servidor' },
];

const SEGMENT_LABELS = Object.fromEntries(SEGMENT_OPTIONS.map((s) => [s.value, s.label]));
// Despesa antiga (sem segmento) é, por definição do consolidado, custo das
// kitnets — então a coluna mostra "Kitnets" em vez de um traço.
const segmentLabel = (value) => SEGMENT_LABELS[value] || 'Kitnets';

const fields = [
  { name: 'date', label: 'Data', type: 'date', default: 'today' },
  { name: 'segment', label: 'Segmento', type: 'select', options: SEGMENT_OPTIONS },
  // Vínculo do custo — condicional ao segmento. Kitnets aceita "Geral"
  // (rateado entre as unidades); Perícias/Projetos apontam para o item; o
  // vínculo é opcional (dá para lançar um custo genérico do segmento).
  { name: 'kitnet_id', label: 'Kitnet', type: 'select', optionsEntity: 'Kitnet', extraOptions: [
    { value: 'geral', label: 'Geral (rateado entre as unidades)' },
  ], visibleWhen: (form) => !form.segment || form.segment === 'kitnets' },
  { name: 'expert_report_id', label: 'Perícia', type: 'select', optionsEntity: 'ExpertReport',
    optionLabel: (o) => [o.client, o.process_number].filter(Boolean).join(' — ') || o.report_type || o.id,
    visibleWhen: (form) => form.segment === 'pericias' },
  { name: 'project_id', label: 'Projeto', type: 'select', optionsEntity: 'ComplementaryProject',
    optionLabel: (o) => [o.client, o.project_type].filter(Boolean).join(' — ') || o.address || o.id,
    visibleWhen: (form) => form.segment === 'projetos' },
  // Opções do catálogo único de categorias (categoryCatalog.js).
  { name: 'category', label: 'Tipo de gasto (tag)', type: 'select', options: EXPENSE_CATEGORY_OPTIONS },
  { name: 'type', label: 'Tipo', type: 'select', options: [
    { value: 'fixa', label: 'Fixa' },
    { value: 'variavel', label: 'Variável' },
  ] },
  { name: 'description', label: 'Descrição', type: 'textarea', placeholder: 'Descrição da despesa' },
  { name: 'value', label: 'Valor', type: 'number', placeholder: '1200' },
  // Seletor (não texto livre): é ele que decide o card Boleto/Pix/Outros.
  // Como texto livre, um campo vazio ou "boleto bancário" fazia a despesa
  // cair em "Outros" sem o usuário perceber.
  { name: 'payment_method', label: 'Forma de pagamento', type: 'select', options: [
    { value: 'boleto', label: 'Boleto' },
    { value: 'pix', label: 'Pix' },
    { value: 'dinheiro', label: 'Dinheiro' },
    { value: 'transferencia', label: 'Transferência' },
    { value: 'cartao', label: 'Cartão' },
    { value: 'outros', label: 'Outros' },
  ] },
  { name: 'bank_account_id', label: 'Conta de pagamento', type: 'relation', entity: 'BankAccount' },
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
  { field: 'segment', label: 'Segmento', formatValue: segmentLabel },
  { field: 'kitnet_id', label: 'Kitnet', format: 'relation', relation: 'Kitnet' },
  { field: 'category', label: 'Tag', formatValue: categoryLabel },
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

// As opções de classificação (categoria) do seletor inline vêm do
// classificationRuleService — FONTE ÚNICA compartilhada com a tela de
// "Regras de classificação", para as duas telas nunca divergirem.

const PAYMENT_METHOD_LABELS = {
  boleto: 'Boleto',
  pix: 'Pix',
  outros: 'Outros',
};

export const filterExpensesByCompetence = (rows = [], competence = '') => (
  rows.filter((row) => String(row.date || '').startsWith(competence))
);

// Água, luz, internet e mútua costumam ir de boleto; esquadria/móveis, de
// Pix — o campo "forma de pagamento" é texto livre, então a comparação é
// por trecho (case-insensitive) para aceitar "Boleto", "boleto bancário" etc.
export const normalizePaymentMethod = (value = '') => {
  const text = String(value || '').toLowerCase();
  if (text.includes('boleto')) return 'boleto';
  if (text.includes('pix')) return 'pix';
  return 'outros';
};

export const groupExpensesByPaymentMethod = (rows = []) => (
  rows.reduce((acc, row) => {
    const key = normalizePaymentMethod(row.payment_method);
    acc[key] += Number(row.value ?? 0);
    return acc;
  }, { boleto: 0, pix: 0, outros: 0 })
);

// Totais por categoria (para os chips de filtro estilo "tag"): só as
// categorias que aparecem no mês, ordenadas do maior gasto para o menor.
export const groupExpensesByCategory = (rows = []) => {
  const totals = rows.reduce((acc, row) => {
    const key = row.category || 'outro';
    if (!acc[key]) acc[key] = { category: key, total: 0, count: 0 };
    acc[key].total += Number(row.value ?? 0);
    acc[key].count += 1;
    return acc;
  }, {});

  return Object.values(totals).sort((a, b) => b.total - a.total);
};

// Totais por segmento, para os chips de filtro por segmento (mesma ideia dos de
// categoria). Despesa antiga sem segmento conta como Kitnets (resolveExpenseSegment).
export const groupExpensesBySegment = (rows = []) => {
  const totals = rows.reduce((acc, row) => {
    const key = resolveExpenseSegment(row, 'kitnets');
    if (!acc[key]) acc[key] = { segment: key, total: 0, count: 0 };
    acc[key].total += Number(row.value ?? 0);
    acc[key].count += 1;
    return acc;
  }, {});

  return Object.values(totals).sort((a, b) => b.total - a.total);
};

// Card de resumo. Sem onClick é só um bloco informativo; com onClick vira
// botão que recorta a tabela de detalhe pela mesma dimensão que ele soma
// (os quatro do topo são clicáveis — antes só Boleto/Pix/Outros eram).
function SummaryCard({ label, value, sub, active, onClick }) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{financialService.formatCurrency(value)}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </>
  );

  if (!onClick) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left shadow-sm transition ${
        active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      {body}
    </button>
  );
}

// Igual ao SummaryCard, mas clicável: filtra "Despesas diretas" abaixo pela
// forma de pagamento (clicar de novo no já ativo limpa o filtro).
function PaymentMethodCard({ label, value, sub, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left shadow-sm transition ${
        active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{financialService.formatCurrency(value)}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </button>
  );
}

function CardInvoicesPanel({
  invoices, summary, selectedCard, onSelectCard, selectedInvoiceView, onSelectInvoiceView,
  paymentMethodSummary, selectedPaymentMethod, onSelectPaymentMethod, onReclassify, savingItemId,
}) {
  const selectedInvoice = invoices.find((invoice) => invoice.cardName === selectedCard) || invoices[0] || null;
  // Uma única seleção "manda" na tabela de detalhe por vez: cartão, recorte
  // de resumo (view) OU forma de pagamento. Quando uma forma de pagamento
  // está ativa, o detalhe some — quem manda é a lista "Despesas diretas"
  // abaixo, já filtrada; assim não fica a fatura de cartão no lugar do boleto.
  const detailItems = selectInvoiceItems({ invoices, selectedInvoice, view: selectedInvoiceView });
  const showInvoiceDetail = !selectedPaymentMethod && detailItems.length > 0;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Faturas do mês"
          value={summary.invoiceTotal}
          sub={`${invoices.length} cartão(ões)`}
          active={!selectedInvoiceView && !selectedPaymentMethod}
          onClick={() => onSelectInvoiceView('')}
        />
        <SummaryCard
          label="Cartão pessoal"
          value={summary.personalTotal}
          sub="origem pessoal"
          active={selectedInvoiceView === 'pessoal'}
          onClick={() => onSelectInvoiceView(selectedInvoiceView === 'pessoal' ? '' : 'pessoal')}
        />
        <SummaryCard
          label="Cartão nas kitnets"
          value={summary.kitnetsTotal}
          sub="inclui obra/investimento"
          active={selectedInvoiceView === 'kitnets'}
          onClick={() => onSelectInvoiceView(selectedInvoiceView === 'kitnets' ? '' : 'kitnets')}
        />
        <SummaryCard
          label="Investimento/financiamento"
          value={summary.investmentTotal}
          sub={`${summary.reviewCount} item(ns) a revisar`}
          active={selectedInvoiceView === 'investimento'}
          onClick={() => onSelectInvoiceView(selectedInvoiceView === 'investimento' ? '' : 'investimento')}
        />
      </div>

      {!invoices.length ? (
        <p className="ds-card text-sm text-slate-500">Nenhuma fatura de cartão encontrada para este mês.</p>
      ) : null}

      {/* Boleto/Pix das despesas diretas ficam no mesmo grid das faturas de
          cartão, ocupando o espaço vazio ao lado em vez de um bloco à parte. */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {invoices.map((invoice) => {
          // Só destaca um cartão quando é o cartão que manda no detalhe — não
          // quando um recorte de resumo ou forma de pagamento está ativo.
          const active = !selectedInvoiceView && !selectedPaymentMethod && invoice.cardName === selectedInvoice?.cardName;
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
        <PaymentMethodCard
          label="Boleto"
          value={paymentMethodSummary.boleto}
          sub="forma de pagamento = Boleto"
          active={selectedPaymentMethod === 'boleto'}
          onClick={() => onSelectPaymentMethod(selectedPaymentMethod === 'boleto' ? '' : 'boleto')}
        />
        <PaymentMethodCard
          label="Pix"
          value={paymentMethodSummary.pix}
          sub="forma de pagamento = Pix"
          active={selectedPaymentMethod === 'pix'}
          onClick={() => onSelectPaymentMethod(selectedPaymentMethod === 'pix' ? '' : 'pix')}
        />
        <PaymentMethodCard
          label="Outros"
          value={paymentMethodSummary.outros}
          sub="sem Boleto/Pix na forma de pagamento"
          active={selectedPaymentMethod === 'outros'}
          onClick={() => onSelectPaymentMethod(selectedPaymentMethod === 'outros' ? '' : 'outros')}
        />
      </div>

      {showInvoiceDetail ? (
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
              {detailItems.map((item) => (
                <tr key={item.id || item.origin_hash} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">{formatDateBR(item.date)}</td>
                  <td className="px-4 py-3 text-slate-900">{item.description || item.category || 'Compra no cartão'}</td>
                  <td className="px-4 py-3 text-slate-600">{ORIGIN_LABELS[item.origin] || item.origin}</td>
                  <td className="px-4 py-3">
                    {/* Classificação editável: trocar a categoria grava no
                        lançamento e o Tipo (Custeio/Investimento) se recalcula. */}
                    <select
                      value={CLASSIFICATION_OPTIONS.some((o) => o.value === item.category) ? item.category : 'outros'}
                      disabled={!item.id || savingItemId === item.id}
                      onChange={(event) => onReclassify?.(item, event.target.value)}
                      aria-label={`Classificação de ${item.description || 'lançamento'}`}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    >
                      {CLASSIFICATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
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

// Filtro por categoria estilo "tag" (inspirado no filtro por tags do Nubank):
// cada categoria presente no mês vira um chip clicável com o total; clicar
// filtra a lista "Despesas diretas", clicar de novo no ativo limpa.
function CategoryFilter({ categories, selected, onSelect }) {
  if (!categories.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Filtrar por categoria</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {categories.map(({ category, total }) => {
          const active = selected === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelect(active ? '' : category)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="font-medium">{categoryLabel(category)}</span>
              <span className="text-xs text-slate-500">{financialService.formatCurrency(total)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Mesmo padrão do CategoryFilter, mas por SEGMENTO (kitnets/perícias/projetos/
// pessoal/trabalho). Clicar filtra a lista "Despesas diretas"; clicar de novo
// no ativo limpa.
function SegmentFilter({ segments, selected, onSelect }) {
  if (!segments.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Filtrar por segmento</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {segments.map(({ segment, total }) => {
          const active = selected === segment;
          return (
            <button
              key={segment}
              type="button"
              onClick={() => onSelect(active ? '' : segment)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="font-medium">{segmentLabel(segment)}</span>
              <span className="text-xs text-slate-500">{financialService.formatCurrency(total)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Expenses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { id } = useParams();
  const [competence, setCompetence] = useState(() => new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [personalRows, setPersonalRows] = useState([]);
  const [expenseRows, setExpenseRows] = useState([]);
  const [selectedCard, setSelectedCard] = useState('');
  const [selectedInvoiceView, setSelectedInvoiceView] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('');

  useEffect(() => {
    if (searchParams.get('novo') !== '1') return;
    setShowAdd(true);
    const next = new URLSearchParams(searchParams);
    next.delete('novo');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  // Cartão, recorte de resumo (view) e forma de pagamento disputam a mesma
  // tabela de detalhe — escolher um zera os outros, para o destaque e o que
  // aparece na tela nunca contarem histórias diferentes.
  const handleSelectCard = useCallback((cardName) => {
    setSelectedCard(cardName);
    setSelectedInvoiceView('');
    setSelectedPaymentMethod('');
  }, []);
  const handleSelectInvoiceView = useCallback((view) => {
    setSelectedInvoiceView(view);
    setSelectedPaymentMethod('');
  }, []);
  const handleSelectPaymentMethod = useCallback((method) => {
    setSelectedPaymentMethod(method);
    if (method) setSelectedInvoiceView('');
  }, []);
  const filterBySelectedMonth = useCallback(
    (rows) => {
      let monthRows = filterExpensesByCompetence(rows, competence);
      if (selectedPaymentMethod) {
        monthRows = monthRows.filter((row) => normalizePaymentMethod(row.payment_method) === selectedPaymentMethod);
      }
      if (selectedCategory) {
        monthRows = monthRows.filter((row) => (row.category || 'outro') === selectedCategory);
      }
      if (selectedSegment) {
        monthRows = monthRows.filter((row) => resolveExpenseSegment(row, 'kitnets') === selectedSegment);
      }
      return monthRows;
    },
    [competence, selectedPaymentMethod, selectedCategory, selectedSegment],
  );
  const cardInvoices = useMemo(() => buildCardInvoices({ personal: personalRows, month: competence }), [personalRows, competence]);
  const cardSummary = useMemo(() => buildCardInvoiceSummary(cardInvoices), [cardInvoices]);
  const paymentMethodSummary = useMemo(
    () => groupExpensesByPaymentMethod(filterExpensesByCompetence(expenseRows, competence)),
    [expenseRows, competence],
  );
  const categorySummary = useMemo(
    () => groupExpensesByCategory(filterExpensesByCompetence(expenseRows, competence)),
    [expenseRows, competence],
  );
  const segmentSummary = useMemo(
    () => groupExpensesBySegment(filterExpensesByCompetence(expenseRows, competence)),
    [expenseRows, competence],
  );

  const [savingItemId, setSavingItemId] = useState('');

  const loadCardTransactions = useCallback(async () => {
    const rows = await repository.list('PersonalIncome');
    setPersonalRows(rows);
  }, []);

  // Reclassifica um item da fatura: grava a nova categoria no lançamento
  // (PersonalIncome). O Tipo (Custeio/Investimento/Financiamento) e os totais
  // por origem são derivados da categoria, então se ajustam ao recarregar.
  // Se a compra é parcelada, oferece propagar a correção às parcelas IRMÃS
  // (mesma compra, meses passados e futuros) — corrigir a 4/5 e deixar a 5/5
  // errada seria retrabalho garantido na próxima fatura.
  const handleReclassify = useCallback(async (item, category) => {
    if (!item?.id || category === item.category) return;

    const siblings = findSiblingTransactions(personalRows, item)
      .filter((row) => row.category !== category);
    const propagate = siblings.length > 0 && window.confirm(
      `Esta compra tem mais ${siblings.length} parcela(s) (${item.description || 'sem descrição'}). `
      + 'Aplicar a mesma classificação a todas?',
    );
    const targets = propagate ? [item, ...siblings] : [item];
    const targetIds = new Set(targets.map((row) => row.id));

    setSavingItemId(item.id);
    // Atualização otimista: reflete a troca na tabela antes do round-trip.
    setPersonalRows((rows) => rows.map((row) => (targetIds.has(row.id) ? { ...row, category } : row)));
    try {
      for (const target of targets) {
        // Sequencial: são poucas parcelas e, se uma gravação falhar, as
        // anteriores já ficaram salvas (o reload abaixo ressincroniza a tela).
        // eslint-disable-next-line no-await-in-loop
        await repository.update('PersonalIncome', target.id, { category });
      }
      await loadCardTransactions();
    } catch {
      setMessage('Não foi possível salvar a classificação. Tente novamente.');
      await loadCardTransactions();
    } finally {
      setSavingItemId('');
    }
  }, [loadCardTransactions, personalRows]);

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

  // Trocou de mês e a categoria filtrada não existe mais nele: limpa, para não
  // deixar a lista presa num filtro que resultaria sempre vazio.
  useEffect(() => {
    if (selectedCategory && !categorySummary.some((item) => item.category === selectedCategory)) {
      setSelectedCategory('');
    }
  }, [categorySummary, selectedCategory]);

  useEffect(() => {
    if (selectedSegment && !segmentSummary.some((item) => item.segment === selectedSegment)) {
      setSelectedSegment('');
    }
  }, [segmentSummary, selectedSegment]);

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

  const activeFilters = [
    selectedPaymentMethod ? PAYMENT_METHOD_LABELS[selectedPaymentMethod] : null,
    selectedCategory ? categoryLabel(selectedCategory) : null,
    selectedSegment ? segmentLabel(selectedSegment) : null,
  ].filter(Boolean);

  const topContent = (
    <div className="space-y-4">
      <MonthChips value={competence} onChange={setCompetence} />
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !competence}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {generating ? 'Gerando...' : `Gerar despesas de ${competence}`}
        </button>
      </div>

      {showAdd ? (
        <AddExpenseModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); setReloadKey((key) => key + 1); loadCardTransactions(); }}
        />
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</div>
      ) : null}

      <CardInvoicesPanel
        invoices={cardInvoices}
        summary={cardSummary}
        selectedCard={selectedCard}
        onSelectCard={handleSelectCard}
        selectedInvoiceView={selectedInvoiceView}
        onSelectInvoiceView={handleSelectInvoiceView}
        paymentMethodSummary={paymentMethodSummary}
        selectedPaymentMethod={selectedPaymentMethod}
        onSelectPaymentMethod={handleSelectPaymentMethod}
        onReclassify={handleReclassify}
        savingItemId={savingItemId}
      />

      <SegmentFilter segments={segmentSummary} selected={selectedSegment} onSelect={setSelectedSegment} />

      <CategoryFilter categories={categorySummary} selected={selectedCategory} onSelect={setSelectedCategory} />
    </div>
  );

  return (
    <EntityPage
      key={reloadKey}
      title="Despesas diretas"
        subtitle={activeFilters.length
          ? `Filtrado por ${activeFilters.join(' · ')} — clique de novo no filtro ativo para limpar.`
          : 'Boletos, Pix e contas lançadas diretamente. Faturas de cartão aparecem acima para não contar duas vezes.'}
        entity="Expense"
        fields={fields}
        cardFields={['date', 'description']}
        columns={columns}
        badgeColors={STATUS_BADGE_COLORS}
        selectedId={id}
        deepLinkEntity={NOTIFICATION_ENTITY.EXPENSE}
        deepLinkBasePath="/despesas"
        getDeepLinkLabel={(item) => item.description || item.category || item.id}
        checkDuplicate={findExpenseDuplicateOf}
        filterRows={filterBySelectedMonth}
        onRowsChange={setExpenseRows}
        relations={[
          { key: 'BankAccount', entity: 'BankAccount' },
          { key: 'Kitnet', entity: 'Kitnet' },
          { key: 'ExpertReport', entity: 'ExpertReport' },
          { key: 'ComplementaryProject', entity: 'ComplementaryProject' },
        ]}
        topContent={topContent}
        hideCreate
      />
  );
}
