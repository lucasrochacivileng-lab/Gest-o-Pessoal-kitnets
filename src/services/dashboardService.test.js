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
      receivable_id: 'r-dashboard-net-zero',
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

  // Os gráficos do dashboard levam para a tela detalhada quando tocados. Isso
  // só funciona se o dado carregar a CHAVE junto com o rótulo: "Ago" não diz o
  // ano e "Água" não é o que a tela de Despesas usa para filtrar.
  it('cada mês do gráfico carrega a chave YYYY-MM, não só o nome do mês', async () => {
    const data = await dashboardService.getDashboardData();

    expect(data.monthlyData).toHaveLength(6);
    data.monthlyData.forEach((row) => {
      expect(row.monthKey).toMatch(/^\d{4}-\d{2}$/);
    });
    // O último é sempre o mês atual — é dele que os cartões falam.
    expect(data.monthlyData[5].monthKey).toBe(data.currentMonth);
  });

  it('cada categoria carrega a chave crua além do rótulo traduzido', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await repository.create('Expense', {
      date: `${currentMonth}-07`,
      category: 'energia',
      value: 320,
      status: 'pago',
      active: true,
    });

    const data = await dashboardService.getDashboardData();
    const energia = data.categoryData.find((row) => row.category === 'energia');

    // Rótulo para ler, chave para filtrar — sem a chave, o toque no gráfico
    // abriria a tela de Despesas sem filtro nenhum.
    expect(energia).toBeTruthy();
    expect(energia.name).toBe('Energia');
  });

  it('unitStatus traz a situação do aluguel de cada unidade no mês', async () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const kitnet = await repository.create('Kitnet', {
      name: 'Kitnet Teste Mapa',
      status: 'ocupada',
      active: true,
    });
    const receivable = await repository.create('Receivable', {
      kitnet_id: kitnet.id,
      competence: currentMonth,
      due_date: `${currentMonth}-28`,
      expected_value: 950,
      paid_value: 0,
      status: 'pendente',
      active: true,
    });

    const data = await dashboardService.getDashboardData();
    const unit = data.unitStatus.find((row) => row.id === kitnet.id);

    expect(unit).toBeTruthy();
    // O id do recebível é o que permite abrir direto a tela de registrar.
    expect(unit.receivableId).toBe(receivable.id);
    expect(unit.rentStatus).toBe('pendente');
    expect(unit.outstanding).toBe(950);
  });

  it('unidade sem cobrança no mês fica sem recebível, não quebra o mapa', async () => {
    const kitnet = await repository.create('Kitnet', {
      name: 'Kitnet Teste Vaga',
      status: 'vaga',
      active: true,
    });

    const data = await dashboardService.getDashboardData();
    const unit = data.unitStatus.find((row) => row.id === kitnet.id);

    expect(unit).toMatchObject({ occupancy: 'vaga', rentStatus: '', receivableId: '', outstanding: 0 });
  });
});
