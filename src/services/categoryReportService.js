import { buildFinancialLedger, selectLedger } from './financialLedger.js';
import { movementDate } from './financialClassification.js';
import { addMoney, sumMoney } from './money.js';
import { isPersonalExpense } from './personalMovementClassifier.js';
import { resolveExpenseSegment } from './segmentConsolidationService.js';
// Rótulos vêm do catálogo único de categorias — este serviço segue dono só da
// NORMALIZAÇÃO (slug + aliases) que concilia os vocabulários legados.
import { CATEGORY_LABELS } from './categoryCatalog.js';

const monthOf = (date) => String(date || '').slice(0, 7);

export const categoryLabel = (key) => CATEGORY_LABELS[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Sem categoria');

const CATEGORY_ALIASES = {
  agua_pessoal: 'agua',
  energia_pessoal: 'energia',
  luz: 'energia',
  internet_pessoal: 'internet',
  aluguel_pessoal: 'moradia',
  combustivel_para_carro: 'combustivel',
  material_de_construcao: 'material',
  investimento_kitnets: 'obra',
  outros: 'outro',
  tarifas_bancarias: 'tarifas_bancarias',
};

const slugCategory = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '');

export const normalizeCategory = (row) => {
  const raw = slugCategory(row.category);
  return CATEGORY_ALIASES[raw] || raw || 'sem_categoria';
};


export const buildCategoryReport = ({ expenses = [], personal = [], month, segment = '' }) => {
  const items = selectLedger(buildFinancialLedger({ expenses, personal }), { month, segment }).filter(r => r.kind === 'saida');
  const totals = new Map();
  for (const item of items) {
    const key = normalizeCategory(item);
    const group = totals.get(key) || { category: key, label: categoryLabel(key), total: 0, count: 0, origins: new Set(), items: [] };
    group.total = addMoney(group.total, item.value); group.count += 1;
    group.origins.add(item.segment); group.items.push(item); totals.set(key, group);
  }
  const rows = [...totals.values()].map(r => ({ ...r, origins: [...r.origins] })).sort((a,b)=>b.total-a.total);
  const grandTotal = sumMoney(items.map(r=>r.value));
  const candidates = [...expenses.map(r=>({...r, entity:'Expense'})), ...personal.filter(r=>isPersonalExpense(r)||r.type==='transfer').map(r=>({...r, entity:'PersonalIncome'}))];
  const excluded = candidates.filter(r=>r.active!==false && monthOf(movementDate(r))===month && (!segment || resolveExpenseSegment(r,r.entity==='Expense'?'kitnets':'pessoal')===segment))
    .filter(r=>r.type==='transfer' || (r.entity==='Expense' ? r.status!=='pago' : !['pago','recebido'].includes(r.status)))
    .map(r=>({ ...r, reason: r.type==='transfer'?'Transferência / ajuste de saldo': r.status==='revisar'?'Aguardando revisão': 'Status: '+(r.status||'não informado') }));
  const cards = items.filter(r=>r.card);
  return { rows: rows.map(r=>({...r,share:grandTotal?r.total/grandTotal:0})), grandTotal,
    cardTotal:sumMoney(cards.map(r=>r.value)),cardCount:cards.length,
    cardReviewCount:excluded.filter(r=>r.type==='card_transaction'&&r.status==='revisar').length,excluded };
};
export const buildCategoryTrend = ({ expenses = [], personal = [], months = [], category = null, segment = '' }) => months.map(month=>{
  const report = buildCategoryReport({expenses,personal,month,segment});
  return {month,total:category?(report.rows.find(r=>r.category===category)?.total||0):report.grandTotal};
});
export default buildCategoryReport;
