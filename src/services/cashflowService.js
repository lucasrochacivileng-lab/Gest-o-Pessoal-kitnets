import { financialService } from './financialService';
import { rentPaymentsOnly } from './paymentClassifier.js';
import { buildExtraIncomeRows } from '../modules/receivables/services/extraIncomeService.js';
import { isPersonalExpense } from './personalMovementClassifier.js';
import { addMoney, subtractMoney, sumMoney } from './money.js';

const paymentValue = financialService.netPaymentValue;
const isConfirmed = (row) => ['pago', 'recebido'].includes(row.status);
const inMonth = (date, monthKey) => String(date || '').startsWith(monthKey);

export const PERSONAL_CONTEXTS = {
  PESSOAL: 'pessoal',
  KITNETS: 'kitnets',
  OBRA: 'obra',
};

const isBusinessContext = (row) => [PERSONAL_CONTEXTS.KITNETS, PERSONAL_CONTEXTS.OBRA].includes(row.context);

// Caixa geral (regime de caixa: só entra o que foi efetivamente pago/recebido).
// Transações de cartão importadas ('card_transaction') ficam fora até serem
// revisadas e classificadas como despesa confirmada.
export const buildCashflow = ({ payments = [], expenses = [], personal = [], projects = [], expertReports = [], monthKey }) => {
  const kitnetsIn = sumMoney(rentPaymentsOnly(payments)
    .filter((row) => inMonth(row.payment_date, monthKey))
    .map(paymentValue));

  const extraIn = sumMoney(buildExtraIncomeRows({ projects, expertReports, month: monthKey })
    .filter((row) => row.status === 'recebido')
    .map((row) => row.value));

  const kitnetsOut = sumMoney(expenses
    .filter((row) => row.status === 'pago' && inMonth(row.date, monthKey))
    .map((row) => row.value));

  const personalIn = sumMoney(personal
    .filter((row) => row.type === 'income' && isConfirmed(row) && inMonth(row.date, monthKey))
    .map((row) => row.value));

  // Inclui compras no cartão pessoal (card_transaction) já confirmadas: a
  // própria importação de fatura diz que a parcela "fica em revisão antes de
  // contar no caixa" — depois de revisada e marcada como paga, é gasto
  // realizado. As em 'revisar'/'sugerido'/'ignorar' não são isConfirmed e
  // continuam fora (viram só o aviso pendingCardReview).
  const personalOut = sumMoney(personal
    .filter((row) => isPersonalExpense(row) && isConfirmed(row) && inMonth(row.date, monthKey))
    .map((row) => row.value));

  // Quanto das contas PESSOAIS foi investido nas kitnets/obra (acumulado, todos os meses).
  const investedInBusiness = sumMoney(personal
    .filter((row) => isPersonalExpense(row) && isConfirmed(row) && isBusinessContext(row))
    .map((row) => row.value));

  const pendingCardReview = personal.filter((row) => row.type === 'card_transaction' && ['revisar', 'sugerido'].includes(row.status)).length;

  return {
    kitnetsIn,
    extraIn,
    kitnetsOut,
    kitnetsResult: subtractMoney(kitnetsIn, kitnetsOut),
    personalIn,
    personalOut,
    personalResult: subtractMoney(personalIn, personalOut),
    finalResult: subtractMoney(addMoney(kitnetsIn, extraIn, personalIn), kitnetsOut, personalOut),
    investedInBusiness,
    pendingCardReview,
  };
};

export default buildCashflow;
