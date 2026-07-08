import { describe, expect, it } from 'vitest';
import { buildDeepLink, getNextAdjustmentDate, notificationService } from './notificationService.js';
import { NOTIFICATION_ENTITY, NOTIFICATION_TYPE } from '../types/notification.types.js';
import { repository } from '../../../repository/index.js';

describe('notificationService', () => {
  it('builds deep links for supported notification targets', () => {
    expect(buildDeepLink(NOTIFICATION_ENTITY.EXPENSE, 'e1')).toBe('/despesas/e1');
    expect(buildDeepLink(NOTIFICATION_ENTITY.RECEIVABLE, 'r1')).toBe('/recebimentos/r1');
    expect(buildDeepLink(NOTIFICATION_ENTITY.CONTRACT, 'c1')).toBe('/contratos/c1');
  });

  it('generates due notifications without sending real emails', async () => {
    const expense = await repository.create('Expense', {
      date: '2026-07-08',
      category: 'internet',
      description: 'Internet teste',
      value: 100,
      status: 'pendente',
      active: true,
    });

    const result = await notificationService.generateDueNotifications('2026-07-07');

    expect(result.created.some((notification) => notification.entity_id === expense.id)).toBe(true);
    expect(result.created[0].status).toBe('pendente');
  });

  it('gera alerta para aluguel já vencido perguntando se foi pago', async () => {
    const receivable = await repository.create('Receivable', {
      competence: '2026-06',
      due_date: '2026-06-10',
      expected_value: 800,
      status: 'pendente',
      active: true,
    });

    const result = await notificationService.generateDueNotifications('2026-07-08');
    const overdueNotification = result.created.find((notification) => notification.entity_id === receivable.id);

    expect(overdueNotification).toBeTruthy();
    expect(overdueNotification.title).toContain('Aluguel vencido');
    expect(overdueNotification.message).toContain('venceu em 2026-06-10');
    expect(overdueNotification.message).toContain('Foi pago?');
  });

  it('calcula a próxima data de reajuste anual do contrato', () => {
    // aniversário deste ano ainda não passou
    expect(getNextAdjustmentDate('2025-08-01', '2026-07-07')).toBe('2026-08-01');
    // aniversário deste ano já passou -> ano que vem
    expect(getNextAdjustmentDate('2025-06-01', '2026-07-07')).toBe('2027-06-01');
    // contrato novo (menos de 1 ano) -> primeiro aniversário
    expect(getNextAdjustmentDate('2026-03-10', '2026-07-07')).toBe('2027-03-10');
    // sem data de início
    expect(getNextAdjustmentDate('', '2026-07-07')).toBe('');
  });

  it('gera lembrete de reajuste anual para contrato perto do aniversário', async () => {
    const contract = await repository.create('Contract', {
      status: 'ativo',
      start_date: '2025-08-01',
      end_date: '2028-08-01',
      due_day: 10,
      rent_value: 800,
      active: true,
    });

    const result = await notificationService.generateDueNotifications('2026-07-07');
    const adjustNotification = result.created.find((notification) => (
      notification.type === NOTIFICATION_TYPE.CONTRACT_ADJUST
      && notification.entity_id === contract.id
    ));

    expect(adjustNotification).toBeTruthy();
    expect(adjustNotification.due_date).toBe('2026-08-01');
    expect(adjustNotification.message).toContain('1 ano(s)');
    expect(adjustNotification.message).toContain('IGP-M ou IPCA');
  });
});
