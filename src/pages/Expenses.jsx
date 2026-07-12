import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import EntityPage from '../components/ui/EntityPage.jsx';
import { NOTIFICATION_ENTITY } from '../modules/notifications/types/notification.types.js';
import { recurringExpenseService } from '../services/recurringExpenseService.js';
import { findExpenseDuplicateOf } from '../services/duplicateCheckService.js';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import { repository } from '../repository/index.js';
import { useEntitySync } from '../hooks/useEntitySync.js';
import { buildCardInvoices, buildCardInvoiceSummary, selectInvoiceItems } from '../services/cardInvoiceService.js';
import { categoryLabel } from '../services/categoryReportService.js';
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
  { name: 'date', label: 'Data', type: 'date' },
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
  { name: 'category', label: 'Tipo de gasto (tag)', type: 'select', options: [
    { value: 'manutencao', label: 'Manutenção' },
    { value: 'agua', label: 'Água' },
    { value: 'luz', label: 'Luz / Energia' },
    { value: 'energia_solar', label: 'Energia solar (parcela)' },
    { value: 'moveis', label: 'Móveis/eletrodomésticos (parcela)' },
    { value: 'internet', label: 'Internet' },
    { value: 'iptu', label: 'IPTU' },
    { value: 'seguro', label: 'Seguro' },
    { value: 'limpeza', label: 'Limpeza' },
    { value: 'material', label: 'Material' },
    { value: 'outro', label: 'Outro' },
  ] },
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
  paymentMethodSummary, selectedPaymentMethod, onSelectPaymentMethod,
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

export default function Expenses() {
  const { id } = useParams();
  const [competence, setCompetence] = useState(() => new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [personalRows, setPersonalRows] = useState([]);
  const [expenseRows, setExpenseRows] = useState([]);
  const [selectedCard, setSelectedCard] = useState('');
  const [selectedInvoiceView, setSelectedInvoiceView] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
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
      return monthRows;
    },
    [competence, selectedPaymentMethod, selectedCategory],
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

  // Trocou de mês e a categoria filtrada não existe mais nele: limpa, para não
  // deixar a lista presa num filtro que resultaria sempre vazio.
  useEffect(() => {
    if (selectedCategory && !categorySummary.some((item) => item.category === selectedCategory)) {
      setSelectedCategory('');
    }
  }, [categorySummary, selectedCategory]);

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
  ].filter(Boolean);

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
        onSelectCard={handleSelectCard}
        selectedInvoiceView={selectedInvoiceView}
        onSelectInvoiceView={handleSelectInvoiceView}
        paymentMethodSummary={paymentMethodSummary}
        selectedPaymentMethod={selectedPaymentMethod}
        onSelectPaymentMethod={handleSelectPaymentMethod}
      />

      <CategoryFilter categories={categorySummary} selected={selectedCategory} onSelect={setSelectedCategory} />

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
          { key: 'Kitnet', entity: 'Kitnet' },
          { key: 'ExpertReport', entity: 'ExpertReport' },
          { key: 'ComplementaryProject', entity: 'ComplementaryProject' },
        ]}
      />
    </div>
  );
}
