import { describe, expect, it } from 'vitest';
import { buildCardBalances } from './cardBalanceService.js';

const compra = (card, value, date, extra = {}) => ({
  type: 'card_transaction', card_name: card, value, date, status: 'revisar', ...extra,
});
const pagamentoFatura = (card, value, date, extra = {}) => ({
  type: 'card_payment', card_name: card, value, date, status: 'pago', ...extra,
});

describe('buildCardBalances', () => {
  it('saldo devedor = compras lançadas menos pagamentos de fatura', () => {
    const result = buildCardBalances({
      personal: [
        compra('Nubank', 2000, '2026-07-10'),
        pagamentoFatura('Nubank', 1500, '2026-07-05'),
      ],
    });

    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({ cardName: 'Nubank', charged: 2000, paid: 1500, balance: 500 });
    expect(result.totalBalance).toBe(500);
  });

  it('separa os cartões e soma o total devido', () => {
    const result = buildCardBalances({
      personal: [
        compra('Nubank', 1000, '2026-07-10'),
        compra('Santander', 300, '2026-07-11'),
        pagamentoFatura('Santander', 300, '2026-07-12'),
      ],
    });

    expect(result.cards.map((c) => [c.cardName, c.balance])).toEqual([['Nubank', 1000], ['Santander', 0]]);
    expect(result.totalBalance).toBe(1000);
  });

  it('ignora compra marcada como ignorar (não vira dívida)', () => {
    const result = buildCardBalances({
      personal: [
        compra('Nubank', 999, '2026-07-10', { status: 'ignorar' }),
        compra('Nubank', 100, '2026-07-11'),
      ],
    });

    expect(result.cards[0]).toMatchObject({ charged: 100, balance: 100 });
  });

  it('não confunde gasto pessoal comum nem transferência com movimento de cartão', () => {
    const result = buildCardBalances({
      personal: [
        compra('Nubank', 100, '2026-07-10'),
        { type: 'expense', card_name: 'Nubank', value: 500, date: '2026-07-10', status: 'pago' },
        { type: 'transfer', card_name: 'Nubank', value: 800, date: '2026-07-10', status: 'pago' },
      ],
    });

    // Só a compra no cartão vira dívida: boleto pago e transferência não são do cartão.
    expect(result.cards[0]).toMatchObject({ charged: 100, paid: 0, balance: 100 });
  });

  it('respeita o corte por mês (upToMonth)', () => {
    const result = buildCardBalances({
      upToMonth: '2026-07',
      personal: [
        compra('Nubank', 1000, '2026-07-10'),
        compra('Nubank', 400, '2026-08-10'),
      ],
    });

    expect(result.cards[0].balance).toBe(1000);
  });
});
