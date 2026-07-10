import { describe, expect, it } from 'vitest';
import { buildCardInvoices, buildCardInvoiceSummary, getCostType, getEconomicOrigin } from './cardInvoiceService.js';

describe('cardInvoiceService', () => {
  it('agrupa transacoes de cartao por fatura do mes de vencimento', () => {
    const invoices = buildCardInvoices({
      month: '2026-07',
      personal: [
        { id: 'n1', type: 'card_transaction', date: '2026-07-10', card_name: 'Nubank', value: 100, status: 'revisar', context: 'pessoal', category: 'mercado' },
        { id: 'n2', type: 'card_transaction', date: '2026-07-10', card_name: 'Nubank', value: 250, status: 'pago', context: 'obra', category: 'investimento kitnets' },
        { id: 's1', type: 'card_transaction', date: '2026-07-15', card_name: 'Santander', value: 50, status: 'revisar', context: 'kitnets', category: 'internet' },
        { id: 'old', type: 'card_transaction', date: '2026-06-10', card_name: 'Nubank', value: 999, status: 'revisar' },
        { id: 'ignore', type: 'card_transaction', date: '2026-07-10', card_name: 'Nubank', value: 999, status: 'ignorar' },
      ],
    });

    expect(invoices).toHaveLength(2);
    expect(invoices.find((invoice) => invoice.cardName === 'Nubank')).toMatchObject({
      total: 350,
      personalTotal: 100,
      kitnetsTotal: 250,
      investmentTotal: 250,
      reviewCount: 1,
      itemCount: 2,
    });
    expect(invoices.find((invoice) => invoice.cardName === 'Santander')).toMatchObject({
      total: 50,
      kitnetsTotal: 50,
      reviewCount: 1,
    });
  });

  it('normaliza obra como origem kitnets para investimento feito no cartao pessoal', () => {
    expect(getEconomicOrigin({ context: 'obra' })).toBe('kitnets');
    expect(getEconomicOrigin({ context: 'kitnets' })).toBe('kitnets');
    expect(getEconomicOrigin({ context: 'pessoal' })).toBe('pessoal');
  });

  it('classifica investimento e financiamento sem depender da conta usada', () => {
    expect(getCostType({ context: 'obra', category: 'outros' })).toBe('investimento');
    expect(getCostType({ category: 'investimento kitnets' })).toBe('investimento');
    expect(getCostType({ category: 'financiamento' })).toBe('financiamento');
    expect(getCostType({ category: 'alimentacao' })).toBe('custeio');
  });

  it('consolida resumo de todas as faturas do mes', () => {
    const summary = buildCardInvoiceSummary([
      { total: 300, personalTotal: 100, kitnetsTotal: 200, investmentTotal: 200, reviewCount: 2 },
      { total: 50, personalTotal: 50, kitnetsTotal: 0, investmentTotal: 0, reviewCount: 1 },
    ]);

    expect(summary).toEqual({
      invoiceTotal: 350,
      personalTotal: 150,
      kitnetsTotal: 200,
      investmentTotal: 200,
      reviewCount: 3,
    });
  });
});
