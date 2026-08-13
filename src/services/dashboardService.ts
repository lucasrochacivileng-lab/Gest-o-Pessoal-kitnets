import { dashboardRepository } from '../repository/dashboardRepository';
import { getReceivableStatus } from '../modules/receivables/services/receivableService.js';
import { RECEIVABLE_STATUS } from '../modules/receivables/types/receivable.types.js';
import { categoryLabel } from './categoryReportService.js';
import { financialService } from './financialService';
import { rentPaymentsOnly } from './paymentClassifier.js';
import { buildExtraIncomeRows } from '../modules/receivables/services/extraIncomeService.js';
import { todayLocalISO } from './dateUtils.js';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const moneyValue = (value) => Number(value || 0);
const outstandingValue = (receivable) => Math.max(moneyValue(receivable.expected_value) - moneyValue(receivable.paid_value), 0);
const paymentValue = financialService.netPaymentValue;
const getContractAlertDays = () => {
  if (typeof window === 'undefined') return 30;

  try {
    const settings = JSON.parse(window.localStorage.getItem('@kitmanager/settings') || '{}');
    const values = String(settings.contractAlertDays || '30').split(',').map((value) => Number(value)).filter(Boolean);
    return Math.max(...values, 30);
  } catch {
    return 30;
  }
};

const UPCOMING_ACTION_DAYS = 3;

