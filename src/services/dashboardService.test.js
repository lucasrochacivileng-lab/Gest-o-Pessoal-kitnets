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

  it('gráfico de despesas por categoria mostra só o mês atual, não o histórico inteiro', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Despesa de anos atrás numa categoria exclusiva, pra detectar se ela
    // vaza pro gráfico do mês (o gráfico fica ao lado de "Despesas do mês"
    // — histórico inteiro ali seria enganoso e só cresceria com o tempo).
    await repository.create('Expense', {
      date: '2020-01-05',
      category: 'categoria-antiga-teste',
      value: 5000,
      status: 'pago',
      active: true,
    });
    await repository.create('Expense', {
      date: `${currentMonth}-05`,
      category: 'agua',
      value: 110,
      status: 'pago',
      active: true,
    });

    const data = await dashboardService.getDashboardData();

    expect(data.categoryData.some((row) => row.name.toLowerCase().includes('categoria-antiga-teste'))).toBe(false);
    expect(data.categoryData.some((row) => row.name === 'Água')).toBe(true);
  });
});
