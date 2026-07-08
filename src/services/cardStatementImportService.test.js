import { describe, expect, it } from 'vitest';
import {
  buildInstallmentPreview,
  classifyTransaction,
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
      kitnet_id: 'k8',
    });
    expect(preview[1]).toMatchObject({ date: '2026-08-10', installment: '21/21' });
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

  it('classifica gastos conhecidos e soma por categoria', () => {
    expect(classifyTransaction('Posto Shell')).toEqual({ category: 'combustivel', context: 'pessoal' });
    expect(classifyTransaction('Fotus Energia Solar')).toEqual({ category: 'investimento kitnets', context: 'obra' });

    expect(summarizeByCategory([
      { category: 'combustivel', value: 50 },
      { category: 'combustivel', value: 70 },
      { category: 'mercado', value: 100 },
    ])).toEqual({ combustivel: 120, mercado: 100 });
  });
});
