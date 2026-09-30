import { buildFinancialLedger, selectLedger, ledgerTotals, monthKeys, compareValues } from './financialLedger.js';
import { SEGMENTS, resolveExpenseSegment, movementDate } from './financialClassification.js';
import { normalizeCategory, categoryLabel } from './categoryReportService.js';
import { addMoney, fromCents, sumMoney, toCents } from './money.js';
import { todayLocalISO } from './dateUtils.js';

export const SPENDING_FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'pix', label: 'Pix' },
  { key: 'boleto', label: 'Boleto pago' },
  { key: 'cartao', label: 'Cartão' },
  { key: 'pix_cartao', label: 'Pix + Cartão' },
];

export function buildSpendingBreakdown(items, filter = 'todos') {
  const selected = items.filter((item) => item.kind === 'saida' && (
    filter === 'todos'
    || item.paymentMethod === filter
    || (filter === 'pix_cartao' && ['pix', 'cartao'].includes(item.paymentMethod))
  ));
  const categories = new Map();
  for (const item of selected) {
    const key = normalizeCategory(item);
    const row = categories.get(key) || { key, name: categoryLabel(key), value: 0 };
    row.value = addMoney(row.value, item.value);
    categories.set(key, row);
  }
  const reviewing = selected.filter((item) => item.inReview);
  return {
    items: selected,
    total: sumMoney(selected.map((item) => item.value)),
    reviewCount: reviewing.length,
    reviewTotal: sumMoney(reviewing.map((item) => item.value)),
    categories: [...categories.values()].sort((a, b) => b.value - a.value),
  };
}

export function buildMonthlyAnalysis(data, { month, segment = '', today = todayLocalISO() }) {
  const ledger = buildFinancialLedger(data);
  const items = selectLedger(ledger, { month, segment });
  const previousMonth = monthKeys(month, 2)[0];
  const partial = month === today.slice(0, 7);
  const cutoff = Number(today.slice(8, 10));
  const comparable = (rows) => partial ? rows.filter((r) => Number(r.date.slice(8, 10)) <= cutoff) : rows;
  const current = ledgerTotals(comparable(items));
  const previous = ledgerTotals(comparable(selectLedger(ledger, { month: previousMonth, segment })));
  const totals = ledgerTotals(items);
  // A visualização de gastos também mostra compras importadas em revisão,
  // identificadas como prévia. Elas continuam fora dos totais confirmados.
  const reviewingCards = (data.personal || [])
    .filter((row) => row.active !== false && row.type === 'card_transaction' && ['revisar', 'sugerido'].includes(row.status))
    .filter((row) => movementDate(row).startsWith(month) && (!segment || resolveExpenseSegment(row) === segment))
    .filter((row) => Number.isFinite(Number(row.value)) && Number(row.value) > 0)
    .map((row) => ({
      id: `PersonalIncome:${row.id}`,
      sourceId: row.id,
      entity: 'PersonalIncome',
      kind: 'saida',
      segment: resolveExpenseSegment(row),
      value: fromCents(toCents(row.value)),
      date: movementDate(row),
      source: 'Cartão · em revisão',
      description: row.description || 'Compra no cartão',
      category: row.category || 'sem_categoria',
      href: '/financas-pessoais',
      card: true,
      paymentMethod: 'cartao',
      inReview: true,
    }));
  const spendingItems = [...items.filter((row) => row.kind === 'saida'), ...reviewingCards];
  const categories = new Map();
  for (const item of items.filter((r) => r.kind === 'saida')) {
    const key = normalizeCategory(item); const row = categories.get(key) || { key, name: categoryLabel(key), value: 0 };
    row.value = addMoney(row.value, item.value); categories.set(key, row);
  }
  const segments = SEGMENTS.map((s) => ({ ...s, ...ledgerTotals(selectLedger(ledger, { month, segment: s.key })) }));
  const trend = monthKeys(month).map((key) => {
    const rows = selectLedger(ledger, { month: key, segment });
    const sources = Object.fromEntries(SEGMENTS.map((s) => [s.key, sumMoney(rows.filter((r) => r.segment === s.key && r.kind === 'entrada').map((r) => r.value))]));
    return { month: key, label: `${key.slice(5)}/${key.slice(0, 4)}`, ...ledgerTotals(rows), ...sources };
  });
  return { items, spendingItems, totals, segments, trend, categories: [...categories.values()].sort((a, b) => b.value - a.value),
    previousMonth, partial, comparison: Object.fromEntries(['income', 'expense', 'result'].map((key) => [key, compareValues(current[key], previous[key])])),
    reviewCount: (data.personal || []).filter((r) => r.active !== false && ['revisar', 'sugerido'].includes(r.status) && r.date?.startsWith(month)).length,
  };
}
