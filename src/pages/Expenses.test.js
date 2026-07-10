import { describe, expect, it } from 'vitest';
import { filterExpensesByCompetence, groupExpensesByPaymentMethod } from './Expenses.jsx';

describe('filterExpensesByCompetence', () => {
  it('mostra apenas despesas do mes selecionado', () => {
    const rows = [
      { id: 'jun-internet', date: '2026-06-01', description: 'Internet' },
      { id: 'jul-internet', date: '2026-07-01', description: 'Internet' },
      { id: 'sem-data', description: 'Sem data' },
    ];

    expect(filterExpensesByCompetence(rows, '2026-06').map((row) => row.id)).toEqual(['jun-internet']);
    expect(filterExpensesByCompetence(rows, '2026-07').map((row) => row.id)).toEqual(['jul-internet']);
  });
});

describe('groupExpensesByPaymentMethod', () => {
  it('separa boleto de pix por trecho, caindo em outros quando nao reconhece', () => {
    const rows = [
      { payment_method: 'Boleto', value: 129.90 },
      { payment_method: 'boleto bancário', value: 800 },
      { payment_method: 'Pix', value: 350 },
      { payment_method: 'Dinheiro', value: 50 },
      { payment_method: '', value: 10 },
    ];

    const summary = groupExpensesByPaymentMethod(rows);

    expect(summary.boleto).toBe(929.90);
    expect(summary.pix).toBe(350);
    expect(summary.outros).toBe(60);
  });

  it('nao inflar quando payment_method esta ausente e value e zero', () => {
    const summary = groupExpensesByPaymentMethod([{ payment_method: 'Pix', value: 0 }]);
    expect(summary.pix).toBe(0);
  });
});
