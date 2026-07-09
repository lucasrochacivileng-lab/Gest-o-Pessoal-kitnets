// Verificador de duplicidades: nenhum ponto do app hoje avisa se a mesma conta
// foi lançada duas vezes (ex.: a mesma fatura de internet cadastrada manualmente
// por duas pessoas, ou uma vez manual e outra pela geração automática de
// recorrentes com uma descrição levemente diferente). Este serviço varre o
// histórico inteiro e aponta grupos suspeitos por dois critérios independentes:
//
// 1. Mesmo valor + mesma kitnet/categoria + mesmo mês (pega o caso mais comum:
//    a mesma conta lançada duas vezes com descrições diferentes).
// 2. Mesma descrição (normalizada) + mesmo mês (pega o caso em que o valor foi
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

/** Duplicidades entre despesas das kitnets (entidade Expense). */
export const findDuplicateExpenses = (expenses = []) => {
  const active = expenses.filter((row) => row.active !== false);
  const groups = [];

  groupBy(active, (row) => (row.value && row.date
    ? `${monthOf(row.date)}|${row.kitnet_id || 'sem-kitnet'}|${round2(row.value)}`
    : null))
    .forEach((items) => {
      if (items.length > 1) groups.push({ reason: 'Mesmo valor, mesma kitnet e mesmo mês', items });
    });

  // Mesma kitnet entra na chave: "Internet SPNET" em duas kitnets diferentes
  // no mesmo mês são duas contas legítimas, não uma duplicidade.
  groupBy(active, (row) => {
    const text = normalizeText(row.description || row.category);
    return text && row.date ? `${monthOf(row.date)}|${row.kitnet_id || 'sem-kitnet'}|${text}` : null;
  })
    .forEach((items) => {
      if (items.length > 1 && !groups.some((group) => sameItems(group.items, items))) {
        groups.push({ reason: 'Mesma descrição no mesmo mês', items });
      }
    });

  return groups;
};

/** Duplicidades entre lançamentos pessoais (entidade PersonalIncome, exceto receitas). */
export const findDuplicatePersonalEntries = (personal = []) => {
  const active = personal.filter((row) => row.active !== false && row.type !== 'income');
  const groups = [];

  groupBy(active, (row) => (row.value && row.date
    ? `${monthOf(row.date)}|${row.category || 'sem-categoria'}|${round2(row.value)}`
    : null))
    .forEach((items) => {
      if (items.length > 1) groups.push({ reason: 'Mesmo valor, mesma categoria e mesmo mês', items });
    });

  groupBy(active, (row) => {
    const text = normalizeText(row.description || row.category);
    return text && row.date ? `${monthOf(row.date)}|${row.category || 'sem-categoria'}|${text}` : null;
  })
    .forEach((items) => {
      if (items.length > 1 && !groups.some((group) => sameItems(group.items, items))) {
        groups.push({ reason: 'Mesma descrição no mesmo mês', items });
      }
    });

  return groups;
};

/** Varredura combinada, usada pela tela de Extrato. */
export const findAllDuplicates = ({ expenses = [], personal = [] }) => [
  ...findDuplicateExpenses(expenses).map((group) => ({ ...group, origin: 'kitnets' })),
  ...findDuplicatePersonalEntries(personal).map((group) => ({ ...group, origin: 'pessoal' })),
];

export default findAllDuplicates;
