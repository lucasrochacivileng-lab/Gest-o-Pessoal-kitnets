import { describe, expect, it } from 'vitest';
import { buildCashflow } from './cashflowService.js';

const monthKey = '2026-07';

describe('buildCashflow', () => {
  it('consolida kitnets + pessoal em regime de caixa', () => {
    const result = buildCashflow({
      monthKey,
      payments: [
        { payment_date: '2026-07-05', paid_value: 950 },
        { payment_date: '2026-06-05', paid_value: 900 },
      ],
      expenses: [
        { date: '2026-07-05', value: 110, status: 'pago' },
        { date: '2026-07-15', value: 1100, status: 'pendente' },
      ],
      personal: [
        { type: 'income', date: '2026-07-01', value: 2000, status: 'recebido' },
        { type: 'expense', date: '2026-07-02', value: 500, status: 'pago', context: 'pessoal' },
        { type: 'expense', date: '2026-07-03', value: 300, status: 'pendente', context: 'pessoal' },
      ],
    });

    expect(result.kitnetsIn).toBe(950);
    expect(result.kitnetsOut).toBe(110);
    expect(result.kitnetsResult).toBe(840);
    expect(result.personalResult).toBe(1500);
    expect(result.finalResult).toBe(2340);
  });

  it('soma o investido na obra/kitnets pelas contas pessoais (acumulado)', () => {
    const result = buildCashflow({
      monthKey,
      personal: [
        { type: 'expense', date: '2026-05-10', value: 1100, status: 'pago', context: 'obra' },
        { type: 'expense', date: '2026-06-10', value: 1100, status: 'pago', context: 'kitnets' },
        { type: 'expense', date: '2026-07-02', value: 80, status: 'pago', context: 'pessoal' },
        { type: 'expense', date: '2026-07-03', value: 900, status: 'pendente', context: 'obra' },
      ],
    });

    expect(result.investedInBusiness).toBe(2200);
  });

  it('respeita net_value 0 de propósito (desconto integral) em vez de usar o paid_value cheio', () => {
    const result = buildCashflow({
      monthKey,
      payments: [
        { payment_date: '2026-07-05', paid_value: 800, net_value: 0 },
      ],
    });

    expect(result.kitnetsIn).toBe(0);
  });

  it('deixa transações de cartão não revisadas fora do caixa e conta as pendentes', () => {
    const result = buildCashflow({
      monthKey,
      personal: [
        { type: 'card_transaction', date: '2026-07-01', value: 999, status: 'revisar' },
        { type: 'card_transaction', date: '2026-07-01', value: 500, status: 'sugerido' },
        { type: 'card_transaction', date: '2026-07-01', value: 100, status: 'ignorar' },
      ],
    });

    expect(result.personalOut).toBe(0);
    expect(result.finalResult).toBe(0);
    expect(result.pendingCardReview).toBe(2);
  });
});
