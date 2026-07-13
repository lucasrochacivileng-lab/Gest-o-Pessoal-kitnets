import { describe, expect, it } from 'vitest';
import { buildCategoryReport, buildCategoryTrend, categoryLabel } from './categoryReportService.js';

describe('buildCategoryReport', () => {
  it('soma despesas kitnets + pessoais por categoria no mês', () => {
    const result = buildCategoryReport({
      month: '2026-10',
      expenses: [
        { category: 'material', value: 3000, date: '2026-10-05', status: 'pago' },
        { category: 'agua', value: 110, date: '2026-10-05', status: 'pago' },
        { category: 'material', value: 500, date: '2026-09-05', status: 'pago' },
      ],
      personal: [
        { type: 'expense', category: 'alimentacao', value: 1000, date: '2026-10-01', status: 'pago' },
        { type: 'expense', category: 'combustivel', value: 800, date: '2026-10-20', status: 'pago' },
        { type: 'income', category: 'salario', value: 8000, date: '2026-10-05', status: 'recebido' },
      ],
    });

    expect(result.grandTotal).toBe(4910);
    expect(result.rows[0]).toMatchObject({ label: 'Material de obra', total: 3000 });
    expect(result.rows.find((r) => r.category === 'alimentacao').total).toBe(1000);
    // receita não entra em gasto por categoria
    expect(result.rows.find((r) => r.category === 'salario')).toBeUndefined();
  });

  it('não conta despesa recorrente ainda pendente como gasto realizado (só por ser recorrente)', () => {
    const result = buildCategoryReport({
      month: '2026-10',
      expenses: [
        { category: 'agua', value: 110, date: '2026-10-05', status: 'pendente', recurring: true },
        { category: 'internet', value: 100, date: '2026-10-05', status: 'pago', recurring: true },
      ],
    });

    // Só a paga entra — a mesma regra usada pela "Caixa geral do mês", que
    // também so conta despesas com status 'pago'. Antes, a recorrente
    // pendente também era somada aqui, divergindo dos dois relatórios.
    expect(result.grandTotal).toBe(100);
    expect(result.rows.find((r) => r.category === 'agua')).toBeUndefined();
  });

  it('ignora transações de cartão ainda em revisão', () => {
    const result = buildCategoryReport({
      month: '2026-10',
      personal: [
        { type: 'card_transaction', category: 'alimentacao', value: 999, date: '2026-10-01', status: 'revisar' },
        { type: 'card_transaction', category: 'combustivel', value: 200, date: '2026-10-02', status: 'pago' },
      ],
    });

    expect(result.grandTotal).toBe(200);
  });

  it('não trata transferência para investimento como gasto', () => {
    const result = buildCategoryReport({
      month: '2026-07',
      personal: [
        { type: 'transfer', category: 'Aplicação CDB', value: 18000, date: '2026-07-02', status: 'pago' },
        { type: 'expense', category: 'internet', value: 100, date: '2026-07-03', status: 'pago' },
      ],
    });

    expect(result.grandTotal).toBe(100);
    expect(result.rows.find((row) => row.category === 'aplicação cdb')).toBeUndefined();
  });

  it('calcula o percentual de cada categoria', () => {
    const result = buildCategoryReport({
      month: '2026-10',
      expenses: [
        { category: 'material', value: 750, date: '2026-10-05', status: 'pago' },
        { category: 'agua', value: 250, date: '2026-10-05', status: 'pago' },
      ],
    });

    expect(result.rows[0].share).toBeCloseTo(0.75);
    expect(result.rows[1].share).toBeCloseTo(0.25);
  });

  it('trend soma por mês, filtrando por categoria quando pedido', () => {
    const expenses = [
      { category: 'combustivel', value: 800, date: '2026-08-10', status: 'pago' },
      { category: 'combustivel', value: 900, date: '2026-09-10', status: 'pago' },
      { category: 'agua', value: 110, date: '2026-09-05', status: 'pago' },
    ];

    const trend = buildCategoryTrend({ expenses, months: ['2026-08', '2026-09'], category: 'combustivel' });
    expect(trend).toEqual([
      { month: '2026-08', total: 800 },
      { month: '2026-09', total: 900 },
    ]);
  });
});

describe('categoryLabel', () => {
  it('traduz chaves conhecidas e capitaliza desconhecidas', () => {
    expect(categoryLabel('agua')).toBe('Água');
    expect(categoryLabel('viagem')).toBe('Viagem');
    expect(categoryLabel('')).toBe('Sem categoria');
  });
});
