import { isCardPayment } from './personalMovementClassifier.js';
import { isCardTransaction } from './cardInvoiceService.js';

// Saldo de cada cartão, tratando o cartão como uma CONTA (uma dívida):
//   saldo devedor = compras lançadas − pagamentos de fatura
// A compra aumenta a dívida (mas não move o banco); o pagamento da fatura
// abate a dívida (e aí sim sai do banco). É isso que impede contar a mesma
// compra duas vezes — uma no gasto, outra no pagamento da fatura.
const toMoney = (value) => Number(value || 0);
const normalizeCard = (value) => String(value || '').trim().toLowerCase();
const monthOf = (date) => String(date || '').slice(0, 7);

const cardKeyOf = (row) => normalizeCard(row.card_name);

/**
 * @param personal lançamentos pessoais (PersonalIncome)
 * @param upToMonth opcional 'YYYY-MM' — considera só o que é até esse mês
 *        (inclusive). Sem ele, usa o histórico inteiro.
 */
export const buildCardBalances = ({ personal = [], upToMonth = '' } = {}) => {
  const withinPeriod = (row) => !upToMonth || monthOf(row.date) <= upToMonth;
  const cards = new Map();

  const ensure = (row) => {
    const key = cardKeyOf(row);
    if (!key) return null;
    const current = cards.get(key) || {
      key,
      cardName: row.card_name,
      charged: 0,
      paid: 0,
      chargeCount: 0,
      paymentCount: 0,
    };
    cards.set(key, current);
    return current;
  };

  personal.filter(withinPeriod).forEach((row) => {
    const card = ensure(row);
    if (!card) return;

    if (isCardTransaction(row)) {
      card.charged += toMoney(row.value);
      card.chargeCount += 1;
      return;
    }

    if (isCardPayment(row)) {
      card.paid += toMoney(row.value);
      card.paymentCount += 1;
    }
  });

  const rows = [...cards.values()]
    .map((card) => ({ ...card, balance: card.charged - card.paid }))
    // Cartão sem nenhum movimento não interessa; ordena pela maior dívida.
    .filter((card) => card.chargeCount > 0 || card.paymentCount > 0)
    .sort((a, b) => b.balance - a.balance);

  return {
    cards: rows,
    totalCharged: rows.reduce((sum, card) => sum + card.charged, 0),
    totalPaid: rows.reduce((sum, card) => sum + card.paid, 0),
    totalBalance: rows.reduce((sum, card) => sum + card.balance, 0),
  };
};

export default buildCardBalances;
