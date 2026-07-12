import { financialService } from './financialService';
import { rentPaymentsOnly } from './paymentClassifier.js';
import { buildExtraIncomeRows } from '../modules/receivables/services/extraIncomeService.js';

const toMoney = (value) => Number(value || 0);
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
  const kitnetsIn = rentPaymentsOnly(payments)
    .filter((row) => inMonth(row.payment_date, monthKey))
    .reduce((sum, row) => sum + paymentValue(row), 0);

  const extraIn = buildExtraIncomeRows({ projects, expertReports, month: monthKey })
    .filter((row) => row.status === 'recebido')
    .reduce((sum, row) => sum + toMoney(row.value), 0);

  const kitnetsOut = expenses
    .filter((row) => row.status === 'pago' && inMonth(row.date, monthKey))
    .reduce((sum, row) => sum + toMoney(row.value), 0);

  const personalIn = personal
    .filter((row) => row.type === 'income' && isConfirmed(row) && inMonth(row.date, monthKey))
    .reduce((sum, row) => sum + toMoney(row.value), 0);

  // Inclui compras no cartão pessoal (card_transaction) já confirmadas: a
  // própria importação de fatura diz que a parcela "fica em revisão antes de
  // contar no caixa" — depois de revisada e marcada como paga, é gasto
  // realizado. As em 'revisar'/'sugerido'/'ignorar' não são isConfirmed e
  // continuam fora (viram só o aviso pendingCardReview).
  const personalOut = personal
    .filter((row) => row.type !== 'income' && isConfirmed(row) && inMonth(row.date, monthKey))
    .reduce((sum, row) => sum + toMoney(row.value), 0);

  // Quanto das contas PESSOAIS foi investido nas kitnets/obra (acumulado, todos os meses).
  const investedInBusiness = personal
    .filter((row) => row.type !== 'income' && isConfirmed(row) && isBusinessContext(row))
    .reduce((sum, row) => sum + toMoney(row.value), 0);

  const pendingCardReview = personal.filter((row) => row.type === 'card_transaction' && ['revisar', 'sugerido'].includes(row.status)).length;

  return {
    kitnetsIn,
    extraIn,
    kitnetsOut,
    kitnetsResult: kitnetsIn - kitnetsOut,
    personalIn,
    personalOut,
    personalResult: personalIn - personalOut,
    finalResult: kitnetsIn + extraIn - kitnetsOut + personalIn - personalOut,
    investedInBusiness,
    pendingCardReview,
  };
};

export default buildCashflow;
