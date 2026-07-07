import { describe, expect, it } from 'vitest';
import { buildDeepLink, notificationService } from './notificationService.js';
import { NOTIFICATION_ENTITY } from '../types/notification.types.js';
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
});
