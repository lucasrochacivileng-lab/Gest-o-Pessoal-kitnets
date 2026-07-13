// Extrato: cruza pagamentos de aluguel (entrada), despesas das kitnets (saída)
// e finanças pessoais (entrada/saída) num único extrato cronológico, com a
// origem de cada lançamento legível ("Aluguel — Kitnet 03 · Maria").
// Usa a MESMA semântica de "realizado" do cashflowService.js (regime de caixa:
// só pago/recebido entra), para os totais nunca divergirem entre telas.
import { financialService } from './financialService';
import { rentPaymentsOnly } from './paymentClassifier.js';
import { buildExtraIncomeRows } from '../modules/receivables/services/extraIncomeService.js';
import { isPersonalExpense } from './personalMovementClassifier.js';

const toMoney = (value) => Number(value || 0);
const paymentValue = financialService.netPaymentValue;
const isConfirmed = (row) => ['pago', 'recebido'].includes(row.status);
const inMonth = (date, monthKey) => String(date || '').startsWith(monthKey);

const PERSONAL_TYPE_LABELS = {
  income: 'Receita pessoal',
  expense: 'Despesa pessoal',
  card_transaction: 'Cartão',
};

export const buildStatement = ({
  payments = [],
  expenses = [],
  personal = [],
  receivables = [],
  contracts = [],
  kitnets = [],
  tenants = [],
  projects = [],
  expertReports = [],
  monthKey,
}) => {
  const kitnetById = new Map(kitnets.map((row) => [row.id, row]));
  const tenantById = new Map(tenants.map((row) => [row.id, row]));
  const contractById = new Map(contracts.map((row) => [row.id, row]));
  const receivableById = new Map(receivables.map((row) => [row.id, row]));

  // Pagamento normal não grava kitnet/locatário direto — vem da cadeia
  // Payment.receivable_id -> Receivable -> Contract. Pagamento manual (sem
  // recebível) pode ter kitnet_id/tenant_id direto no próprio registro.
  const resolvePaymentOrigin = (row) => {
    const receivable = receivableById.get(row.receivable_id);
    const contract = contractById.get(receivable?.contract_id);
    const kitnetId = row.kitnet_id || receivable?.kitnet_id || contract?.kitnet_id;
    const tenantId = row.tenant_id || receivable?.tenant_id || contract?.tenant_id;

    return {
      kitnet: kitnetById.get(kitnetId) || null,
      tenant: tenantById.get(tenantId) || null,
      competence: receivable?.competence || row.competence || '',
    };
  };

  const rentIncome = rentPaymentsOnly(payments)
    .filter((row) => inMonth(row.payment_date, monthKey))
    .map((row) => {
      const { kitnet, tenant, competence } = resolvePaymentOrigin(row);

      return {
        id: `payment-${row.id}`,
        date: row.payment_date,
        kind: 'entrada',
        origin: 'kitnets',
        category: 'aluguel',
        label: kitnet?.name ? `Aluguel — ${kitnet.name}` : 'Aluguel',
        detail: [tenant?.name, competence].filter(Boolean).join(' · '),
        value: paymentValue(row),
        confirmed: true,
      };
    });

  const extraIncome = buildExtraIncomeRows({ projects, expertReports, month: monthKey })
    .map((row) => ({
      id: `extra-${row.id}`,
      date: row.date,
      kind: 'entrada',
      origin: 'extras',
      category: row.kind.toLowerCase(),
      label: `${row.kind} — ${row.label}`,
      detail: row.status === 'recebido' ? 'Recebido' : 'Previsto',
      value: row.value,
      confirmed: row.status === 'recebido',
    }));

  const kitnetExpenses = expenses
    .filter((row) => inMonth(row.date, monthKey))
    .map((row) => {
      const kitnet = kitnetById.get(row.kitnet_id);
      return {
        id: `expense-${row.id}`,
        date: row.date,
        kind: 'saida',
        origin: 'kitnets',
        category: row.category || 'outro',
        label: row.description || row.category || 'Despesa',
        detail: kitnet?.name || '',
        value: toMoney(row.value),
        confirmed: row.status === 'pago',
      };
    });

  const personalMovements = personal
    .filter((row) => (row.type === 'income' || isPersonalExpense(row)) && row.status !== 'ignorar' && row.status !== 'revisar' && inMonth(row.date, monthKey))
    .map((row) => ({
      id: `personal-${row.id}`,
      date: row.date,
      kind: row.type === 'income' ? 'entrada' : 'saida',
      origin: row.context === 'pessoal' || !row.context ? 'pessoal' : row.context,
      category: row.category || PERSONAL_TYPE_LABELS[row.type] || 'outro',
      label: row.description || row.category || PERSONAL_TYPE_LABELS[row.type] || 'Lançamento',
      detail: row.card_name || '',
      value: toMoney(row.value),
      confirmed: isConfirmed(row),
    }));

  const all = [...rentIncome, ...extraIncome, ...kitnetExpenses, ...personalMovements];
  const realized = all.filter((row) => row.confirmed);
  const pending = all
    .filter((row) => !row.confirmed)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const movements = realized
    .map((row) => ({ ...row, signedValue: row.kind === 'entrada' ? row.value : -row.value }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const totalIn = movements.filter((row) => row.kind === 'entrada').reduce((sum, row) => sum + row.value, 0);
  const totalOut = movements.filter((row) => row.kind === 'saida').reduce((sum, row) => sum + row.value, 0);

  return {
    movements,
    pending,
    totalIn,
    totalOut,
    balance: totalIn - totalOut,
  };
};

export default buildStatement;
