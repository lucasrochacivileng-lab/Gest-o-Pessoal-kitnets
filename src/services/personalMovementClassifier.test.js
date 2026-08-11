import { describe, expect, it } from 'vitest';
import {
  CARD_PAYMENT_TYPE,
  isCardPayment,
  isPersonalExpense,
  isPersonalTransfer,
  leavesBankAccount,
} from './personalMovementClassifier.js';

// A regra central aqui é a distinção entre GASTO e SAÍDA DO BANCO, que não são
// a mesma coisa quando existe cartão de crédito no meio:
//
//   comprar no cartão  -> é gasto, mas não tira dinheiro do banco hoje
//   pagar a fatura     -> tira dinheiro do banco, mas NÃO é gasto novo
//                         (o gasto já foi contado quando a compra entrou)
//
// Se as duas coisas fossem tratadas como gasto, cada compra no cartão seria
// contada duas vezes. Foi por isso que a fatura de agosto de R$ 6.416,40 pôde
// ser registrada sem inflar as despesas do mês.

describe('personalMovementClassifier', () => {
  it('conta compra no cartão e despesa direta como gasto', () => {
    expect(isPersonalExpense({ type: 'expense' })).toBe(true);
    expect(isPersonalExpense({ type: 'card_transaction' })).toBe(true);
  });

  it('NÃO conta pagamento de fatura como gasto novo', () => {
    // A dupla contagem mora aqui: a compra já entrou como card_transaction.
    expect(isPersonalExpense({ type: CARD_PAYMENT_TYPE })).toBe(false);
    expect(isCardPayment({ type: CARD_PAYMENT_TYPE })).toBe(true);
  });

  it('NÃO conta transferência entre contas próprias como gasto nem como receita', () => {
    expect(isPersonalTransfer({ type: 'transfer' })).toBe(true);
    expect(isPersonalTransfer({ type: 'investment_transfer' })).toBe(true);
    expect(isPersonalExpense({ type: 'transfer' })).toBe(false);
    expect(isPersonalExpense({ type: 'investment_transfer' })).toBe(false);
  });

  it('só tira do banco a despesa direta e o pagamento de fatura', () => {
    expect(leavesBankAccount({ type: 'expense' })).toBe(true);
    expect(leavesBankAccount({ type: CARD_PAYMENT_TYPE })).toBe(true);
    // Comprar no cartão é gasto mas não move a conta: quem move é a fatura,
    // no vencimento. Incluir isto aqui zeraria o saldo conciliado do banco.
    expect(leavesBankAccount({ type: 'card_transaction' })).toBe(false);
    expect(leavesBankAccount({ type: 'income' })).toBe(false);
    expect(leavesBankAccount({ type: 'transfer' })).toBe(false);
  });

  it('trata linha sem tipo e chamada sem argumento como não classificada', () => {
    expect(isPersonalExpense({})).toBe(false);
    expect(isPersonalExpense()).toBe(false);
    expect(isCardPayment()).toBe(false);
    expect(isPersonalTransfer()).toBe(false);
    expect(leavesBankAccount()).toBe(false);
  });

  it('mantém o valor da constante usada como type no banco', () => {
    // Os registros gravados usam esta string; mudá-la órfã o histórico.
    expect(CARD_PAYMENT_TYPE).toBe('card_payment');
  });
});
