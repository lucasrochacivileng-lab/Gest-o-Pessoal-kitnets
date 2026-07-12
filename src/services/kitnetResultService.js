import { financialService } from './financialService';
import { resolveExpenseSegment } from './segmentConsolidationService.js';

// Resultado (P&L) por KITNET no mês: aluguel recebido de cada unidade menos as
// despesas de kitnets vinculadas àquela unidade. Despesas do segmento Kitnets
// sem unidade específica (kitnet_id 'geral' ou vazio) vão para o balde "Geral"
// à parte — NÃO são rateadas entre as unidades (decisão de produto atual).
// Regime de caixa: só entra o que foi pago/recebido, igual ao consolidado.

const toMoney = (value) => Number(value || 0);
const paymentValue = financialService.netPaymentValue;
const inMonth = (date, monthKey) => String(date || '').startsWith(monthKey);
const isConfirmed = (row) => ['pago', 'recebido'].includes(row.status);

export const GERAL_KEY = 'geral';

export const buildKitnetResults = ({ kitnets = [], payments = [], expenses = [], personal = [], monthKey }) => {
  const byId = new Map(
    kitnets.map((kitnet) => [kitnet.id, { id: kitnet.id, name: kitnet.name || kitnet.id, income: 0, expense: 0 }]),
  );
  const geral = { expense: 0 };

  // Renda: aluguéis recebidos no mês, atribuídos à unidade pelo kitnet_id.
  payments
    .filter((row) => inMonth(row.payment_date, monthKey))
    .forEach((row) => {
      const entry = byId.get(row.kitnet_id);
      if (entry) entry.income += paymentValue(row);
    });

  // Despesa de kitnets → unidade específica, ou "Geral" quando kitnet_id é
  // 'geral'/vazio/desconhecido. Só entra o que é do segmento Kitnets.
  const addKitnetExpense = (kitnetId, value) => {
    if (kitnetId && kitnetId !== GERAL_KEY && byId.has(kitnetId)) {
      byId.get(kitnetId).expense += value;
    } else {
      geral.expense += value;
    }
  };

  expenses
    .filter((row) => row.status === 'pago' && inMonth(row.date, monthKey) && resolveExpenseSegment(row, 'kitnets') === 'kitnets')
    .forEach((row) => addKitnetExpense(row.kitnet_id, toMoney(row.value)));

  personal
    .filter((row) => row.type !== 'income' && isConfirmed(row) && inMonth(row.date, monthKey) && resolveExpenseSegment(row, 'pessoal') === 'kitnets')
    .forEach((row) => addKitnetExpense(row.kitnet_id, toMoney(row.value)));

  const kitnetResults = [...byId.values()]
    .map((entry) => ({ ...entry, result: entry.income - entry.expense }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const income = kitnetResults.reduce((sum, entry) => sum + entry.income, 0);
  const kitnetExpense = kitnetResults.reduce((sum, entry) => sum + entry.expense, 0);
  const expense = kitnetExpense + geral.expense;

  return {
    kitnets: kitnetResults,
    geral,
    totals: { income, expense, result: income - expense },
  };
};

export default buildKitnetResults;
