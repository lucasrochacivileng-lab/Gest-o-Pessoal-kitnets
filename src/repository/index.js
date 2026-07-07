import { localClient } from '../services/localClient.js';

// Centraliza persistencia para facilitar a troca futura por Supabase.
export const repository = {
  list(entity) {
    return localClient.list(entity);
  },
  create(entity, payload) {
    return localClient.create(entity, payload);
  },
  update(entity, id, payload) {
    return localClient.update(entity, id, payload);
  },
  removeSoft(entity, id) {
    return localClient.removeSoft(entity, id);
  },
  exportBackup() {
    return localClient.exportBackup();
  },
  importBackup(value) {
    return localClient.importBackup(value);
  },
  resetData() {
    return localClient.resetData();
  },
};

export default repository;
