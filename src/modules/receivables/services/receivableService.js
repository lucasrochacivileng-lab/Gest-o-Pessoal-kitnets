import receivableRepository from '../repository/receivableRepository.js';
import { RECEIVABLE_FILTERS, RECEIVABLE_STATUS } from '../types/receivable.types.js';

const formatDate = (value) => value || '';
const today = () => new Date().toISOString().slice(0, 10);
const toMoney = (value) => Number(value || 0);

export const getReceivableStatus = (receivable, currentDate = today()) => {
  if (receivable.status === RECEIVABLE_STATUS.PAID) return RECEIVABLE_STATUS.PAID;
  if (receivable.status === RECEIVABLE_STATUS.PARTIAL) return RECEIVABLE_STATUS.PARTIAL;
  if (receivable.due_date && receivable.due_date < currentDate) return RECEIVABLE_STATUS.OVERDUE;
  return RECEIVABLE_STATUS.PENDING;
};

export const calculatePaymentNetValue = ({ paid_value = 0, discount = 0, fine = 0, interest = 0 } = {}) => {
  return toMoney(paid_value) - toMoney(discount) + toMoney(fine) + toMoney(interest);
};

export const calculateOutstandingValue = (receivable) => {
  return Math.max(toMoney(receivable.expected_value) - toMoney(receivable.paid_value), 0);
};

const withContext = (receivables, contracts = [], kitnets = [], tenants = []) => {
  return receivables.map((receivable) => {
    const contract = contracts.find((item) => item.id === receivable.contract_id) || null;
    const kitnet = contract ? kitnets.find((item) => item.id === contract.kitnet_id) || null : null;
    const tenant = contract ? tenants.find((item) => item.id === contract.tenant_id) || null : null;

    return {
      ...receivable,
      status: getReceivableStatus(receivable),
      contract,
      kitnet,
      tenant,
    };
  });
};

const matchesSearch = (row, search) => {
  const text = [
    row.competence,
    row.due_date,
    row.status,
    row.notes,
    row.kitnet?.name,
    row.tenant?.name,
  ].filter(Boolean).join(' ').toLowerCase();

  return text.includes(search.toLowerCase());
};

