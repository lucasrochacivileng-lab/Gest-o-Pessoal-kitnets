import { financialService } from './financialService';
import { rentPaymentsOnly } from './paymentClassifier.js';
import { isPersonalExpense } from './personalMovementClassifier.js';
import { incomeDate } from '../modules/receivables/services/extraIncomeService.js';
import { resolveExpenseSegment, isConfirmed, movementDate } from './financialClassification.js';
import { fromCents, toCents, sumMoney, subtractMoney } from './money.js';

// Fonte comum dos indicadores de resultado. Cartão confirmado é gasto;
// quitação de fatura e transferências são movimentos de saldo, não novos gastos.
export function buildFinancialLedger({ payments = [], expenses = [], personal = [], projects = [], expertReports = [] } = {}) {
  const items = [];
  const add = (row, entity, kind, segment, value, date, source, category, href) => {
    if (row.active === false || !date || !Number.isFinite(Number(value))) return;
    items.push({ id: `${entity}:${row.id}`, sourceId: row.id, entity, kind, segment,
      value: fromCents(toCents(value)), date: String(date).slice(0, 10), source,
      description: row.description || row.notes || [row.client, row.project_type || row.process_number].filter(Boolean).join(' · ') || source,
      category: row.category || category || 'sem_categoria', href,
      kitnet_id: row.kitnet_id, project_id: row.project_id, expert_report_id: row.expert_report_id,
      costType: row.cost_type || (row.context === 'obra' ? 'investimento' : 'custeio'),
      legacySegment: kind === 'saida' && !row.segment && !row.context,
      card: row.type === 'card_transaction',
    });
  };
  rentPaymentsOnly(payments).filter((r) => r.active !== false && r.status !== 'estornado').forEach((r) =>
    add(r, 'Payment', 'entrada', 'kitnets', financialService.netPaymentValue(r), r.payment_date, 'Aluguel', 'aluguel', '/pagamentos'));
  expenses.filter((r) => r.status === 'pago').forEach((r) =>
    add(r, 'Expense', 'saida', resolveExpenseSegment(r, 'kitnets'), r.value, movementDate(r), 'Despesa direta', '', '/despesas'));
  personal.filter(isConfirmed).forEach((r) => {
    if (r.type === 'income' || isPersonalExpense(r)) add(r, 'PersonalIncome', r.type === 'income' ? 'entrada' : 'saida',
      resolveExpenseSegment(r), r.value, movementDate(r), r.type === 'card_transaction' ? 'Cartão' : 'Lançamento pessoal',
      r.type === 'income' && resolveExpenseSegment(r) === 'trabalho' ? 'salario' : '', '/financas-pessoais');
  });
  projects.filter((r) => r.status === 'recebido').forEach((r) => add(r, 'ComplementaryProject', 'entrada', 'projetos', r.value,
    incomeDate(r), 'Projeto', 'projeto', '/projetos'));
  expertReports.filter((r) => r.status === 'recebido').forEach((r) => add(r, 'ExpertReport', 'entrada', 'pericias', r.fee_value,
    incomeDate(r), 'Perícia', 'pericia', '/pericias'));
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export const selectLedger = (items, { month, segment = '' } = {}) => items.filter((r) =>
  (!month || r.date.startsWith(month)) && (!segment || r.segment === segment));
export function ledgerTotals(items) {
  const income = sumMoney(items.filter((r) => r.kind === 'entrada').map((r) => r.value));
  const expense = sumMoney(items.filter((r) => r.kind === 'saida').map((r) => r.value));
  return { income, expense, result: subtractMoney(income, expense) };
}
export function monthKeys(endMonth, count = 12) {
  const [year, month] = endMonth.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(year, month - count + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}
export const compareValues = (value, previous) => ({ difference: subtractMoney(value, previous),
  percent: previous === 0 ? null : (value - previous) / Math.abs(previous) * 100 });
