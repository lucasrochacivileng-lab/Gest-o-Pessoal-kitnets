// Verificador de duplicidades: nenhum ponto do app avisa se a mesma conta foi
// lançada duas vezes (ex.: a mesma fatura de internet cadastrada manualmente
// por duas pessoas, ou uma vez manual e outra pela geração automática de
// recorrentes com uma descrição levemente diferente). Este serviço cobre dois
// usos com o MESMO critério de comparação, para nunca divergir entre eles:
//
// - findAllDuplicates: varredura do histórico inteiro (tela de Extrato).
// - findExpenseDuplicateOf / findPersonalDuplicateOf: checagem de UM lançamento
//   novo contra o que já existe, chamada no instante de salvar (EntityPage).
//
// Critério (mesmo mês sempre exigido, para não cruzar contas de meses diferentes):
// 1. Mesmo valor + mesma kitnet/categoria (pega a mesma conta lançada duas
//    vezes com descrições diferentes).
// 2. Mesma descrição, mesma kitnet/categoria (pega quando o valor foi
//    digitado diferente nas duas vezes).
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const monthOf = (date) => String(date || '').slice(0, 7);
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const groupBy = (items, keyFn) => {
  const map = new Map();

  items.forEach((item) => {
    const key = keyFn(item);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });

  return map;
};

const sameItems = (a, b) => a.length === b.length && a.every((item) => b.includes(item));

// bucket = identificador do "grupo" onde duplicidade faz sentido comparar
// (kitnet_id para despesas, category para lançamentos pessoais).
const matchesSameValue = (row, candidate, bucket) => (
  monthOf(row.date) === monthOf(candidate.date)
  && Boolean(candidate.value)
  && round2(row.value) === round2(candidate.value)
  && (row[bucket] || '') === (candidate[bucket] || '')
);

const matchesSameDescription = (row, candidate, bucket) => {
  const text = normalizeText(candidate.description || candidate.category);
  return Boolean(text)
    && monthOf(row.date) === monthOf(candidate.date)
    && normalizeText(row.description || row.category) === text
    && (row[bucket] || '') === (candidate[bucket] || '');
};

const findGroups = (rows, bucket, reasonValue, reasonDescription) => {
  const groups = [];

  groupBy(rows, (row) => (row.value && row.date
    ? `${monthOf(row.date)}|${row[bucket] || `sem-${bucket}`}|${round2(row.value)}`
    : null))
    .forEach((items) => {
      if (items.length > 1) groups.push({ reason: reasonValue, items });
    });

  // O bucket entra na chave: "Internet SPNET" em duas kitnets/categorias
  // diferentes no mesmo mês são contas legítimas, não uma duplicidade.
  groupBy(rows, (row) => {
    const text = normalizeText(row.description || row.category);
    return text && row.date ? `${monthOf(row.date)}|${row[bucket] || `sem-${bucket}`}|${text}` : null;
  })
    .forEach((items) => {
      if (items.length > 1 && !groups.some((group) => sameItems(group.items, items))) {
        groups.push({ reason: reasonDescription, items });
      }
    });

  return groups;
};

/** Duplicidades entre despesas das kitnets (entidade Expense). */
export const findDuplicateExpenses = (expenses = []) => findGroups(
  expenses.filter((row) => row.active !== false),
  'kitnet_id',
  'Mesmo valor, mesma kitnet e mesmo mês',
  'Mesma descrição no mesmo mês',
);

/** Duplicidades entre lançamentos pessoais (entidade PersonalIncome, exceto receitas). */
export const findDuplicatePersonalEntries = (personal = []) => findGroups(
  personal.filter((row) => row.active !== false && row.type !== 'income'),
  'category',
  'Mesmo valor, mesma categoria e mesmo mês',
  'Mesma descrição no mesmo mês',
);

/** Varredura combinada, usada pela tela de Extrato. */
export const findAllDuplicates = ({ expenses = [], personal = [] }) => [
  ...findDuplicateExpenses(expenses).map((group) => ({ ...group, origin: 'kitnets' })),
  ...findDuplicatePersonalEntries(personal).map((group) => ({ ...group, origin: 'pessoal' })),
];

/**
 * Checagem no instante de salvar: o `candidate` (ainda não gravado) bate com
 * algum lançamento de despesa já existente no mesmo mês? Retorna o primeiro
 * lançamento conflitante, ou null. Usado pelo EntityPage antes de criar.
 */
export const findExpenseDuplicateOf = (candidate, existingExpenses = []) => (
  existingExpenses.find((row) => (
    row.active !== false
    && (matchesSameValue(row, candidate, 'kitnet_id') || matchesSameDescription(row, candidate, 'kitnet_id'))
  )) || null
);

/** Mesma checagem, para lançamentos pessoais (ignora receitas). */
export const findPersonalDuplicateOf = (candidate, existingPersonal = []) => {
  if (candidate.type === 'income') return null;

  return existingPersonal.find((row) => (
    row.active !== false
    && row.type !== 'income'
    && (matchesSameValue(row, candidate, 'category') || matchesSameDescription(row, candidate, 'category'))
  )) || null;
};

export default findAllDuplicates;
