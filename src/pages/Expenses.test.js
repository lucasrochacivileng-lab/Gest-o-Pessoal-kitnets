import { describe, expect, it } from 'vitest';
import { filterExpensesByCompetence } from './Expenses.jsx';

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
