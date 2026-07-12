import { describe, expect, it } from 'vitest';
import { buildExtraIncomeRows, buildExtraIncomeSummary } from './extraIncomeService.js';

describe('extraIncomeService', () => {
  it('mostra projetos e pericias apenas no mes selecionado', () => {
    const rows = buildExtraIncomeRows({
      month: '2026-07',
      projects: [
        { id: 'p1', client: 'Lucas Engeomax', project_type: 'estrutural', value: 5000, status: 'recebido', received_date: '2026-07-08' },
        { id: 'p2', client: 'Futuro', project_type: 'hidro', value: 3000, status: 'entregue', expected_payment_date: '2026-08-10' },
      ],
      expertReports: [
        { id: 'e1', client: 'Cliente Pericia', report_type: 'avaliacao', fee_value: 2000, status: 'entregue', expected_payment_date: '2026-07-20' },
      ],
    });

    expect(rows.map((row) => row.label)).toEqual([
      'Lucas Engeomax - estrutural',
      'Cliente Pericia - avaliacao',
    ]);
    expect(rows.find((row) => row.label.includes('Futuro'))).toBeUndefined();
  });

  it('soma recebido e previsto separadamente', () => {
    const summary = buildExtraIncomeSummary([
      { value: 5000, status: 'recebido' },
      { value: 2000, status: 'previsto' },
    ]);

    expect(summary).toEqual({
      total: 7000,
      received: 5000,
      pending: 2000,
      count: 2,
    });
  });

  it('prioriza a data real de recebimento sobre a previsao', () => {
    const rows = buildExtraIncomeRows({
      month: '2026-06',
      projects: [
        {
          id: 'p1',
          client: 'CF Ribeiro',
          project_type: 'complementares',
          value: 2000,
          status: 'recebido',
          expected_payment_date: '2026-07-12',
          received_date: '2026-06-26',
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe('2026-06-26');
  });
});
