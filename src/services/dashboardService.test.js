import { describe, expect, it } from 'vitest';
import { dashboardService } from './dashboardService';
import { repository } from '../repository/index.js';

describe('dashboardService', () => {
  it('conta recebível parcial com vencimento passado como vencido (mesma regra de Recebimentos)', async () => {
    // status 'parcial' mas o due_date já passou há muito tempo — a tela de
    // Recebimentos (getReceivableStatus) já tratava isso como vencido; o
    // dashboard tinha sua própria lógica que só olhava 'vencido'/'pendente'
    // e deixava esse caso de fora da contagem/valor em atraso.
    await repository.create('Receivable', {
      competence: '2020-01',
      due_date: '2020-01-10',
      expected_value: 800,
      paid_value: 300,
      status: 'parcial',
      active: true,
    });

    const data = await dashboardService.getDashboardData();

    expect(data.overdue).toBeGreaterThanOrEqual(1);
    expect(data.overdueValue).toBeGreaterThanOrEqual(500);
  });

  it('não conta net_value 0 de propósito como o paid_value cheio na receita do mês', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await repository.create('Payment', {
      payment_date: `${currentMonth}-05`,
      paid_value: 800,
      net_value: 0,
      active: true,
    });

    const data = await dashboardService.getDashboardData();

    expect(data.revenue).toBe(0);
  });
});
