import { useEffect, useRef } from 'react';
import { subscribeToEntityChanges } from '../services/realtimeSync.js';

/**
 * Recarrega dados da tela quando as entidades informadas mudam no Supabase
 * (edições feitas em outro dispositivo/aba). `onChange` deve ser um reload
 * silencioso — sem resetar a tela para o estado "Carregando...".
 */
export function useEntitySync(entities, onChange) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  const key = (entities || []).join(',');

  useEffect(() => {
    if (!key) return undefined;
    return subscribeToEntityChanges(key.split(','), () => callbackRef.current());
  }, [key]);
}

export default useEntitySync;
