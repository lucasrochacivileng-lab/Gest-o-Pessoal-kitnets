import { isPersonalExpense } from './personalMovementClassifier.js';
import { resolveExpenseSegment } from './segmentConsolidationService.js';
// Rótulos vêm do catálogo único de categorias — este serviço segue dono só da
// NORMALIZAÇÃO (slug + aliases) que concilia os vocabulários legados.
import { CATEGORY_LABELS } from './categoryCatalog.js';

const toMoney = (value) => Number(value || 0);
const monthOf = (date) => String(date || '').slice(0, 7);

export const categoryLabel = (key) => CATEGORY_LABELS[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Sem categoria');

const CATEGORY_ALIASES = {
  agua_pessoal: 'agua',
  energia_pessoal: 'energia',
  luz: 'energia',
  internet_pessoal: 'internet',
  aluguel_pessoal: 'moradia',
  combustivel_para_carro: 'combustivel',
  material_de_construcao: 'material',
  investimento_kitnets: 'obra',
  outros: 'outro',
  tarifas_bancarias: 'tarifas_bancarias',
};

const slugCategory = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

export const normalizeCategory = (row) => {
  const raw = slugCategory(row.category);
  return CATEGORY_ALIASES[raw] || raw || 'sem_categoria';
};

// Só o que efetivamente saiu do caixa conta como gasto realizado — mesma
// regra de "pago" do cashflowService. Uma despesa recorrente ainda
// PENDENTE (gerada pro mês mas não paga) não pode contar aqui só por ser
// recorrente: isso inflava "Gastos por categoria" acima do que a "Caixa
// geral do mês" mostrava para os MESMOS lançamentos.
const isRealizedExpense = (row) => ['pago', 'recebido'].includes(String(row.status || '').toLowerCase()) && toMoney(row.value) > 0;
const isIncludedCardExpense = (row) => row.type === 'card_transaction' && row.status !== 'ignorar' && toMoney(row.value) > 0;
const isIncludedPersonalExpense = (row) => isPersonalExpense(row) && (isIncludedCardExpense(row) || isRealizedExpense(row));

const excludedReason = (row) => {
  if (toMoney(row.value) <= 0) return 'Valor não informado';
  if (row.type === 'transfer') return 'Transferência / ajuste de saldo';
  if (row.status === 'revisar') return 'Aguardando revisão';
  if (!isRealizedExpense(row)) return `Status: ${row.status || 'não informado'}`;
  return '';
};

// Cruza despesas das kitnets + finanças pessoais (exceto transações de cartão
// ainda em revisão) e soma por categoria dentro do mês escolhido.
export const buildCategoryReport = ({ expenses = [], personal = [], month }) => {
  const totals = new Map();
  const excluded = [];
  const add = (category, value, origin) => {
    const key = normalizeCategory({ category });
    const current = totals.get(key) || { category: key, label: categoryLabel(key), total: 0, count: 0, origins: new Set() };
    current.total += toMoney(value);
    current.count += 1;
    current.origins.add(origin);
    totals.set(key, current);
  };

  expenses
    .filter((row) => monthOf(row.date) === month && isRealizedExpense(row))
    .forEach((row) => add(row.category, row.value, resolveExpenseSegment(row, 'kitnets')));

  personal
    .filter((row) => monthOf(row.date) === month && isIncludedPersonalExpense(row))
    .forEach((row) => add(row.category, row.value, row.type === 'card_transaction' ? 'cartão' : 'pessoal'));

  [...expenses, ...personal]
    .filter((row) => monthOf(row.date) === month)
    .filter((row) => row.type === 'transfer'
      || (expenses.includes(row) && !isRealizedExpense(row))
      || (isPersonalExpense(row) && !isIncludedPersonalExpense(row)))
    .forEach((row) => excluded.push({
      id: row.id,
      date: row.date,
      description: row.description || row.category || 'Lançamento',
      value: toMoney(row.value),
      reason: excludedReason(row),
    }));

  const rows = [...totals.values()]
    .map((row) => ({ ...row, origins: [...row.origins] }))
    .sort((a, b) => b.total - a.total);

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const includedCards = personal.filter((row) => monthOf(row.date) === month && isIncludedCardExpense(row));

  return {
    rows: rows.map((row) => ({ ...row, share: grandTotal ? row.total / grandTotal : 0 })),
    grandTotal,
    cardTotal: includedCards.reduce((sum, row) => sum + toMoney(row.value), 0),
    cardCount: includedCards.length,
    cardReviewCount: includedCards.filter((row) => row.status === 'revisar').length,
    excluded: excluded.sort((a, b) => String(b.date).localeCompare(String(a.date))),
  };
};

// Evolução de uma categoria (ou de tudo) nos últimos N meses — para o gráfico.
export const buildCategoryTrend = ({ expenses = [], personal = [], months = [], category = null }) => {
  const matches = (rowCategory) => !category || normalizeCategory({ category: rowCategory }) === category;

  return months.map((month) => {
    const kitnetTotal = expenses
      .filter((row) => monthOf(row.date) === month && isRealizedExpense(row) && matches(row.category))
      .reduce((sum, row) => sum + toMoney(row.value), 0);

    const personalTotal = personal
      .filter((row) => isIncludedPersonalExpense(row) && monthOf(row.date) === month)
      .filter((row) => matches(row.category))
      .reduce((sum, row) => sum + toMoney(row.value), 0);

    return { month, total: kitnetTotal + personalTotal };
  });
};

export default buildCategoryReport;
