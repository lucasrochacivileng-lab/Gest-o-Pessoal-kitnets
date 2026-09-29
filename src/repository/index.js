import { localClient } from '../services/localClient.js';
import { supabaseDataClient } from '../services/supabaseDataClient.js';
import { isSupabaseEnabled } from '../services/supabaseClient.js';
import { notifyEntity } from '../services/realtimeSync.js';

// Centraliza a persistência: usa Supabase quando VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY
// estão configuradas; caso contrário, mantém o modo local (localStorage).
const client = isSupabaseEnabled ? supabaseDataClient : localClient;

export const repository = {
  list(entity) {
    return client.list(entity);
  },
  async create(entity, payload) {
    const result = await client.create(entity, payload);
    notifyEntity(entity);
    return result;
  },
  async update(entity, id, payload) {
    const result = await client.update(entity, id, payload);
    notifyEntity(entity);
    return result;
  },
  async removeSoft(entity, id) {
    const result = await client.removeSoft(entity, id);
    notifyEntity(entity);
    return result;
  },
  async payReceivable(receivable, paymentPayload) {
    const result = await client.payReceivable(receivable, paymentPayload);
    ['Payment', 'Receivable', 'Notification'].forEach(notifyEntity);
    return result;
  },
  exportBackup() {
    return client.exportBackup();
  },
  async importBackup(value, options) {
    const result = await client.importBackup(value, options);
    notifyEntity();
    return result;
  },
  async resetData() {
    if (isSupabaseEnabled) throw new Error('O reset local não pode apagar dados do Supabase.');
    const result = await client.resetData();
    notifyEntity();
    return result;
  },
  async correctPayment(payment, values) {
    const result = await client.correctPayment(payment, values);
    ['Payment', 'Receivable', 'Notification'].forEach(notifyEntity);
    return result;
  },
  async reversePayment(payment, justification) {
    const result = await client.reversePayment(payment, justification);
    ['Payment', 'Receivable', 'Notification'].forEach(notifyEntity);
    return result;
  },
  async terminateContract(contractId, options) {
    const result = await client.terminateContract(contractId, options);
    ['Contract', 'Kitnet', 'Tenant', 'Receivable', 'Notification'].forEach(notifyEntity);
    return result;
  },
};

export default repository;
