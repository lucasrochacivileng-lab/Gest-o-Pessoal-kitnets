import { describe, expect, it } from 'vitest';
import {
  describeInvoice,
  findCardByName,
  hasCycle,
  invoiceForPurchase,
  invoicePeriod,
} from './cardCycleService.js';

// Nubank do Lucas: fecha dia 3, vence dia 10 — fecha e vence no mesmo mês.
const nubank = { card_name: 'Nubank', closing_day: 3, due_day: 10 };
// Amazon: fecha dia 24 e vence dia 10 — fecha num mês e vence no seguinte.
const amazon = { card_name: 'Amazon 8019', closing_day: 24, due_day: 10 };

describe('hasCycle', () => {
  it('exige fechamento e vencimento', () => {
    expect(hasCycle(nubank)).toBe(true);
    expect(hasCycle({ closing_day: 3 })).toBe(false);
    expect(hasCycle({ due_day: 10 })).toBe(false);
    expect(hasCycle({ closing_day: null, due_day: null })).toBe(false);
    expect(hasCycle(undefined)).toBe(false);
  });
});

describe('invoiceForPurchase', () => {
  it('compra do meio de junho cai na fatura que vence em 10/07', () => {
    expect(invoiceForPurchase({ card: nubank, purchaseDate: '2026-06-15' }))
      .toMatchObject({ month: '2026-07', dueDate: '2026-07-10', closingDate: '2026-07-03' });
  });

  it('compra NO dia do fechamento ainda entra na fatura que fecha nele', () => {
    expect(invoiceForPurchase({ card: nubank, purchaseDate: '2026-07-03' }))
      .toMatchObject({ month: '2026-07', dueDate: '2026-07-10' });
  });

  it('compra no dia seguinte ao fechamento só entra na fatura seguinte', () => {
    expect(invoiceForPurchase({ card: nubank, purchaseDate: '2026-07-04' }))
      .toMatchObject({ month: '2026-08', dueDate: '2026-08-10' });
  });

  it('cartao que fecha depois do vencimento vence no mes seguinte', () => {
    // Fecha 24/07 -> vence 10/08 (o dia 10 de julho já tinha passado).
    expect(invoiceForPurchase({ card: amazon, purchaseDate: '2026-07-15' }))
      .toMatchObject({ month: '2026-08', dueDate: '2026-08-10', closingDate: '2026-07-24' });
  });

  it('vira o ano corretamente', () => {
    expect(invoiceForPurchase({ card: nubank, purchaseDate: '2026-12-20' }))
      .toMatchObject({ month: '2027-01', dueDate: '2027-01-10' });
  });

  it('sem ciclo cadastrado, nao inventa fatura', () => {
    expect(invoiceForPurchase({ card: { card_name: 'Nubank' }, purchaseDate: '2026-06-15' })).toBeNull();
    expect(invoiceForPurchase({ card: nubank, purchaseDate: '' })).toBeNull();
  });
});

describe('invoicePeriod', () => {
  it('a fatura de julho cobre de 04/06 a 03/07 (o caso do Lucas)', () => {
    expect(invoicePeriod({ card: nubank, month: '2026-07' }))
      .toMatchObject({ start: '2026-06-04', end: '2026-07-03', dueDate: '2026-07-10' });
  });

  it('cartao que vence no mes seguinte ao fechamento', () => {
    // Vence 10/08 -> fechou 24/07 -> cobre de 25/06 a 24/07.
    expect(invoicePeriod({ card: amazon, month: '2026-08' }))
      .toMatchObject({ start: '2026-06-25', end: '2026-07-24', dueDate: '2026-08-10' });
  });

  it('vira o ano para tras', () => {
    expect(invoicePeriod({ card: nubank, month: '2026-01' }))
      .toMatchObject({ start: '2025-12-04', end: '2026-01-03' });
  });

  it('fechamento dia 31 respeita fevereiro', () => {
    const card = { closing_day: 31, due_day: 10 };
    // Fecha 28/02/2026 (fevereiro não tem 31) e vence 10/03.
    expect(invoicePeriod({ card, month: '2026-03' })).toMatchObject({ end: '2026-02-28' });
  });

  it('o periodo casa com invoiceForPurchase nas duas pontas', () => {
    const period = invoicePeriod({ card: nubank, month: '2026-07' });
    // O primeiro e o último dia do período têm que cair nesta mesma fatura.
    expect(invoiceForPurchase({ card: nubank, purchaseDate: period.start }).month).toBe('2026-07');
    expect(invoiceForPurchase({ card: nubank, purchaseDate: period.end }).month).toBe('2026-07');
  });

  it('sem ciclo cadastrado devolve null', () => {
    expect(invoicePeriod({ card: { card_name: 'Nubank' }, month: '2026-07' })).toBeNull();
  });
});

describe('findCardByName', () => {
  const cards = [nubank, amazon, { card_name: 'Santander 7535/7909', name: 'Santander 7535/7909' }];

  it('acha pelo nome exato', () => {
    expect(findCardByName(cards, 'Nubank')).toBe(nubank);
  });

  it('acha quando o lancamento usa um nome mais curto que o cadastro', () => {
    expect(findCardByName(cards, 'Santander')?.card_name).toBe('Santander 7535/7909');
  });

  it('ignora acento e caixa', () => {
    expect(findCardByName([{ card_name: 'Itaú' }], 'ITAU')?.card_name).toBe('Itaú');
  });

  it('devolve null quando nao acha', () => {
    expect(findCardByName(cards, 'Banco Inexistente')).toBeNull();
    expect(findCardByName(cards, '')).toBeNull();
  });
});

describe('describeInvoice', () => {
  it('escreve a frase que tira a ambiguidade da tela', () => {
    expect(describeInvoice({ card: nubank, month: '2026-07' }))
      .toBe('Fatura de julho — compras de 04/06 a 03/07, vence 10/07');
  });

  it('sem ciclo, pede o cadastro em vez de inventar o periodo', () => {
    expect(describeInvoice({ card: { card_name: 'Nubank' }, month: '2026-07' }))
      .toContain('cadastre o fechamento');
  });
});
