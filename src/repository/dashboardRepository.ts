import { repository } from './index.js';

export const dashboardRepository = {
  getKitnets() {
    return repository.list('Kitnet');
  },
  getReceivables() {
    return repository.list('Receivable');
  },
  getPayments() {
    return repository.list('Payment');
  },
  getExpenses() {
    return repository.list('Expense');
  },
  getContracts() {
    return repository.list('Contract');
  },
  getTenants() {
    return repository.list('Tenant');
  },
};
