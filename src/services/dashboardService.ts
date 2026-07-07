import { dashboardRepository } from '../repository/dashboardRepository';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const moneyValue = (value) => Number(value || 0);
const outstandingValue = (receivable) => Math.max(moneyValue(receivable.expected_value) - moneyValue(receivable.paid_value), 0);
const paymentValue = (payment) => moneyValue(payment.net_value || payment.paid_value);
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

export const dashboardService = {
  async getDashboardData() {
    const [kitnets, receivables, payments, expenses, contracts] = await Promise.all([
      dashboardRepository.getKitnets(),
      dashboardRepository.getReceivables(),
      dashboardRepository.getPayments(),
      dashboardRepository.getExpenses(),
      dashboardRepository.getContracts(),
    ]);

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = now.toISOString().split('T')[0];

    const monthPayments = payments.filter((payment) => payment.payment_date && payment.payment_date.startsWith(currentMonth));
    const monthExpenses = expenses.filter((expense) => expense.date && expense.date.startsWith(currentMonth));
    const revenue = monthPayments.reduce((sum, payment) => sum + paymentValue(payment), 0);
    const expenseTotal = monthExpenses.reduce((sum, expense) => sum + (expense.value || 0), 0);

    const overdue = receivables.filter((receivable) => receivable.status === 'vencido' || (receivable.status === 'pendente' && receivable.due_date && receivable.due_date < today));
    const upcoming = receivables.filter((receivable) => receivable.status === 'pendente' && receivable.due_date && receivable.due_date >= today);
    const receitaPrevista = receivables.filter((receivable) => ['pendente', 'vencido', 'parcial'].includes(receivable.status)).reduce((sum, receivable) => sum + outstandingValue(receivable), 0);

    const occupied = kitnets.filter((kitnet) => kitnet.status === 'ocupada').length;
    const vacant = kitnets.filter((kitnet) => kitnet.status === 'vaga').length;

    const alertDaysFromNow = new Date(now);
    alertDaysFromNow.setDate(alertDaysFromNow.getDate() + getContractAlertDays());
    const alertDaysStr = alertDaysFromNow.toISOString().split('T')[0];
    const expiringContracts = contracts.filter((contract) => contract.status === 'ativo' && contract.end_date && contract.end_date <= alertDaysStr && contract.end_date >= today);

    const monthlyData = [];
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthPaymentsForKey = payments.filter((payment) => payment.payment_date && payment.payment_date.startsWith(key));
      const monthExpensesForKey = expenses.filter((expense) => expense.date && expense.date.startsWith(key));
      const receipts = monthPaymentsForKey.reduce((sum, payment) => sum + paymentValue(payment), 0);
      const expensesValue = monthExpensesForKey.reduce((sum, expense) => sum + (expense.value || 0), 0);

      monthlyData.push({
        month: MONTH_NAMES[date.getMonth()],
        receitas: receipts,
        despesas: expensesValue,
        lucro: receipts - expensesValue,
      });
    }

    const catMap = {};
    expenses.forEach((expense) => {
      const category = expense.category || 'outro';
      catMap[category] = (catMap[category] || 0) + (expense.value || 0);
    });

    const catLabels = {
      manutencao: 'Manutenção',
      agua: 'Água',
      luz: 'Luz',
      internet: 'Internet',
      iptu: 'IPTU',
      seguro: 'Seguro',
      limpeza: 'Limpeza',
      material: 'Material',
      pessoal: 'Pessoal',
      obra: 'Obra',
      outro: 'Outro',
    };

    const categoryData = Object.entries(catMap).map(([key, value]) => ({
      name: catLabels[key] || key,
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
      expiringContracts: expiringContracts.length,
      monthlyData,
      categoryData,
    };
  },
};
