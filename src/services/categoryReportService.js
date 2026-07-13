import { isPersonalExpense } from './personalMovementClassifier.js';
import { resolveExpenseSegment } from './segmentConsolidationService.js';

const toMoney = (value) => Number(value || 0);
const monthOf = (date) => String(date || '').slice(0, 7);

const CATEGORY_LABELS = {
  agua: 'Água',
  luz: 'Luz',
  energia_solar: 'Energia solar',
  moveis: 'Móveis/eletro',
  internet: 'Internet',
  iptu: 'IPTU',
  seguro: 'Seguro',
  limpeza: 'Limpeza',
  material: 'Material de obra',
  manutencao: 'Manutenção',
  obra: 'Obra',
  alimentacao: 'Alimentação',
  combustivel: 'Combustível',
  pessoal: 'Pessoal',
  moradia: 'Moradia / aluguel',
  energia: 'Energia',
  gas: 'Gás',
  mercado: 'Mercado',
  farmacia: 'Farmácia',
  assinatura: 'Assinaturas',
  transporte: 'Transporte',
  telefone: 'Telefone',
  lazer: 'Lazer',
  familia: 'Família',
  tarifas_bancarias: 'Tarifas bancárias',
  outro: 'Outros',
  sem_categoria: 'Sem categoria',
};

export const categoryLabel = (key) => CATEGORY_LABELS[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Sem categoria');

const CATEGORY_ALIASES = {
  agua_pessoal: 'agua',
  energia_pessoal: 'energia',
  luz: 'energia',
  internet_pessoal: 'internet',
  aluguel_pessoal: 'moradia',
  combustivel_para_carro: 'combustivel',
  material_de_construcao: 'material',
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
    .filter((row) => isPersonalExpense(row) && monthOf(row.date) === month && isRealizedExpense(row))
    .forEach((row) => add(row.category, row.value, 'pessoal'));

  [...expenses, ...personal]
    .filter((row) => monthOf(row.date) === month)
    .filter((row) => row.type === 'transfer' || ((isPersonalExpense(row) || expenses.includes(row)) && !isRealizedExpense(row)))
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

  return {
    rows: rows.map((row) => ({ ...row, share: grandTotal ? row.total / grandTotal : 0 })),
    grandTotal,
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
      .filter((row) => isPersonalExpense(row) && isRealizedExpense(row) && monthOf(row.date) === month)
      .filter((row) => matches(row.category))
      .reduce((sum, row) => sum + toMoney(row.value), 0);

    return { month, total: kitnetTotal + personalTotal };
  });
};

export default buildCategoryReport;
