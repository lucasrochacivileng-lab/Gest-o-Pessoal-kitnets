import { beforeEach, describe, expect, it } from 'vitest';
import { localClient } from './localClient.js';

const rent = { id: 'rent', active: true, expected_value: 800, paid_value: 0, status: 'pendente' };
const values = { payment_id: 'payment', paid_value: 800, discount: 50, fine: 0, interest: 0, payment_date: '2026-09-28' };

describe('operações financeiras e notificações locais', () => {
  beforeEach(async () => {
    await localClient.importBackup({ Receivable: [rent], Payment: [], Notification: [
      { id: 'alert', active: true, entity: 'Receivable', entity_id: 'rent', type: 'rent_due', status: 'erro' },
    ] });
  });

  it('baixa, corrige e estorna mantendo saldo, alerta e histórico coerentes', async () => {
    const paid = await localClient.payReceivable(rent, values);
    expect(paid.payment.net_value).toBe(750);
    expect(paid.receivable.status).toBe('pago');
    expect((await localClient.list('Notification'))[0].status).toBe('resolvida');
    const corrected = await localClient.correctPayment(paid.payment, { ...values, paid_value: 400, justification: 'Valor correto' });
    expect(corrected.receivable.paid_value).toBe(400);
    expect((await localClient.list('Notification'))[0].status).toBe('pendente');
    await expect(localClient.correctPayment(paid.payment, { ...values, paid_value: 300 })).rejects.toThrow('mudou');
    await localClient.reversePayment(corrected.payment, 'Pagamento duplicado');
    await localClient.reversePayment(corrected.payment, 'Repetição após falha de rede');
    expect((await localClient.list('Receivable'))[0].paid_value).toBe(0);
    expect(await localClient.list('Payment')).toEqual([]);
    const backup = await localClient.exportBackup();
    expect(backup.Payment[0].change_history).toHaveLength(2);
    expect(backup.Payment[0].change_history[1].justification).toBe('Pagamento duplicado');
  });

  it('repete uma baixa sem duplicar e rejeita reaproveitar seu ID em outra cobrança', async () => {
    await localClient.payReceivable(rent, values);
    expect((await localClient.payReceivable(rent, values)).idempotentReplay).toBe(true);
    await expect(localClient.payReceivable({ id: 'other' }, values)).rejects.toThrow('outro recebível');
    expect(await localClient.list('Payment')).toHaveLength(1);
  });

  it('não grava parcialmente quando a correção ultrapassa o saldo', async () => {
    const { payment } = await localClient.payReceivable(rent, { ...values, paid_value: 400 });
    const before = await localClient.exportBackup();
    await expect(localClient.correctPayment(payment, { ...values, paid_value: 900 })).rejects.toThrow('excede');
    expect(await localClient.exportBackup()).toEqual(before);
  });
});
