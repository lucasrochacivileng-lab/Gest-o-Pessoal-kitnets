import { buildFinancialLedger, selectLedger, ledgerTotals } from './financialLedger.js';
export const GERAL_KEY = 'geral';
export function buildKitnetResults({kitnets=[],receivables=[],contracts=[],monthKey,...data}) {
  const receivableById = new Map(receivables.map(row => [row.id, row]));
  const contractById = new Map(contracts.map(row => [row.id, row]));
  data.payments = (data.payments || []).map(row => {
    const receivable = receivableById.get(row.receivable_id);
    const contract = contractById.get(receivable?.contract_id);
    return { ...row, kitnet_id: row.kitnet_id || receivable?.kitnet_id || contract?.kitnet_id };
  });
  const items=selectLedger(buildFinancialLedger(data),{month:monthKey,segment:'kitnets'});
  const known=new Set(kitnets.map(r=>r.id));
  const rows=kitnets.map(k=>({id:k.id,name:k.name||k.id,...ledgerTotals(items.filter(r=>r.kitnet_id===k.id))})).sort((a,b)=>a.name.localeCompare(b.name));
  return {kitnets:rows,geral:ledgerTotals(items.filter(r=>!known.has(r.kitnet_id))),totals:ledgerTotals(items)};
}
export default buildKitnetResults;
