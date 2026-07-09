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
  outro: 'Outros',
  sem_categoria: 'Sem categoria',
};

export const categoryLabel = (key) => CATEGORY_LABELS[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Sem categoria');

const normalizeCategory = (row) => {
  const raw = String(row.category || '').trim().toLowerCase();
  return raw || 'sem_categoria';
};

// Só o que efetivamente saiu do caixa conta como gasto realizado.
const isRealizedExpense = (row) =>
  ['pago', 'recebido'].includes(row.status) || row.recurring === true;

// Cruza despesas das kitnets + finanças pessoais (exceto transações de cartão
// ainda em revisão) e soma por categoria dentro do mês escolhido.
export const buildCategoryReport = ({ expenses = [], personal = [], month }) => {
  const totals = new Map();
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
    .forEach((row) => add(row.category, row.value, 'kitnets'));

  personal
    .filter((row) => row.type !== 'income' && row.status !== 'ignorar' && monthOf(row.date) === month)
    .filter((row) => row.type !== 'card_transaction' || row.status !== 'revisar')
    .forEach((row) => add(row.category, row.value, 'pessoal'));

  const rows = [...totals.values()]
    .map((row) => ({ ...row, origins: [...row.origins] }))
    .sort((a, b) => b.total - a.total);

  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return {
    rows: rows.map((row) => ({ ...row, share: grandTotal ? row.total / grandTotal : 0 })),
    grandTotal,
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
      .filter((row) => row.type !== 'income' && row.status !== 'ignorar' && monthOf(row.date) === month)
      .filter((row) => row.type !== 'card_transaction' || row.status !== 'revisar')
      .filter((row) => matches(row.category))
      .reduce((sum, row) => sum + toMoney(row.value), 0);

    return { month, total: kitnetTotal + personalTotal };
  });
};

export default buildCategoryReport;