// "Precisa de você": recebíveis vencidos ou vencendo nos próximos dias,
// enriquecidos com locatário/kitnet para permitir cobrar direto do dashboard.
const buildActionItems = (receivables, contracts, kitnets, tenants, today) => {
  const limit = new Date(new Date(`${today}T00:00:00`).getTime() + UPCOMING_ACTION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return receivables
    .filter((receivable) => (
      receivable.status !== 'pago'
      && receivable.due_date
      && receivable.due_date <= limit
    ))
    .map((receivable) => {
      const contract = contracts.find((row) => row.id === receivable.contract_id) || null;
      const kitnet = kitnets.find((row) => row.id === (receivable.kitnet_id || contract?.kitnet_id)) || null;
      const tenant = tenants.find((row) => row.id === (receivable.tenant_id || contract?.tenant_id)) || null;
      const daysLate = Math.floor((new Date(`${today}T00:00:00`).getTime() - new Date(`${receivable.due_date}T00:00:00`).getTime()) / (24 * 60 * 60 * 1000));

      return {
        id: receivable.id,
        competence: receivable.competence,
        dueDate: receivable.due_date,
        daysLate,
        isFine: receivable.type === 'multa_quebra',
        outstanding: outstandingValue(receivable),
        kitnetName: kitnet?.name || '',
        tenantName: tenant?.name || '',
        tenantPhone: tenant?.whatsapp || tenant?.phone || '',
      };
    })
    .sort((a, b) => b.daysLate - a.daysLate);
};

export const dashboardService = {
  async getDashboardData() {
    const [kitnets, receivables, payments, expenses, contracts, tenants, projects, expertReports] = await Promise.all([
      dashboardRepository.getKitnets(),
      dashboardRepository.getReceivables(),
      dashboardRepository.getPayments(),
      dashboardRepository.getExpenses(),
      dashboardRepository.getContracts(),
      dashboardRepository.getTenants(),
      dashboardRepository.getProjects(),
      dashboardRepository.getExpertReports(),
    ]);

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = todayLocalISO(now);

    const rentPayments = rentPaymentsOnly(payments);
    const monthPayments = rentPayments.filter((payment) => payment.payment_date && payment.payment_date.startsWith(currentMonth));
    const monthExtraIncome = buildExtraIncomeRows({ projects, expertReports, month: currentMonth })
      .filter((row) => row.status === 'recebido')
      .reduce((sum, row) => sum + moneyValue(row.value), 0);
    const monthExpenses = expenses.filter((expense) => expense.date && expense.date.startsWith(currentMonth));
    const revenue = monthPayments.reduce((sum, payment) => sum + paymentValue(payment), 0) + monthExtraIncome;
    const expenseTotal = monthExpenses.reduce((sum, expense) => sum + (expense.value || 0), 0);

    // Mesma regra de status usada em Recebimentos (getReceivableStatus): um
    // recebível "parcial" com vencimento já passado também é vencido — o
    // filtro anterior só pegava 'vencido'/'pendente', subestimando o valor
    // em atraso sempre que havia pagamento parcial feito fora do prazo.
    const overdue = receivables.filter((receivable) => getReceivableStatus(receivable, today) === RECEIVABLE_STATUS.OVERDUE);
    const currentMonthReceivables = receivables.filter((receivable) => (
      receivable.competence === currentMonth
      || (!receivable.competence && receivable.due_date?.startsWith(currentMonth))
    ));
    const upcoming = currentMonthReceivables.filter((receivable) => (
      getReceivableStatus(receivable, today) === RECEIVABLE_STATUS.PENDING
      && receivable.due_date
      && receivable.due_date >= today
    ));
    const receitaPrevista = currentMonthReceivables
      .filter((receivable) => ['pendente', 'vencido', 'parcial'].includes(receivable.status))
      .reduce((sum, receivable) => sum + outstandingValue(receivable), 0);

    const occupied = kitnets.filter((kitnet) => kitnet.status === 'ocupada').length;
    const vacant = kitnets.filter((kitnet) => kitnet.status === 'vaga').length;

    const alertDaysFromNow = new Date(now);
    alertDaysFromNow.setDate(alertDaysFromNow.getDate() + getContractAlertDays());
    const alertDaysStr = todayLocalISO(alertDaysFromNow);
    const expiringContracts = contracts.filter((contract) => contract.status === 'ativo' && contract.end_date && contract.end_date <= alertDaysStr && contract.end_date >= today);

    const monthlyData = [];
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthPaymentsForKey = rentPayments.filter((payment) => payment.payment_date && payment.payment_date.startsWith(key));
      const monthExpensesForKey = expenses.filter((expense) => expense.date && expense.date.startsWith(key));
      const receipts = monthPaymentsForKey.reduce((sum, payment) => sum + paymentValue(payment), 0);
      const extraReceipts = buildExtraIncomeRows({ projects, expertReports, month: key })
        .filter((row) => row.status === 'recebido')
        .reduce((sum, row) => sum + moneyValue(row.value), 0);
      const expensesValue = monthExpensesForKey.reduce((sum, expense) => sum + (expense.value || 0), 0);

      monthlyData.push({
        month: MONTH_NAMES[date.getMonth()],
        // Mês no formato 'YYYY-MM': é o que permite clicar na barra e cair no
        // extrato DAQUELE mês. Sem ele, o rótulo ("Jan") não diz o ano.
        monthKey: key,
        receitas: receipts + extraReceipts,
        despesas: expensesValue,
        lucro: receipts + extraReceipts - expensesValue,
      });
    }

    // monthExpenses (não expenses): esse gráfico fica ao lado de "Despesas do
    // mês" e dos outros cartões mensais — sem esse filtro ele somava o
    // histórico INTEIRO (todos os meses desde sempre) num painel que só fala
    // de "mês", crescendo sem parar e sem nenhuma indicação de que não era
    // o gasto do mês atual.
    const catMap = {};
    monthExpenses.forEach((expense) => {
      const category = expense.category || 'outro';
      catMap[category] = (catMap[category] || 0) + (expense.value || 0);
    });

    // Rótulos vêm do categoryReportService (fonte única), senão categorias
    // novas como "energia_solar"/"moveis" apareciam com o código cru no gráfico.
    // `category` guarda a chave crua junto com o rótulo: o gráfico mostra
    // "Energia" mas precisa de "energia" para abrir a tela de Despesas já
    // filtrada nessa tag.
    const categoryData = Object.entries(catMap).map(([key, value]) => ({
      name: categoryLabel(key),
      category: key,
      value,
    }));

    return {
      revenue,
      expenseTotal,
      profit: revenue - expenseTotal,
      overdue: overdue.length,
      overdueValue: overdue.reduce((sum, receivable) => sum + outstandingValue(receivable), 0),
      receitaPrevista,
      upcoming: upcoming.length,
      occupied,
      vacant,
      totalKitnets: kitnets.length,
      // Mês que os cartões e o gráfico de categorias representam — vai junto no
      // link para a tela de destino abrir no mesmo mês que está sendo olhado.
      currentMonth,
      // Como está o aluguel de CADA unidade neste mês. Substitui o donut de
      // "ocupadas x vagas", que só repetia os cartões de cima. A pergunta real
      // do dia a dia é "quem já me pagou?", e a resposta aqui é por unidade,
      // clicável, e cobre também as vagas (que não têm aluguel a receber).
      unitStatus: kitnets
        .map((kitnet) => {
          const receivable = currentMonthReceivables.find((row) => row.kitnet_id === kitnet.id);
          const rentStatus = receivable ? getReceivableStatus(receivable, today) : '';

          return {
            id: kitnet.id,
            name: kitnet.name,
            occupancy: kitnet.status,
            // '' quando a unidade está vaga ou sem recebível gerado no mês.
            rentStatus,
            outstanding: receivable ? outstandingValue(receivable) : 0,
            dueDate: receivable?.due_date || '',
            receivableId: receivable?.id || '',
          };
        })
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR', { numeric: true })),
      expiringContracts: expiringContracts.length,
      monthlyData,
      categoryData,
      actionItems: buildActionItems(receivables, contracts, kitnets, tenants, today),
    };
  },
};
