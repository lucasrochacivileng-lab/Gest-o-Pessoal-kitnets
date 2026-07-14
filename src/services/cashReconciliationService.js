import { isPersonalExpense } from './personalMovementClassifier.js';
import { rentPaymentsOnly } from './paymentClassifier.js';

const money = (value) => Number(value || 0);

const confirmed = (row) => ['pago', 'recebido'].includes(row.status);
const withinWindow = (date, start, end) => Boolean(date) && date > start && (!end || date <= end);

const addDelta = (deltas, accountId, value) => {
  if (!accountId) return;
  deltas.set(accountId, (deltas.get(accountId) || 0) + value);
};

export const buildCashReconciliation = ({
  accounts = [],
  bankMovements = [],
  payments = [],
  expenses = [],
  personal = [],
  projects = [],
  expertReports = [],
} = {}) => {
  const deltas = new Map();

  accounts.forEach((account) => deltas.set(account.id, 0));

  const apply = (accountId, date, value) => {
    const account = accounts.find((item) => item.id === accountId);
    if (!account || !withinWindow(date, account.opening_date, account.balance_date)) return;
    addDelta(deltas, accountId, value);
  };

  expenses.filter((row) => row.status === 'pago').forEach((row) => apply(row.bank_account_id, row.date, -money(row.value)));
  rentPaymentsOnly(payments).forEach((row) => apply(row.bank_account_id, row.payment_date, money(row.net_value ?? row.paid_value)));
  personal.filter(confirmed).forEach((row) => {
    if (row.type === 'income') apply(row.bank_account_id, row.date, money(row.value));
    if (isPersonalExpense(row)) apply(row.bank_account_id, row.date, -money(row.value));
  });
  projects.filter((row) => row.status === 'recebido').forEach((row) => apply(row.bank_account_id, row.received_date || row.expected_payment_date, money(row.value)));
  expertReports.filter((row) => row.status === 'recebido').forEach((row) => apply(row.bank_account_id, row.received_date || row.expected_payment_date, money(row.fee_value)));

  bankMovements.forEach((row) => {
    const value = money(row.value);
    if (row.type === 'transferencia') {
      apply(row.bank_account_id, row.date, -value);
      apply(row.destination_account_id, row.date, value);
      return;
    }
    apply(row.bank_account_id, row.date, ['entrada', 'ajuste_entrada'].includes(row.type) ? value : -value);
  });

  const rows = accounts.map((account) => {
    const openingBalance = money(account.opening_balance);
    const calculatedBalance = openingBalance + (deltas.get(account.id) || 0);
    const actualBalance = money(account.actual_balance);
    return {
      ...account,
      calculatedBalance,
      actualBalance,
      difference: actualBalance - calculatedBalance,
    };
  });

  return {
    accounts: rows,
    calculatedTotal: rows.reduce((sum, row) => sum + row.calculatedBalance, 0),
    actualTotal: rows.reduce((sum, row) => sum + row.actualBalance, 0),
    differenceTotal: rows.reduce((sum, row) => sum + row.difference, 0),
  };
};

export default buildCashReconciliation;
