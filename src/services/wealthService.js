import { repository } from '../repository/index.js';
import { fromCents, toCents, sumMoney, subtractMoney } from './money.js';
import { monthKeys } from './financialLedger.js';
import { todayLocalISO } from './dateUtils.js';

export const WEALTH_KINDS = { imovel: 'Imóvel', investimento: 'Investimento', conta: 'Saldo em conta', bem: 'Outro bem', divida: 'Dívida / financiamento' };
const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
export function validateAsset(value) {
  if (!value.name?.trim() || !WEALTH_KINDS[value.kind] || !validDate(value.start_date) || value.start_date > todayLocalISO()) throw new Error('Informe nome, tipo e data de início válida até hoje.');
  return { name: value.name.trim(), kind: value.kind, start_date: value.start_date, notes: value.notes || '' };
}
export function validateValuation(value, asset) {
  if (!asset || !validDate(value.date) || value.date < asset.start_date || value.date > todayLocalISO()) throw new Error('Informe uma data entre o início do bem/dívida e hoje.');
  const amount = Number(value.value); const share = Number(value.ownership_percent);
  if (value.value === '' || value.value == null || !Number.isFinite(amount) || amount < 0 || amount > 1e12
    || !Number.isFinite(share) || share <= 0 || share > 100) throw new Error('Informe valor entre zero e 1 trilhão e participação maior que zero, até 100%.');
  if (!value.source?.trim() || !value.reason?.trim()) throw new Error('Informe a fonte e o motivo da posição.');
  return { asset_id: asset.id, date: value.date, value: fromCents(toCents(amount)), ownership_percent: share,
    source: value.source.trim(), reason: value.reason.trim(), recorded_at: new Date().toISOString() };
}
export function wealthAtDate(assets, valuations, date) {
  const rows = assets.filter((a) => a.active !== false && a.start_date <= date).map((asset) => {
    const latest = valuations.filter((v) => v.active !== false && v.asset_id === asset.id && v.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.recorded_at || '').localeCompare(String(a.recorded_at || '')) || String(b.id).localeCompare(String(a.id)))[0];
    const amount = Number(latest?.value);
    const share = Number(latest?.ownership_percent);
    const valid = latest && latest.value !== '' && latest.value != null && Number.isFinite(amount) && amount >= 0 && amount <= 1e12 && Number.isFinite(share) && share > 0 && share <= 100;
    const value = valid ? fromCents(Math.round(toCents(amount) * share / 100)) : null;
    return { ...asset, valuation: latest || null, value, carried: Boolean(latest && latest.date.slice(0, 7) < date.slice(0, 7)) };
  });
  const missing = rows.filter((r) => r.value == null);
  const totalAssets = sumMoney(rows.filter((r) => r.kind !== 'divida' && r.value != null).map((r) => r.value));
  const debts = sumMoney(rows.filter((r) => r.kind === 'divida' && r.value != null).map((r) => r.value));
  return { date, rows, missing, totalAssets, debts, net: rows.length && !missing.length ? subtractMoney(totalAssets, debts) : null };
}
export function buildWealthHistory(assets, valuations, month, today = todayLocalISO()) {
  return monthKeys(month).map((key) => {
    const [y, m] = key.split('-').map(Number);
    const end = `${key}-${new Date(y, m, 0).getDate()}`;
    const date = end > today ? today : end;
    const snapshot = wealthAtDate(assets, valuations, date);
    return { month: key, label: `${key.slice(5)}/${key.slice(0, 4)}`, ...snapshot, net: key > today.slice(0, 7) ? null : snapshot.net };
  });
}
export const wealthService = {
  createAsset: (value) => repository.create('WealthAsset', validateAsset(value)),
  recordValuation: (value, asset) => repository.create('WealthValuation', validateValuation(value, asset)),
};
