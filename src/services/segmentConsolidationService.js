import { financialService } from './financialService';
import { isPersonalExpense } from './personalMovementClassifier.js';
import { rentPaymentsOnly } from './paymentClassifier.js';
import { incomeDate } from '../modules/receivables/services/extraIncomeService.js';

// Consolidação por SEGMENTO (centro de resultado). Normaliza todas as fontes de
// dinheiro já existentes num mesmo formato — entradas e saídas por segmento —
// para a visão global mostrar kitnets, projetos, perícias, trabalho e pessoal
// separados, e o total. Regime de caixa: só entra o que foi efetivamente
// pago/recebido (mesma regra do cashflowService).

const toMoney = (value) => Number(value || 0);
const paymentValue = financialService.netPaymentValue;
const inMonth = (date, monthKey) => String(date || '').startsWith(monthKey);
const isConfirmed = (row) => ['pago', 'recebido'].includes(row.status);

export const SEGMENTS = [
  { key: 'kitnets', label: 'Kitnets' },
  { key: 'projetos', label: 'Projetos' },
  { key: 'pericias', label: 'Perícias' },
  { key: 'trabalho', label: 'Trabalho / Servidor' },
  { key: 'pessoal', label: 'Pessoal' },
];

const SEGMENT_KEYS = new Set(SEGMENTS.map((segment) => segment.key));

// Segmento de uma DESPESA. Prioriza o campo novo `segment`; na sua ausência
// (lançamentos antigos), mantém o comportamento legado: despesa direta
// (Expense) sem segmento é custo das kitnets, e lançamento pessoal usa o
// `context` histórico (kitnets/obra → kitnets, trabalho → trabalho, resto →
// pessoal). `fallback` é o padrão de cada fonte quando não há pista nenhuma.
export const resolveExpenseSegment = (row = {}, fallback = 'pessoal') => {
  if (SEGMENT_KEYS.has(row.segment)) return row.segment;
  if (['kitnets', 'obra'].includes(row.context)) return 'kitnets';
  if (row.context === 'trabalho') return 'trabalho';
  if (row.context === 'pessoal') return 'pessoal';
  return fallback;
};

export const buildSegmentConsolidation = ({
  payments = [], expenses = [], personal = [], projects = [], expertReports = [], monthKey,
}) => {
  const acc = Object.fromEntries(SEGMENTS.map((segment) => [segment.key, { ...segment, income: 0, expense: 0, items: [] }]));

  // Cada lançamento que entra num total também é guardado em `items`, para o
  // Consolidado poder abrir o detalhe do segmento (o que compõe aquele valor).
  const addIncome = (key, value, item) => {
    acc[key].income += value;
    acc[key].items.push({ ...item, kind: 'entrada', value });
  };
  const addExpense = (key, value, item) => {
    acc[key].expense += value;
    acc[key].items.push({ ...item, kind: 'saida', value });
  };

  // Kitnets: aluguéis recebidos entram; as despesas diretas pagas saem no
  // segmento que o lançamento indica (o padrão é Kitnets, para não mudar o
  // comportamento das despesas antigas que não têm segmento).
  rentPaymentsOnly(payments)
    .filter((row) => inMonth(row.payment_date, monthKey))
    .forEach((row) => addIncome('kitnets', paymentValue(row), {
      date: row.payment_date, description: row.description || 'Aluguel recebido', source: 'Aluguel',
    }));
  expenses
    .filter((row) => row.status === 'pago' && inMonth(row.date, monthKey))
    .forEach((row) => addExpense(resolveExpenseSegment(row, 'kitnets'), toMoney(row.value), {
      date: row.date, description: row.description || row.category || 'Despesa', source: 'Despesa direta',
    }));

  // Projetos e perícias: só o que foi efetivamente recebido no mês.
  projects
    .filter((row) => row.status === 'recebido' && inMonth(incomeDate(row), monthKey))
    .forEach((row) => addIncome('projetos', toMoney(row.value), {
      date: incomeDate(row), description: [row.client, row.project_type].filter(Boolean).join(' — ') || 'Projeto', source: 'Projeto',
    }));
  expertReports
    .filter((row) => row.status === 'recebido' && inMonth(incomeDate(row), monthKey))
    .forEach((row) => addIncome('pericias', toMoney(row.fee_value), {
      date: incomeDate(row), description: [row.client, row.process_number].filter(Boolean).join(' — ') || 'Perícia', source: 'Perícia',
    }));

  // Renda pessoal confirmada: salário (contexto 'trabalho') vai pro segmento
  // Trabalho; o resto, pra Pessoal.
  personal
    .filter((row) => row.type === 'income' && isConfirmed(row) && inMonth(row.date, monthKey))
    .forEach((row) => addIncome(row.context === 'trabalho' ? 'trabalho' : 'pessoal', toMoney(row.value), {
      date: row.date, description: row.description || row.category || 'Receita', source: 'Pessoal',
    }));

  // Despesa pessoal confirmada — inclui as compras no cartão pessoal
  // ('card_transaction'), porque é comum pagar custo de kitnet no cartão
  // pessoal. O que manda é o SEGMENTO (com o context como fallback dos
  // lançamentos antigos): gasto de kitnets/obra conta como despesa das
  // kitnets; perícia/projeto, na sua frente; o resto, como despesa pessoal.
  // Transações de cartão em 'revisar'/'sugerido'/'ignorar' ficam de fora.
  personal
    .filter((row) => isPersonalExpense(row) && isConfirmed(row) && inMonth(row.date, monthKey))
    .forEach((row) => addExpense(resolveExpenseSegment(row, 'pessoal'), toMoney(row.value), {
      date: row.date,
      description: row.description || row.category || 'Despesa',
      source: row.type === 'card_transaction' ? 'Cartão' : 'Pessoal',
    }));

  const segments = SEGMENTS.map((segment) => {
    const entry = acc[segment.key];
    return {
      ...entry,
      result: entry.income - entry.expense,
      items: [...entry.items].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    };
  });

  const global = segments.reduce((sum, segment) => ({
    income: sum.income + segment.income,
    expense: sum.expense + segment.expense,
    result: sum.result + segment.result,
  }), { income: 0, expense: 0, result: 0 });

  return { segments, global };
};

export default buildSegmentConsolidation;
