import { isPersonalExpense } from './personalMovementClassifier.js';

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
// 2. Mesma descrição, mesma kitnet/categoria e VALOR PRATICAMENTE IGUAL (pega
//    quando o valor foi digitado diferente nas duas vezes — R$ 129,90 x
//    R$ 130,00).
//
// A proximidade do valor na regra 2 é o que separa alarme de verdade de
// barulho. Sem ela, a regra dizia "duplicado" sempre que a mesma descrição
// aparecia duas vezes no mês, e isso é NORMAL: duas contas da Equatorial pagas
// no mesmo mês (a referência 04/2026 em 05/05 por R$ 896,76 e a 05/2026 em
// 31/05 por R$ 672,14) e qualquer par de compras no mesmo estabelecimento
// (dois pedidos de iFood em julho, de valores diferentes). Eram ~34 dos 51
// grupos avisados — barulho suficiente para esconder a duplicidade de verdade
// no meio ou, pior, levar a apagar uma conta legítima.
//
// Erro de digitação erra por centavos; contas diferentes do mesmo fornecedor
// erram por dezenas ou centenas de reais.
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const monthOf = (date) => String(date || '').slice(0, 7);
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

// Tolerância da regra 2: 2% do maior valor. R$ 129,90 x R$ 130,00 fica dentro
// (0,08%); R$ 896,76 x R$ 672,14 fica muito fora (25%).
const NEAR_VALUE_TOLERANCE = 0.02;

const hasNearValue = (a, b) => {
  const first = Math.abs(Number(a || 0));
  const second = Math.abs(Number(b || 0));
  const largest = Math.max(first, second);
  if (!largest) return true; // dois lançamentos sem valor: a descrição decide
  return Math.abs(first - second) / largest <= NEAR_VALUE_TOLERANCE;
};

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

// Quebra um conjunto de lançamentos de mesma descrição em blocos de valor
// próximo: ordena por valor e corta sempre que o salto passa da tolerância.
const clusterByNearValue = (items) => {
  const sorted = [...items].sort((a, b) => Number(a.value || 0) - Number(b.value || 0));

  return sorted.reduce((clusters, item) => {
    const current = clusters[clusters.length - 1];
    if (current && hasNearValue(current[current.length - 1].value, item.value)) {
      current.push(item);
      return clusters;
    }
    clusters.push([item]);
    return clusters;
  }, []);
};

// bucketFields = campos que identificam o "grupo" onde duplicidade faz
// sentido comparar (kitnet_id para despesas; category+context para
// lançamentos pessoais — "Manutenção" pessoal e "Manutenção" da obra no
// mesmo valor/mês são contas DIFERENTES, não uma duplicata).
const bucketKey = (row, bucketFields) => bucketFields.map((field) => row[field] || '').join('|');

const matchesSameValue = (row, candidate, bucketFields) => (
  monthOf(row.date) === monthOf(candidate.date)
  && Boolean(candidate.value)
  && round2(row.value) === round2(candidate.value)
  && bucketKey(row, bucketFields) === bucketKey(candidate, bucketFields)
);

const matchesSameDescription = (row, candidate, bucketFields) => {
  const text = normalizeText(candidate.description || candidate.category);
  return Boolean(text)
    && monthOf(row.date) === monthOf(candidate.date)
    && hasNearValue(row.value, candidate.value)
    && normalizeText(row.description || row.category) === text
    && bucketKey(row, bucketFields) === bucketKey(candidate, bucketFields);
};

const findGroups = (rows, bucketFields, reasonValue, reasonDescription) => {
  const groups = [];

  groupBy(rows, (row) => (row.value && row.date
    ? `${monthOf(row.date)}|${bucketKey(row, bucketFields)}|${round2(row.value)}`
    : null))
    .forEach((items) => {
      if (items.length > 1) groups.push({ reason: reasonValue, items });
    });

  // O bucket entra na chave: "Internet SPNET" em duas kitnets/contextos
  // diferentes no mesmo mês são contas legítimas, não uma duplicidade.
  groupBy(rows, (row) => {
    const text = normalizeText(row.description || row.category);
    return text && row.date ? `${monthOf(row.date)}|${bucketKey(row, bucketFields)}|${text}` : null;
  })
    .forEach((items) => {
      // Mesma descrição no mês não basta: separa em blocos de valor próximo,
      // senão as duas contas da Equatorial (R$ 896,76 e R$ 672,14) viravam uma
      // "duplicidade" só por dividirem o nome do fornecedor.
      clusterByNearValue(items).forEach((cluster) => {
        if (cluster.length > 1 && !groups.some((group) => sameItems(group.items, cluster))) {
          groups.push({ reason: reasonDescription, items: cluster });
        }
      });
    });

  return groups;
};

/** Duplicidades entre despesas das kitnets (entidade Expense). */
export const findDuplicateExpenses = (expenses = []) => findGroups(
  expenses.filter((row) => row.active !== false),
  ['kitnet_id'],
  'Mesmo valor, mesma kitnet e mesmo mês',
  'Mesma descrição no mesmo mês',
);

/** Duplicidades entre lançamentos pessoais (entidade PersonalIncome, exceto receitas). */
export const findDuplicatePersonalEntries = (personal = []) => findGroups(
  personal.filter((row) => row.active !== false && isPersonalExpense(row)),
  ['category', 'context'],
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
    && (matchesSameValue(row, candidate, ['kitnet_id']) || matchesSameDescription(row, candidate, ['kitnet_id']))
  )) || null
);

/** Mesma checagem, para lançamentos pessoais (ignora receitas). */
export const findPersonalDuplicateOf = (candidate, existingPersonal = []) => {
  if (!isPersonalExpense(candidate)) return null;

  return existingPersonal.find((row) => (
    row.active !== false
    && isPersonalExpense(row)
    && (matchesSameValue(row, candidate, ['category', 'context']) || matchesSameDescription(row, candidate, ['category', 'context']))
  )) || null;
};

export default findAllDuplicates;
