import { describe, expect, it } from 'vitest';
import { buildDeepLink, getNextAdjustmentDate, notificationService } from './notificationService.js';
import { NOTIFICATION_ENTITY, NOTIFICATION_STATUS, NOTIFICATION_TYPE } from '../types/notification.types.js';
import { repository } from '../../../repository/index.js';
import { RECEIVABLE_STATUS } from '../../receivables/types/receivable.types.js';

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
    expect(overdueNotification.message).toContain('venceu em 10/06/2026');
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
    expect(adjustNotification.message).toContain('1 ano(s) em 01/08/2026');
    expect(adjustNotification.message).toContain('IGP-M ou IPCA');
  });

  it('confirmar "foi pago?" pela caixa de pendências cria o Pagamento (não só marca o status)', async () => {
    const receivable = await repository.create('Receivable', {
      competence: '2026-07',
      due_date: '2026-07-10',
      expected_value: 800,
      paid_value: 0,
      status: 'pendente',
      active: true,
    });

    await notificationService.confirmTarget(NOTIFICATION_ENTITY.RECEIVABLE, receivable.id);

    const receivables = await repository.list('Receivable');
    const updated = receivables.find((row) => row.id === receivable.id);
    expect(updated.status).toBe(RECEIVABLE_STATUS.PAID);
    expect(updated.paid_value).toBe(800);

    // O ponto central do bug: sem isso, o valor nunca aparecia no Extrato/
    // Visão Geral/Dashboard, que somam receita a partir de Payment, não de
    // Receivable.status.
    const payments = await repository.list('Payment');
    const payment = payments.find((row) => row.receivable_id === receivable.id);
    expect(payment).toBeTruthy();
    expect(payment.paid_value).toBe(800);
    expect(payment.receipt_number).toBeTruthy();
  });
});

// O caso que o Lucas viu: a kitnet 04 estava recebida no cadastro, mas
// "Pendências de hoje" continuava perguntando se o aluguel tinha sido pago.
// A notificação é uma fotografia do dia em que foi criada; quando o aluguel
// era recebido por OUTRA tela, nada voltava para fechá-la.
describe('notificationService.syncWithRegisteredData', () => {
  const pendingReceivable = () => repository.create('Receivable', {
    competence: '2026-08',
    due_date: '2026-08-10',
    expected_value: 950,
    paid_value: 0,
    status: 'pendente',
    active: true,
  });

  const notificationFor = (entityId) => repository.list('Notification')
    .then((rows) => rows.find((row) => row.entity_id === entityId));

  it('fecha o alerta do aluguel recebido por outra tela', async () => {
    const receivable = await pendingReceivable();
    await notificationService.generateDueNotifications('2026-08-11');
    expect((await notificationFor(receivable.id)).status).toBe(NOTIFICATION_STATUS.PENDING);

    // Recebido pela tela de Recebimentos — sem passar pela caixa de pendências.
    await repository.update('Receivable', receivable.id, { status: 'pago', paid_value: 950 });

    const { resolved } = await notificationService.syncWithRegisteredData('2026-08-11');

    expect(resolved.some((row) => row.entity_id === receivable.id)).toBe(true);
    expect((await notificationFor(receivable.id)).status).toBe(NOTIFICATION_STATUS.RESOLVED);
  });

  it('mantem de pe o alerta do aluguel que continua em aberto', async () => {
    const receivable = await pendingReceivable();
    await notificationService.generateDueNotifications('2026-08-11');

    const { resolved } = await notificationService.syncWithRegisteredData('2026-08-11');

    expect(resolved.some((row) => row.entity_id === receivable.id)).toBe(false);
    expect((await notificationFor(receivable.id)).status).toBe(NOTIFICATION_STATUS.PENDING);
  });

  it('fecha o alerta da conta paga em Despesas', async () => {
    const expense = await repository.create('Expense', {
      date: '2026-08-12',
      description: 'Mutua parcela 04/36',
      value: 1285.64,
      status: 'pendente',
      active: true,
    });
    await notificationService.generateDueNotifications('2026-08-11');

    await repository.update('Expense', expense.id, { status: 'pago' });
    await notificationService.syncWithRegisteredData('2026-08-11');

    expect((await notificationFor(expense.id)).status).toBe(NOTIFICATION_STATUS.RESOLVED);
  });

  it('reescreve o texto quando a data cadastrada muda', async () => {
    const receivable = await pendingReceivable();
    await notificationService.generateDueNotifications('2026-08-11');
    expect((await notificationFor(receivable.id)).message).toContain('10/08/2026');

    // O vencimento foi corrigido no cadastro depois do alerta criado.
    await repository.update('Receivable', receivable.id, { due_date: '2026-08-14' });
    const { refreshed } = await notificationService.syncWithRegisteredData('2026-08-11');

    expect(refreshed.some((row) => row.entity_id === receivable.id)).toBe(true);
    const updated = await notificationFor(receivable.id);
    expect(updated.message).toContain('14/08/2026');
    expect(updated.due_date).toBe('2026-08-14');
  });

  it('nao mexe em nota avulsa, que nao tem cadastro para conferir', async () => {
    const note = await repository.create('Notification', {
      title: 'Kit 09 ainda nao alugada',
      message: 'Lembrete solto, sem alvo no cadastro.',
      status: NOTIFICATION_STATUS.PENDING,
      scheduled_for: '2026-08-01',
      active: true,
    });

    await notificationService.syncWithRegisteredData('2026-08-11');

    const rows = await repository.list('Notification');
    expect(rows.find((row) => row.id === note.id).status).toBe(NOTIFICATION_STATUS.PENDING);
  });

  it('deixa criar alerta novo se a pendencia voltar depois de resolvida', async () => {
    const receivable = await pendingReceivable();
    await notificationService.generateDueNotifications('2026-08-11');

    await repository.update('Receivable', receivable.id, { status: 'pago', paid_value: 950 });
    await notificationService.syncWithRegisteredData('2026-08-11');

    // Estorno: voltou a ficar em aberto.
    await repository.update('Receivable', receivable.id, { status: 'pendente', paid_value: 0 });
    const { created } = await notificationService.generateDueNotifications('2026-08-11');

    // Sem isso, a notificação 'resolvida' bloquearia o alerta novo e a
    // pendência voltaria a ficar invisível.
    expect(created.some((row) => row.entity_id === receivable.id)).toBe(true);
  });
});
