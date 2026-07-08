import { supabase, isSupabaseEnabled } from './supabaseClient.js';

// Sincronização em tempo real: escuta INSERT/UPDATE/DELETE na tabela `records`
// (Supabase Realtime) e avisa as telas interessadas para recarregarem a lista.
// Requer que a tabela esteja na publicação `supabase_realtime`
// (ver supabase/migrations/0002_realtime.sql). Em modo local é um no-op.
const DEBOUNCE_MS = 400;

const listeners = new Set();
let channel = null;

const notifyEntity = (entity) => {
  listeners.forEach((listener) => {
    // entity === null acontece em eventos sem payload (ex.: DELETE sem replica
    // identity full); na dúvida, recarrega todo mundo.
    if (entity === null || listener.entities.has(entity)) {
      listener.schedule();
    }
  });
};

const ensureChannel = () => {
  if (channel || !isSupabaseEnabled) return;

  channel = supabase
    .channel('records-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'records' },
      (payload) => {
        notifyEntity(payload.new?.entity ?? payload.old?.entity ?? null);
      },
    )
    .subscribe();
};

/**
 * Registra um callback disparado quando registros das entidades informadas
 * mudarem no servidor (inclusive por outro dispositivo).
 * Retorna a função de cancelamento.
 */
export const subscribeToEntityChanges = (entities, callback) => {
  if (!isSupabaseEnabled || !entities?.length) {
    return () => {};
  }

  ensureChannel();

  const listener = {
    entities: new Set(entities),
    timer: null,
    schedule() {
      clearTimeout(this.timer);
      // debounce: gerações em lote (aluguéis/despesas do mês) disparam um
      // evento por linha; agrupa tudo num único reload.
      this.timer = setTimeout(callback, DEBOUNCE_MS);
    },
  };

  listeners.add(listener);

  return () => {
    clearTimeout(listener.timer);
    listeners.delete(listener);
  };
};

export default { subscribeToEntityChanges };
