import { localClient } from '../services/localClient.js';
import { supabaseDataClient } from '../services/supabaseDataClient.js';
import { isSupabaseEnabled } from '../services/supabaseClient.js';
import { addMoney, subtractMoney, toCents } from '../services/money.js';

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
    const { payment_id: paymentId, ...editablePaymentData } = paymentPayload;
    const localPayment = {
      ...editablePaymentData,
      ...(paymentId ? { id: paymentId } : {}),
      receivable_id: receivable.id,
      contract_id: receivable.contract_id,
      kitnet_id: receivable.kitnet_id,
      tenant_id: receivable.tenant_id,
      competence: receivable.competence,
      net_value: addMoney(
        subtractMoney(paymentPayload.paid_value, paymentPayload.discount),
        paymentPayload.fine,
        paymentPayload.interest,
      ),
      receipt_number: `${receiptYear}-${String(nextReceipt).padStart(4, '0')}`,
    };
    const payment = await client.create('Payment', localPayment);

    try {
      const paidValue = addMoney(receivable.paid_value, paymentPayload.paid_value);
      const status = toCents(paidValue) >= toCents(receivable.expected_value) ? 'pago' : 'parcial';
      const updatedReceivable = await client.update('Receivable', receivable.id, {
        status,
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
