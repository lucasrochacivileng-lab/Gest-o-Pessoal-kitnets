import { describe, expect, it } from 'vitest';
import { buildRecurringExpenses } from './recurringExpenseService.js';

const expense = (overrides = {}) => ({
  id: 'e1',
  date: '2026-06-05',
  category: 'agua',
  type: 'fixa',
  description: 'Água das kitnets',
  value: 110,
  status: 'pago',
  recurring: true,
  active: true,
  ...overrides,
});

describe('buildRecurringExpenses', () => {
  it('replica despesa recorrente para o mês alvo mantendo o dia', () => {
    const result = buildRecurringExpenses([expense()], '2026-07');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: '2026-07-05',
      description: 'Água das kitnets',
      value: 110,
      status: 'pendente',
      recurring: true,
    });
  });

  it('não duplica se a despesa já foi lançada no mês', () => {
    const rows = [
      expense(),
      expense({ id: 'e2', date: '2026-07-05', status: 'pendente' }),
    ];

    expect(buildRecurringExpenses(rows, '2026-07')).toHaveLength(0);
  });

  it('ignora despesas não marcadas como recorrentes', () => {
    expect(buildRecurringExpenses([expense({ recurring: false })], '2026-07')).toHaveLength(0);
  });

  it('usa o lançamento mais recente como modelo quando há vários', () => {
    const rows = [
      expense({ id: 'e1', date: '2026-05-05', value: 100 }),
      expense({ id: 'e2', date: '2026-06-05', value: 120 }),
    ];

    const result = buildRecurringExpenses(rows, '2026-07');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(120);
  });

  it('ajusta o dia para o fim do mês quando não existe (31 → fevereiro)', () => {
    const result = buildRecurringExpenses([expense({ date: '2026-01-31' })], '2026-02');

    expect(result[0].date).toBe('2026-02-28');
  });

  it('trata "Água" de kitnets diferentes como recorrentes independentes (não funde numa só)', () => {
    const rows = [
      expense({ id: 'k1-agua', kitnet_id: 'k1', date: '2026-06-05', value: 90 }),
      expense({ id: 'k2-agua', kitnet_id: 'k2', date: '2026-05-05', value: 150 }),
    ];

    const result = buildRecurringExpenses(rows, '2026-07');

    expect(result).toHaveLength(2);
    expect(result.find((row) => row.kitnet_id === 'k1').value).toBe(90);
    expect(result.find((row) => row.kitnet_id === 'k2').value).toBe(150);
  });

  it('já ter a água da Kitnet 01 lançada no mês não impede gerar a da Kitnet 02', () => {
    const rows = [
      expense({ id: 'k1-agua', kitnet_id: 'k1', date: '2026-06-05', value: 90 }),
      expense({ id: 'k1-agua-jul', kitnet_id: 'k1', date: '2026-07-05', value: 90, status: 'pendente' }),
      expense({ id: 'k2-agua', kitnet_id: 'k2', date: '2026-06-05', value: 150 }),
    ];

    const result = buildRecurringExpenses(rows, '2026-07');

    expect(result).toHaveLength(1);
    expect(result[0].kitnet_id).toBe('k2');
  });
});
