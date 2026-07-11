import { describe, expect, it } from 'vitest';
import {
  buildCardInvoices,
  buildCardInvoiceSummary,
  getCostType,
  getEconomicOrigin,
  matchesInvoiceView,
  selectInvoiceItems,
} from './cardInvoiceService.js';

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

  it('recorta os itens por origem e por investimento/financiamento', () => {
    expect(matchesInvoiceView({ origin: 'pessoal' }, 'pessoal')).toBe(true);
    expect(matchesInvoiceView({ origin: 'kitnets' }, 'pessoal')).toBe(false);
    expect(matchesInvoiceView({ origin: 'kitnets' }, 'kitnets')).toBe(true);
    expect(matchesInvoiceView({ costType: 'investimento' }, 'investimento')).toBe(true);
    expect(matchesInvoiceView({ costType: 'financiamento' }, 'investimento')).toBe(true);
    expect(matchesInvoiceView({ costType: 'custeio' }, 'investimento')).toBe(false);
    // Sem view, tudo passa (comportamento "por cartão" fica com selectedInvoice).
    expect(matchesInvoiceView({ origin: 'pessoal' }, '')).toBe(true);
  });

  it('detalha por cartao selecionado quando nao ha recorte de resumo', () => {
    const selectedInvoice = { cardName: 'Nubank', items: [{ id: 'a' }, { id: 'b' }] };
    const items = selectInvoiceItems({ invoices: [selectedInvoice], selectedInvoice, view: '' });
    expect(items.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('um recorte de resumo atravessa TODAS as faturas, nao so a selecionada', () => {
    const invoices = [
      { cardName: 'Nubank', items: [
        { id: 'n-pessoal', date: '2026-07-02', origin: 'pessoal', costType: 'custeio' },
        { id: 'n-obra', date: '2026-07-01', origin: 'kitnets', costType: 'investimento' },
      ] },
      { cardName: 'Santander', items: [
        { id: 's-kit', date: '2026-07-03', origin: 'kitnets', costType: 'custeio' },
      ] },
    ];

    const kitnets = selectInvoiceItems({ invoices, selectedInvoice: invoices[0], view: 'kitnets' });
    // Pega itens de kitnets dos dois cartões e ordena por data.
    expect(kitnets.map((item) => item.id)).toEqual(['n-obra', 's-kit']);

    const investimento = selectInvoiceItems({ invoices, selectedInvoice: invoices[0], view: 'investimento' });
    expect(investimento.map((item) => item.id)).toEqual(['n-obra']);
  });
});
