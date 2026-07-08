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
