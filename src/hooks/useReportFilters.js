import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { currentMonthLocal } from '../services/dateUtils.js';
import { SEGMENTS } from '../services/financialClassification.js';

const validMonth = (v) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v || '');
function stored() { try { return JSON.parse(sessionStorage.getItem('financial-report-filters') || '{}'); } catch { return {}; } }
export function useReportFilters() {
  const [params, setParams] = useSearchParams();
  const saved = stored();
  const candidate = params.get('month') || params.get('mes') || saved.month;
  const month = validMonth(candidate) ? candidate : currentMonthLocal();
  const selected = params.has('segment') ? params.get('segment') : saved.segment;
  const segment = SEGMENTS.some((s) => s.key === selected) ? selected : '';
  useEffect(() => {
    try { sessionStorage.setItem('financial-report-filters', JSON.stringify({ month, segment })); } catch { /* URL continua funcionando. */ }
  }, [month, segment]);
  const update = (patch) => {
    const value = { month, segment, ...patch };
    try { sessionStorage.setItem('financial-report-filters', JSON.stringify(value)); } catch { /* URL continua funcionando. */ }
    setParams((previous) => { const next = new URLSearchParams(previous); next.set('month', value.month); next.set('segment', value.segment); return next; });
  };
  return { month, segment, setMonth: (value) => update({ month: value }), setSegment: (value) => update({ segment: value }) };
}
