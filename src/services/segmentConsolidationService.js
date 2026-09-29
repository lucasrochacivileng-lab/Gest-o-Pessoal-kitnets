import { SEGMENTS, resolveExpenseSegment } from './financialClassification.js';
import { buildFinancialLedger, selectLedger, ledgerTotals } from './financialLedger.js';
export { SEGMENTS, resolveExpenseSegment };
export function buildSegmentConsolidation({ monthKey, ...data }) {
  const items = selectLedger(buildFinancialLedger(data), { month: monthKey });
  const segments = SEGMENTS.map((s) => {
    const rows = items.filter((r) => r.segment === s.key);
    return { ...s, ...ledgerTotals(rows), items: rows };
  });
  return { segments, global: ledgerTotals(items) };
}
export default buildSegmentConsolidation;
