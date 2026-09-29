import { useCallback, useEffect, useRef, useState } from 'react';
import { repository } from '../repository/index.js';
import { useEntitySync } from './useEntitySync.js';
const entities = { payments: 'Payment', expenses: 'Expense', personal: 'PersonalIncome', projects: 'ComplementaryProject', expertReports: 'ExpertReport' };
export function useFinancialData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const version = useRef(0);
  const reload = useCallback(async () => {
    const current = ++version.current;
    try {
      const values = await Promise.all(Object.values(entities).map((entity) => repository.list(entity)));
      if (current !== version.current) return;
      setData(Object.fromEntries(Object.keys(entities).map((key, i) => [key, values[i]])));
      setUpdatedAt(new Date()); setError('');
    } catch (e) { if (current === version.current) setError(e.message || 'Não foi possível carregar os dados.'); }
  }, []);
  useEffect(() => { reload(); return () => { version.current += 1; }; }, [reload]);
  useEntitySync(Object.values(entities), reload);
  return { data, error, reload, updatedAt };
}
