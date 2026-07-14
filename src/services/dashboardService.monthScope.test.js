import { describe, expect, it } from 'vitest';
import { dashboardService } from './dashboardService';
import { repository } from '../repository/index.js';

describe('dashboardService - previsao mensal', () => {
  it('ignora parcelas futuras na receita prevista e na quantidade a vencer', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dueDate = `${currentMonth}-${String(lastDay).padStart(2, '0')}`;
    const futureDate = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const futureMonth = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;

    const baseline = await dashboardService.getDashboardData();

    await repository.create('Receivable', {
      competence: futureMonth,
      due_date: `${futureMonth}-10`,
      expected_value: 9000,
      paid_value: 0,
      status: 'pendente',
      active: true,
    });

    const afterFutureInstallment = await dashboardService.getDashboardData();

    expect(afterFutureInstallment.receitaPrevista).toBe(baseline.receitaPrevista);
    expect(afterFutureInstallment.upcoming).toBe(baseline.upcoming);

    await repository.create('Receivable', {
      competence: currentMonth,
      due_date: dueDate,
      expected_value: 1000,
      paid_value: 0,
      status: 'pendente',
      active: true,
    });

    const afterCurrentInstallment = await dashboardService.getDashboardData();

    expect(afterCurrentInstallment.receitaPrevista).toBe(baseline.receitaPrevista + 1000);
    expect(afterCurrentInstallment.upcoming).toBe(baseline.upcoming + 1);
  });
});
