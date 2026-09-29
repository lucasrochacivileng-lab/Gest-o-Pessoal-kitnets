import { describe, expect, it } from 'vitest';
import { buildMonthlyAnalysis } from './monthlyAnalysisService.js';
import { buildSegmentConsolidation } from './segmentConsolidationService.js';
import { buildCategoryReport } from './categoryReportService.js';
import { buildCashflow } from './cashflowService.js';
import { buildStatement } from './statementService.js';

const data = {
  payments: [{ id: 'p', receivable_id: 'r', payment_date: '2026-08-02', net_value: 1000 }],
  expenses: [
    { id: 'e', segment: 'pericias', status: 'pago', category: 'viagem', date: '2026-08-05', value: 200 },
    { id: 'pending', status: 'pendente', date: '2026-08-05', value: 9999 },
  ],
  personal: [
    { id: 'salary', type: 'income', context: 'trabalho', status: 'recebido', date: '2026-08-03', value: 2000 },
    { id: 'card', type: 'card_transaction', segment: 'projetos', status: 'pago', category: 'software', date: '2026-08-05', value: 150 },
    { id: 'invoice', type: 'card_payment', status: 'pago', date: '2026-08-05', value: 150 },
    { id: 'review', type: 'card_transaction', status: 'revisar', date: '2026-08-05', value: 500 },
    { id: 'transfer', type: 'transfer', status: 'pago', date: '2026-08-05', value: 3000 },
  ],
  projects: [{ id: 'project', status: 'recebido', received_date: '2026-08-10', value: 800 }],
};
describe('totais integrados e comparação mensal', () => {
  it('usa o mesmo resultado em análise, consolidado, categorias, caixa e extrato', () => {
    const a = buildMonthlyAnalysis(data, { month: '2026-08' });
    expect(a.totals).toEqual({ income: 3800, expense: 350, result: 3450 });
    expect(buildSegmentConsolidation({ ...data, monthKey: '2026-08' }).global).toEqual(a.totals);
    expect(buildCategoryReport({ ...data, month: '2026-08' }).grandTotal).toBe(a.totals.expense);
    expect(buildCashflow({ ...data, monthKey: '2026-08' }).finalResult).toBe(a.totals.result);
    expect(buildStatement({ ...data, monthKey: '2026-08' }).balance).toBe(a.totals.result);
    expect(a.segments.find((r) => r.key === 'kitnets').expense).toBe(0);
    expect(a.segments.find((r) => r.key === 'pericias').expense).toBe(200);
    expect(a.reviewCount).toBe(1);
  });
  it('recorta categorias e composição pelo segmento sem misturar meio de pagamento', () => {
    const a = buildMonthlyAnalysis(data, { month: '2026-08', segment: 'projetos' });
    expect(a.totals).toEqual({ income: 800, expense: 150, result: 650 });
    expect(a.items).toHaveLength(2);
    expect(a.categories[0].key).toBe('software');
    expect(buildCategoryReport({ ...data, month: '2026-08', segment: 'projetos' }).grandTotal).toBe(150);
  });
  it('compara mês em andamento até o mesmo dia sem percentual infinito', () => {
    const a = buildMonthlyAnalysis({ personal: [
      { type: 'income', date: '2026-08-10', status: 'recebido', value: 100 },
      { type: 'income', date: '2026-08-25', status: 'recebido', value: 1000 },
      { type: 'income', date: '2026-09-10', status: 'recebido', value: 150 },
    ] }, { month: '2026-09', today: '2026-09-15' });
    expect(a.comparison.income).toEqual({ difference: 50, percent: 50 });
    expect(a.comparison.expense.percent).toBeNull();
    expect(a.trend).toHaveLength(12);
    expect(a.trend[0].month).toBe('2025-10');
  });
  it('exclui inativos/estornados e conserva centavos', () => {
    const a = buildMonthlyAnalysis({ expenses: [
      { date: '2026-08-01', status: 'pago', value: 100, active: false },
      { date: '2026-08-01', status: 'pago', value: 0.1 },
      { date: '2026-08-01', status: 'pago', value: 0.2 },
    ], payments: [{ receivable_id: 'r', payment_date: '2026-08-01', net_value: 1000, status: 'estornado' }] }, { month: '2026-08' });
    expect(a.totals).toEqual({ income: 0, expense: 0.3, result: -0.3 });
  });
});
