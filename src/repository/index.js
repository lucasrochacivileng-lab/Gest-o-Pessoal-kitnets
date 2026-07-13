import { localClient } from '../services/localClient.js';
import { supabaseDataClient } from '../services/supabaseDataClient.js';
import { isSupabaseEnabled } from '../services/supabaseClient.js';
import { addMoney } from '../services/money.js';

// Centraliza a persistência: usa Supabase quando VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY
// estão configuradas; caso contrário, mantém o modo local (localStorage).
const client = isSupabaseEnabled ? supabaseDataClient : localClient;

export const repository = {
  list(entity) {
    return client.list(entity);
  },
  create(entity, payload) {
    return client.create(entity, payload);
  },
  update(entity, id, payload) {
    return client.update(entity, id, payload);
  },
  removeSoft(entity, id) {
    return client.removeSoft(entity, id);
  },
  async payReceivable(receivable, paymentPayload) {
    if (client.payReceivable) {
      return client.payReceivable(receivable, paymentPayload);
    }

    const paymentDate = paymentPayload.payment_date || new Date().toISOString().slice(0, 10);
    const receiptYear = paymentDate.slice(0, 4);
    const payments = await client.list('Payment');
    const nextReceipt = payments.reduce((maximum, row) => {
      const match = String(row.receipt_number || '').match(new RegExp(`^${receiptYear}-(\\d+)$`));
      return match ? Math.max(maximum, Number(match[1])) : maximum;
    }, 0) + 1;
    const localPayment = {
      ...paymentPayload,
      receipt_number: `${receiptYear}-${String(nextReceipt).padStart(4, '0')}`,
    };
    const payment = await client.create('Payment', localPayment);

    try {
      const paidValue = addMoney(receivable.paid_value, paymentPayload.paid_value);
      const updatedReceivable = await client.update('Receivable', receivable.id, {
        status: paymentPayload.status || receivable.status,
        updated_at: paymentPayload.updated_at,
        paid_value: paidValue,
      });
      return { payment, receivable: updatedReceivable, receiptNumber: payment.receipt_number };
    } catch (error) {
      await client.removeSoft('Payment', payment.id).catch(() => {});
      throw error;
    }
  },
  exportBackup() {
    return client.exportBackup();
  },
  importBackup(value) {
    return client.importBackup(value);
  },
  resetData() {
    return client.resetData();
  },
};

export default repository;
