// Caixa de entrada de RECEITAS do mês (fachada de leitura). Junta, num formato
// único, todas as fontes de receita que já existem no app — sem criar entidade
// nova. Reaproveita os mesmos classificadores/serviços do Extrato para os
// totais nunca divergirem entre as telas (regime de caixa: recebido conta como
// realizado; o resto é previsto).
import { rentPaymentsOnly } from './paymentClassifier.js';
import { financialService } from './financialService';
import { buildExtraIncomeRows } from '../modules/receivables/services/extraIncomeService.js';
import { calculateOutstandingValue, getReceivableStatus } from '../modules/receivables/services/receivableService.js';
import { RECEIVABLE_STATUS } from '../modules/receivables/types/receivable.types.js';

const toMoney = (value) => Number(value || 0);
const inMonth = (date, month) => String(date || '').startsWith(month);
const paymentValue = financialService.netPaymentValue;

export const buildIncomeInbox = ({
  payments = [],
  receivables = [],
  contracts = [],
  kitnets = [],
  tenants = [],
  projects = [],
  expertReports = [],
  personal = [],
  month,
}) => {
  const kitnetById = new Map(kitnets.map((row) => [row.id, row]));
  const tenantById = new Map(tenants.map((row) => [row.id, row]));
  const contractById = new Map(contracts.map((row) => [row.id, row]));
  const receivableById = new Map(receivables.map((row) => [row.id, row]));

  const rows = [];

  // Aluguel RECEBIDO: cada Payment com vínculo de aluguel no mês. A origem
  // (kitnet/locatário) vem da cadeia Payment -> Receivable -> Contract, com o
  // fallback do pagamento manual (mesma regra do statementService).
  rentPaymentsOnly(payments)
    .filter((payment) => inMonth(payment.payment_date, month))
    .forEach((payment) => {
      const receivable = receivableById.get(payment.receivable_id);
      const contract = contractById.get(receivable?.contract_id);
      const kitnet = kitnetById.get(payment.kitnet_id || receivable?.kitnet_id || contract?.kitnet_id);
      const tenant = tenantById.get(payment.tenant_id || receivable?.tenant_id || contract?.tenant_id);

      rows.push({
        id: `payment-${payment.id}`,
        tipo: 'aluguel',
        label: kitnet?.name ? `Aluguel — ${kitnet.name}` : 'Aluguel',
        detail: [tenant?.name, receivable?.competence || payment.competence].filter(Boolean).join(' · '),
        date: payment.payment_date,
        value: paymentValue(payment),
        status: 'recebido',
        sourceEntity: 'Payment',
        sourceId: payment.id,
      });
    });

  // Aluguel PREVISTO: recebíveis do mês ainda não quitados (mostra só o saldo
  // em aberto — um parcial aparece como recebido no Payment + previsto no resto).
  receivables
    .filter((receivable) => inMonth(receivable.competence, month))
    .filter((receivable) => getReceivableStatus(receivable) !== RECEIVABLE_STATUS.PAID)
    .forEach((receivable) => {
      const outstanding = calculateOutstandingValue(receivable);
      if (outstanding <= 0) return;

      const contract = contractById.get(receivable.contract_id);
      const kitnet = kitnetById.get(receivable.kitnet_id || contract?.kitnet_id);
      const tenant = tenantById.get(receivable.tenant_id || contract?.tenant_id);

      rows.push({
        id: `receivable-${receivable.id}`,
        tipo: 'aluguel',
        label: kitnet?.name ? `Aluguel — ${kitnet.name}` : 'Aluguel',
        detail: [tenant?.name, receivable.competence].filter(Boolean).join(' · '),
        date: receivable.due_date || `${receivable.competence}-01`,
        value: outstanding,
        status: 'previsto',
        sourceEntity: 'Receivable',
        sourceId: receivable.id,
        receivable,
      });
    });

  // Perícia e Projeto: reusa o agregador que a tela de Recebimentos e o Extrato
  // já usam (recebido × previsto pela data de recebimento/previsão).
  buildExtraIncomeRows({ projects, expertReports, month }).forEach((row) => {
    rows.push({
      id: `extra-${row.id}`,
      tipo: row.entity === 'ExpertReport' ? 'pericia' : 'projeto',
      label: `${row.kind} — ${row.label}`,
      detail: row.status === 'recebido' ? 'Recebido' : 'Previsto',
      date: row.date,
      value: row.value,
      status: row.status === 'recebido' ? 'recebido' : 'previsto',
      sourceEntity: row.entity,
      sourceId: row.sourceId,
    });
  });

  // Renda pessoal (salário = contexto 'trabalho'; demais = pessoal). Só type
  // 'income'; ignora 'revisar'/'ignorar' (mesma exclusão do Extrato).
  personal
    .filter((row) => row.type === 'income' && !['ignorar', 'revisar'].includes(row.status) && inMonth(row.date, month))
    .forEach((row) => {
      rows.push({
        id: `personal-${row.id}`,
        tipo: row.context === 'trabalho' ? 'salario' : 'pessoal',
        label: row.description || row.category || (row.context === 'trabalho' ? 'Salário' : 'Receita pessoal'),
        detail: row.category || '',
        date: row.date,
        value: toMoney(row.value),
        status: ['pago', 'recebido'].includes(row.status) ? 'recebido' : 'previsto',
        sourceEntity: 'PersonalIncome',
        sourceId: row.id,
      });
    });

  const sorted = rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const received = sorted.filter((row) => row.status === 'recebido').reduce((sum, row) => sum + row.value, 0);
  const previsto = sorted.filter((row) => row.status !== 'recebido').reduce((sum, row) => sum + row.value, 0);

  return { rows: sorted, summary: { received, previsto, total: received + previsto } };
};

export default buildIncomeInbox;
