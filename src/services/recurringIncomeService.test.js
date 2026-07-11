import { describe, expect, it } from 'vitest';
import { buildRecurringIncomes, lastBusinessDayOf } from './recurringIncomeService.js';

describe('lastBusinessDayOf', () => {
  it('recua de fim de semana para o ultimo dia util (sexta)', () => {
    // 31/01/2026 cai num sabado -> ultimo dia util = 30 (sexta).
    expect(lastBusinessDayOf('2026-01')).toBe(30);
    // 31/05/2026 cai num domingo -> ultimo dia util = 29 (sexta).
    expect(lastBusinessDayOf('2026-05')).toBe(29);
  });

  it('mantem o ultimo dia quando ja e dia util', () => {
    // 31/08/2026 cai numa segunda -> continua 31.
    expect(lastBusinessDayOf('2026-08')).toBe(31);
  });
});

describe('buildRecurringIncomes', () => {
  const salario = {
    id: 's1',
    type: 'income',
    description: 'Salario servidor',
    value: 9000,
    context: 'trabalho',
    category: 'salario',
    recurring: true,
    date: '2026-06-30',
    status: 'recebido',
  };

  it('replica a renda recorrente no ultimo dia util, como previsto', () => {
    const [gerado] = buildRecurringIncomes([salario], '2026-08');
    expect(gerado).toMatchObject({
      date: '2026-08-31',
      type: 'income',
      description: 'Salario servidor',
      value: 9000,
      context: 'trabalho',
      status: 'previsto',
      recurring: true,
    });
  });

  it('nao duplica se ja houver a renda no mes (mesmo lancada a mao)', () => {
    const jaNoMes = { ...salario, id: 's2', date: '2026-08-31', status: 'previsto' };
    expect(buildRecurringIncomes([salario, jaNoMes], '2026-08')).toHaveLength(0);
  });

  it('ignora rendas nao recorrentes e despesas', () => {
    const rows = [
      { ...salario, recurring: false },
      { type: 'expense', description: 'Mercado', value: 300, recurring: true, date: '2026-06-01' },
    ];
    expect(buildRecurringIncomes(rows, '2026-08')).toHaveLength(0);
  });

  it('usa o lancamento mais recente como modelo do valor', () => {
    const antigo = { ...salario, id: 'old', date: '2026-05-29', value: 8800 };
    const recente = { ...salario, id: 'new', date: '2026-07-31', value: 9100 };
    const [gerado] = buildRecurringIncomes([antigo, recente], '2026-08');
    expect(gerado.value).toBe(9100);
  });
});
