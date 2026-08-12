import { fromCents, toCents } from './money.js';

const money = (value = 0) => fromCents(toCents(value)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Valor líquido de um pagamento: usa net_value quando presente (mesmo que
// seja 0 de propósito — ex. desconto integral), senão cai no paid_value.
// "??" e não "||": um net_value 0 legítimo não pode virar o paid_value
// cheio só porque 0 é falsy em JS. Ponto único usado por dashboard, caixa,
// visão geral e relatórios — antes cada tela reimplementava isso por conta
// própria e divergia sempre que alguém corrigia só uma cópia.
const netPaymentValue = (payment: { net_value?: number | string; paid_value?: number | string } = {}) => {
  return fromCents(toCents(payment.net_value ?? payment.paid_value ?? 0));
};

export const financialService = {
  money,
  netPaymentValue,
  formatCurrency(value: number | string | null | undefined) {
    return money(value || 0);
  },
};
