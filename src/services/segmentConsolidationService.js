import { financialService } from './financialService';

// Consolidação por SEGMENTO (centro de resultado). Normaliza todas as fontes de
// dinheiro já existentes num mesmo formato — entradas e saídas por segmento —
// para a visão global mostrar kitnets, projetos, perícias, trabalho e pessoal
// separados, e o total. Regime de caixa: só entra o que foi efetivamente
// pago/recebido (mesma regra do cashflowService).

const toMoney = (value) => Number(value || 0);
const paymentValue = financialService.netPaymentValue;
const inMonth = (date, monthKey) => String(date || '').startsWith(monthKey);
const isConfirmed = (row) => ['pago', 'recebido'].includes(row.status);

// Projetos/perícias não têm data de recebimento própria; cai pra previsão/prazo.
const extraIncomeDate = (row) => (
  row.received_at || row.received_date || row.expected_payment_date || row.due_date || ''
);

export const SEGMENTS = [
  { key: 'kitnets', label: 'Kitnets' },
  { key: 'projetos', label: 'Projetos' },
  { key: 'pericias', label: 'Perícias' },
  { key: 'trabalho', label: 'Trabalho / Servidor' },
  { key: 'pessoal', label: 'Pessoal' },
];

export const buildSegmentConsolidation = ({
  payments = [], expenses = [], personal = [], projects = [], expertReports = [], monthKey,
}) => {
  const acc = Object.fromEntries(SEGMENTS.map((segment) => [segment.key, { ...segment, income: 0, expense: 0 }]));

  // Kitnets: aluguéis recebidos (entram) e despesas diretas pagas (saem).
  payments
    .filter((row) => inMonth(row.payment_date, monthKey))
    .forEach((row) => { acc.kitnets.income += paymentValue(row); });
  expenses
    .filter((row) => row.status === 'pago' && inMonth(row.date, monthKey))
    .forEach((row) => { acc.kitnets.expense += toMoney(row.value); });

  // Projetos e perícias: só o que foi efetivamente recebido no mês.
  projects
    .filter((row) => row.status === 'recebido' && inMonth(extraIncomeDate(row), monthKey))
    .forEach((row) => { acc.projetos.income += toMoney(row.value); });
  expertReports
    .filter((row) => row.status === 'recebido' && inMonth(extraIncomeDate(row), monthKey))
    .forEach((row) => { acc.pericias.income += toMoney(row.fee_value); });

  // Renda pessoal confirmada: salário (contexto 'trabalho') vai pro segmento
  // Trabalho; o resto, pra Pessoal.
  personal
    .filter((row) => row.type === 'income' && isConfirmed(row) && inMonth(row.date, monthKey))
    .forEach((row) => {
      const key = row.context === 'trabalho' ? 'trabalho' : 'pessoal';
      acc[key].income += toMoney(row.value);
    });

  // Despesa pessoal confirmada — inclui as compras no cartão pessoal
  // ('card_transaction'), porque é comum pagar custo de kitnet no cartão
  // pessoal. O que manda é o CONTEXTO, não o cartão: gasto marcado como
  // kitnets/obra conta como despesa das kitnets (dinheiro investido no
  // negócio); o resto, como despesa pessoal. Transações de cartão ainda em
  // 'revisar'/'sugerido'/'ignorar' não são confirmadas e ficam de fora.
  personal
    .filter((row) => row.type !== 'income' && isConfirmed(row) && inMonth(row.date, monthKey))
    .forEach((row) => {
      const key = ['kitnets', 'obra'].includes(row.context) ? 'kitnets' : 'pessoal';
      acc[key].expense += toMoney(row.value);
    });

  const segments = SEGMENTS.map((segment) => {
    const entry = acc[segment.key];
    return { ...entry, result: entry.income - entry.expense };
  });

  const global = segments.reduce((sum, segment) => ({
    income: sum.income + segment.income,
    expense: sum.expense + segment.expense,
    result: sum.result + segment.result,
  }), { income: 0, expense: 0, result: 0 });

  return { segments, global };
};

export default buildSegmentConsolidation;
