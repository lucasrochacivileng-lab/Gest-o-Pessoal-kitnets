import { localClient } from '../services/localClient.js';
import { supabaseDataClient } from '../services/supabaseDataClient.js';
import { isSupabaseEnabled } from '../services/supabaseClient.js';

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

    const payment = await client.create('Payment', paymentPayload);

    try {
      const paidValue = Number((Number(receivable.paid_value || 0) + Number(paymentPayload.paid_value || 0)).toFixed(2));
      const updatedReceivable = await client.update('Receivable', receivable.id, {
        status: paymentPayload.status || receivable.status,
        updated_at: paymentPayload.updated_at,
        updated_by: paymentPayload.updated_by,
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
