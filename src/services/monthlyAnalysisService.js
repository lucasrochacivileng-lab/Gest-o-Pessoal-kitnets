import { buildFinancialLedger, selectLedger, ledgerTotals, monthKeys, compareValues } from './financialLedger.js';
import { SEGMENTS } from './financialClassification.js';
import { normalizeCategory, categoryLabel } from './categoryReportService.js';
import { addMoney, sumMoney } from './money.js';
import { todayLocalISO } from './dateUtils.js';

export function buildMonthlyAnalysis(data, { month, segment = '', today = todayLocalISO() }) {
  const ledger = buildFinancialLedger(data);
  const items = selectLedger(ledger, { month, segment });
  const previousMonth = monthKeys(month, 2)[0];
  const partial = month === today.slice(0, 7);
  const cutoff = Number(today.slice(8, 10));
  const comparable = (rows) => partial ? rows.filter((r) => Number(r.date.slice(8, 10)) <= cutoff) : rows;
  const current = ledgerTotals(comparable(items));
  const previous = ledgerTotals(comparable(selectLedger(ledger, { month: previousMonth, segment })));
  const totals = ledgerTotals(items);
  const categories = new Map();
  for (const item of items.filter((r) => r.kind === 'saida')) {
    const key = normalizeCategory(item); const row = categories.get(key) || { key, name: categoryLabel(key), value: 0 };
    row.value = addMoney(row.value, item.value); categories.set(key, row);
  }
  const segments = SEGMENTS.map((s) => ({ ...s, ...ledgerTotals(selectLedger(ledger, { month, segment: s.key })) }));
  const trend = monthKeys(month).map((key) => {
    const rows = selectLedger(ledger, { month: key, segment });
    const sources = Object.fromEntries(SEGMENTS.map((s) => [s.key, sumMoney(rows.filter((r) => r.segment === s.key && r.kind === 'entrada').map((r) => r.value))]));
    return { month: key, label: `${key.slice(5)}/${key.slice(0, 4)}`, ...ledgerTotals(rows), ...sources };
  });
  return { items, totals, segments, trend, categories: [...categories.values()].sort((a, b) => b.value - a.value),
    previousMonth, partial, comparison: Object.fromEntries(['income', 'expense', 'result'].map((key) => [key, compareValues(current[key], previous[key])])),
    reviewCount: (data.personal || []).filter((r) => r.active !== false && ['revisar', 'sugerido'].includes(r.status) && r.date?.startsWith(month)).length,
  };
}
