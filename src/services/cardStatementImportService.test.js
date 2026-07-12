import { describe, expect, it } from 'vitest';
import {
  buildInstallmentPreview,
  classifyTransaction,
  parseDate,
  parseMoney,
  parseStatementRows,
  summarizeByCategory,
} from './cardStatementImportService.js';

describe('cardStatementImportService', () => {
  it('detecta colunas comuns de fatura e parcelas no texto', () => {
    const rows = parseStatementRows([
      {
        Data: '08/07/2026',
        Descricao: 'Mercado Pago Ar condicionado Kit 08 5/21',
        Valor: '199,90',
        Cartao: 'Mercado Pago Pai',
      },
    ]);

    expect(rows).toMatchObject([
      {
        purchase_date: '2026-07-08',
        description: 'Mercado Pago Ar condicionado Kit 08 5/21',
        value: 199.9,
        card_name: 'Mercado Pago Pai',
        installment_current: 5,
        installment_total: 21,
      },
    ]);
  });

  it('normaliza cartao adicional para o titular (Santander 7535 -> 7909)', () => {
    const rows = parseStatementRows([
      { Data: '10/07/2026', Descricao: 'CLARO FLEX', Valor: '39,99', Cartao: 'Santander 7535' },
      { Data: '10/07/2026', Descricao: 'Compra qualquer', Valor: '100,00', Cartao: 'Santander 7909' },
    ]);

    expect(rows.map((row) => row.card_name)).toEqual(['Santander 7909', 'Santander 7909']);
  });

  it('interpreta CSV do Nubank e ignora pagamentos recebidos', () => {
    const rows = parseStatementRows([
      {
        date: '2026-07-01',
        title: 'Ronaldo Ferragista - Parcela 1/2',
        amount: '130,00',
      },
      {
        date: '2026-06-10',
        title: 'Pagamento recebido',
        amount: '- 5.581,44',
      },
    ], { defaultCardName: 'Nubank' });

    expect(rows).toMatchObject([
      {
        purchase_date: '2026-07-01',
        description: 'Ronaldo Ferragista - Parcela 1/2',
        value: 130,
        card_name: 'Nubank',
        installment_current: 1,
        installment_total: 2,
      },
    ]);
  });

  it('aceita datas americanas geradas por planilhas sem criar mês inválido', () => {
    expect(parseDate('6/30/26')).toBe('2026-06-30');
    expect(parseDate('30/6/26')).toBe('2026-06-30');
  });

  it('gera parcelas futuras a partir da parcela atual', () => {
    const preview = buildInstallmentPreview({
      statementMonth: '2026-07',
      dueDay: 10,
      transactions: [
        {
          purchase_date: '2026-07-08',
          description: 'Mercado Pago Ar condicionado Kit 08',
          value: 250,
          card_name: 'Mercado Pago Pai',
          installment_current: 20,
          installment_total: 21,
        },
      ],
      kitnets: [{ id: 'k8', name: 'Kitnet 08' }],
    });

    expect(preview).toHaveLength(2);
    expect(preview[0]).toMatchObject({
      date: '2026-07-10',
      installment: '20/21',
      category: 'investimento kitnets',
      context: 'obra',
      segment: 'kitnets', // gasto de obra começa como investimento nas kitnets
      kitnet_id: 'k8',
    });
    expect(preview[1]).toMatchObject({ date: '2026-08-10', installment: '21/21' });
  });

  it('compra sem classificacao de obra comeca no segmento pessoal', () => {
    const preview = buildInstallmentPreview({
      statementMonth: '2026-07',
      dueDay: 10,
      transactions: [
        {
          purchase_date: '2026-07-08',
          description: 'Padaria do bairro',
          value: 30,
          card_name: 'Nubank',
          installment_current: 1,
          installment_total: 1,
        },
      ],
    });

    expect(preview[0].segment).toBe('pessoal');
  });

  it('marca duplicidade por data, descricao, valor, cartao e parcela', () => {
    const preview = buildInstallmentPreview({
      statementMonth: '2026-07',
      dueDay: 10,
      transactions: [
        {
          purchase_date: '2026-07-08',
          description: 'Posto combustivel',
          value: 100,
          card_name: 'Nubank',
          installment_current: 1,
          installment_total: 1,
        },
      ],
      existingTransactions: [
        {
          origin_hash: 'nubank|2026-07-08|posto combustivel|100.00|1/1',
        },
      ],
    });

    expect(preview[0].duplicate).toBe(true);
  });

  it('interpreta valores acima de R$ 1 milhão (dois separadores de milhar)', () => {
    expect(parseMoney('1.234.567,89')).toBeCloseTo(1234567.89);
    expect(parseMoney('12.345,67')).toBeCloseTo(12345.67);
    expect(parseMoney('R$ 1.000.000,00')).toBeCloseTo(1000000);
  });

  it('interpreta valores no formato americano (vírgula de milhar, ponto decimal)', () => {
    expect(parseMoney('1,234,567.89')).toBeCloseTo(1234567.89);
  });

  it('nao confunde Kit 01 com Kitnet 15 (mesmo prefixo " 1")', () => {
    const preview = buildInstallmentPreview({
      statementMonth: '2026-07',
      dueDay: 10,
      transactions: [
        {
          purchase_date: '2026-07-08',
          description: 'Loja Kit 01 Materiais',
          value: 100,
          card_name: 'Nubank',
          installment_current: 1,
          installment_total: 1,
        },
      ],
      kitnets: [
        { id: 'k15', name: 'Kitnet 15' },
        { id: 'k1', name: 'Kitnet 01' },
      ],
    });

    expect(preview[0].kitnet_id).toBe('k1');
  });

  it('nao descarta a compra quando a parcela total vem menor que a atual (dado malformado)', () => {
    const preview = buildInstallmentPreview({
      statementMonth: '2026-07',
      dueDay: 10,
      transactions: [
        {
          purchase_date: '2026-07-08',
          description: 'Compra com parcela malformada',
          value: 300,
          card_name: 'Nubank',
          installment_current: 5,
          installment_total: 3,
        },
      ],
    });

    expect(preview.length).toBeGreaterThan(0);
    expect(preview[0].installment).toBe('5/5');
  });

  it('classifica gastos conhecidos e soma por categoria', () => {
    expect(classifyTransaction('Posto Shell')).toEqual({ category: 'combustivel', context: 'pessoal' });
    expect(classifyTransaction('NuTag*QQP8C28')).toEqual({ category: 'transporte', context: 'pessoal' });
    expect(classifyTransaction('Casa das Tintas')).toEqual({ category: 'material de construcao', context: 'obra' });
    expect(classifyTransaction('Ki Kitandas')).toEqual({ category: 'mercado', context: 'pessoal' });
    expect(classifyTransaction('Marcaobarbearia')).toEqual({ category: 'lazer', context: 'pessoal' });
    expect(classifyTransaction('Fotus Energia Solar')).toEqual({ category: 'investimento kitnets', context: 'obra' });

    expect(summarizeByCategory([
      { category: 'combustivel', value: 50 },
      { category: 'combustivel', value: 70 },
      { category: 'mercado', value: 100 },
    ])).toEqual({ combustivel: 120, mercado: 100 });
  });
});