export const receivableService = {
  async create(payload) {
    return receivableRepository.create(payload);
  },

  async update(id, payload) {
    return receivableRepository.update(id, payload);
  },

  async remove(id) {
    return receivableRepository.softDelete(id);
  },

  async restore(id) {
    return receivableRepository.restore(id);
  },

  async loadPageData() {
    const { receivables, contracts, kitnets, tenants } = await receivableRepository.getContext();
    const data = withContext(receivables, contracts, kitnets, tenants);

    return {
      receivables: data,
      summary: this.getSummary(data),
      contracts,
      kitnets,
      tenants,
    };
  },

  filterReceivables(receivables, filters = {}) {
    const {
      statusFilter = RECEIVABLE_FILTERS.ALL,
      search = '',
      kitnetFilter = '',
      contractFilter = '',
      tenantFilter = '',
      competenceFilter = '',
    } = filters;
    const currentDate = today();

    return receivables.filter((row) => {
      const status = getReceivableStatus(row, currentDate);
      const currentMonth = currentDate.slice(0, 7);

      if (kitnetFilter && row.kitnet?.id !== kitnetFilter) return false;
      if (contractFilter && row.contract_id !== contractFilter) return false;
      if (tenantFilter && row.tenant?.id !== tenantFilter) return false;
      if (competenceFilter && row.competence !== competenceFilter) return false;

      if (statusFilter === RECEIVABLE_FILTERS.OVERDUE) return status === RECEIVABLE_STATUS.OVERDUE;
      if (statusFilter === RECEIVABLE_FILTERS.UPCOMING) return status === RECEIVABLE_STATUS.PENDING && row.due_date && row.due_date >= currentDate;
      if (statusFilter === RECEIVABLE_FILTERS.PAID) return status === RECEIVABLE_STATUS.PAID;
      if (statusFilter === RECEIVABLE_FILTERS.PARTIAL) return status === RECEIVABLE_STATUS.PARTIAL;
      if (statusFilter === RECEIVABLE_FILTERS.THIS_MONTH) return row.competence?.startsWith(currentMonth);
      return true;
    }).filter((row) => !search || matchesSearch(row, search));
  },

  calculateOverdueValue(receivables) {
    return receivables
      .filter((row) => row.status === RECEIVABLE_STATUS.OVERDUE)
      .reduce((sum, row) => sum + calculateOutstandingValue(row), 0);
  },

  calculateReceivedValue(receivables) {
    return receivables
      .filter((row) => row.status === RECEIVABLE_STATUS.PAID)
      .reduce((sum, row) => sum + toMoney(row.paid_value || row.expected_value), 0);
  },

  getSummary(receivables) {
    const currentDate = today();
    const next7Limit = new Date(new Date(currentDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayReceivables = receivables.filter((row) => row.due_date === currentDate && row.status !== RECEIVABLE_STATUS.PAID);
    const overdueReceivables = receivables.filter((row) => row.status === RECEIVABLE_STATUS.OVERDUE);
    const next7Days = receivables.filter((row) => row.status === RECEIVABLE_STATUS.PENDING && row.due_date && row.due_date >= currentDate && row.due_date <= next7Limit);
    const receivedThisMonth = receivables.filter((row) => row.status === RECEIVABLE_STATUS.PAID && row.competence?.startsWith(currentDate.slice(0, 7)));

    return {
      toReceiveToday: todayReceivables.reduce((sum, row) => sum + calculateOutstandingValue(row), 0),
      overdueValue: overdueReceivables.reduce((sum, row) => sum + calculateOutstandingValue(row), 0),
      next7DaysValue: next7Days.reduce((sum, row) => sum + calculateOutstandingValue(row), 0),
      receivedThisMonthValue: receivedThisMonth.reduce((sum, row) => sum + toMoney(row.paid_value || row.expected_value), 0),
    };
  },

  getOverdueReceivables(receivables) {
    return receivables.filter((row) => row.status === RECEIVABLE_STATUS.OVERDUE);
  },

  getPendingReceivables(receivables) {
    return receivables.filter((row) => row.status === RECEIVABLE_STATUS.PENDING);
  },

  getPaidReceivables(receivables) {
    return receivables.filter((row) => row.status === RECEIVABLE_STATUS.PAID);
  },

  getReceivablesByKitnet(receivables, kitnetId) {
    return receivables.filter((row) => row.kitnet?.id === kitnetId);
  },

  getReceivablesByContract(receivables, contractId) {
    return receivables.filter((row) => row.contract_id === contractId);
  },

  getReceivablesByTenant(receivables, tenantId) {
    return receivables.filter((row) => row.tenant?.id === tenantId);
  },

  async registerPayment(receivable, paymentPayload) {
    const paidValue = toMoney(paymentPayload.paid_value || receivable.expected_value);
    const discount = toMoney(paymentPayload.discount);
    const fine = toMoney(paymentPayload.fine);
    const interest = toMoney(paymentPayload.interest);
    const netValue = calculatePaymentNetValue({ paid_value: paidValue, discount, fine, interest });
    const totalPaid = paidValue + toMoney(receivable.paid_value);
    const status = totalPaid >= toMoney(receivable.expected_value) ? RECEIVABLE_STATUS.PAID : RECEIVABLE_STATUS.PARTIAL;

    const payload = {
      ...paymentPayload,
      receivable_id: receivable.id,
      paid_value: paidValue,
      net_value: netValue,
      payment_date: formatDate(paymentPayload.payment_date || today()),
      payment_method: paymentPayload.payment_method || 'pix',
      destination_account: paymentPayload.destination_account || 'Itaú',
      notes: paymentPayload.notes || '',
      discount,
      interest,
      fine,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: paymentPayload.created_by || 'local-user',
      updated_by: paymentPayload.updated_by || 'local-user',
      status,
    };

    const result = await receivableRepository.pay(receivable, payload);
    return { ...result, netValue, status };
  },
};

export default receivableService;
