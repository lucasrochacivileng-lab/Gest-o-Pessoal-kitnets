const toMoney = (value) => Number(value || 0);
const paymentValue = (payment) => toMoney(payment.net_value || payment.paid_value);
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
export const buildCashflow = ({ payments = [], expenses = [], personal = [], monthKey }) => {
  const kitnetsIn = payments
    .filter((row) => inMonth(row.payment_date, monthKey))
    .reduce((sum, row) => sum + paymentValue(row), 0);

  const kitnetsOut = expenses
    .filter((row) => row.status === 'pago' && inMonth(row.date, monthKey))
    .reduce((sum, row) => sum + toMoney(row.value), 0);

  const personalIn = personal
    .filter((row) => row.type === 'income' && isConfirmed(row) && inMonth(row.date, monthKey))
    .reduce((sum, row) => sum + toMoney(row.value), 0);

  const personalOut = personal
    .filter((row) => row.type === 'expense' && isConfirmed(row) && inMonth(row.date, monthKey))
    .reduce((sum, row) => sum + toMoney(row.value), 0);

  // Quanto das contas PESSOAIS foi investido nas kitnets/obra (acumulado, todos os meses).
  const investedInBusiness = personal
    .filter((row) => row.type !== 'income' && isConfirmed(row) && isBusinessContext(row))
    .reduce((sum, row) => sum + toMoney(row.value), 0);

  const pendingCardReview = personal.filter((row) => row.type === 'card_transaction' && ['revisar', 'sugerido'].includes(row.status)).length;

  return {
    kitnetsIn,
    kitnetsOut,
    kitnetsResult: kitnetsIn - kitnetsOut,
    personalIn,
    personalOut,
    personalResult: personalIn - personalOut,
    finalResult: kitnetsIn - kitnetsOut + personalIn - personalOut,
    investedInBusiness,
    pendingCardReview,
  };
};

export default buildCashflow;
