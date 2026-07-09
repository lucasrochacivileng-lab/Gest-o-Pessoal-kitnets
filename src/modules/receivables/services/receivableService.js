import receivableRepository from '../repository/receivableRepository.js';
import { RECEIVABLE_FILTERS, RECEIVABLE_STATUS } from '../types/receivable.types.js';

const formatDate = (value) => value || '';
const today = () => new Date().toISOString().slice(0, 10);
const toMoney = (value) => Number(value || 0);

export const getReceivableStatus = (receivable, currentDate = today()) => {
  if (receivable.status === RECEIVABLE_STATUS.PAID) return RECEIVABLE_STATUS.PAID;
  if (receivable.due_date && receivable.due_date < currentDate) return RECEIVABLE_STATUS.OVERDUE;
  if (receivable.status === RECEIVABLE_STATUS.PARTIAL) return RECEIVABLE_STATUS.PARTIAL;
  return RECEIVABLE_STATUS.PENDING;
};

export const calculatePaymentNetValue = ({ paid_value = 0, discount = 0, fine = 0, interest = 0 } = {}) => {
  return toMoney(paid_value) - toMoney(discount) + toMoney(fine) + toMoney(interest);
};

export const calculateOutstandingValue = (receivable) => {
  return Math.max(toMoney(receivable.expected_value) - toMoney(receivable.paid_value), 0);
};

const withContext = (receivables, contracts = [], kitnets = [], tenants = [], payments = []) => {
  return receivables.map((receivable) => {
    const contract = contracts.find((item) => item.id === receivable.contract_id) || null;
    const kitnet = contract ? kitnets.find((item) => item.id === contract.kitnet_id) || null : null;
    const tenant = contract ? tenants.find((item) => item.id === contract.tenant_id) || null : null;
    const paymentHistory = payments
      .filter((item) => item.receivable_id === receivable.id)
      .sort((a, b) => String(b.payment_date || '').localeCompare(String(a.payment_date || '')));

    return {
      ...receivable,
      status: getReceivableStatus(receivable),
      contract,
      kitnet,
      tenant,
      payments: paymentHistory,
    };
  });
};

// Regra pura: dado o mês (competência 'YYYY-MM'), monta os recebíveis que faltam
// para contratos vigentes, sem duplicar os que já existem.
export const buildReceivablesForCompetence = (contracts = [], receivables = [], competence) => {
  const existing = new Set(receivables.map((row) => `${row.contract_id}|${row.competence}`));

  return contracts
    .filter((contract) => !contract.status || contract.status === 'ativo')
    .filter((contract) => {
      const start = String(contract.start_date || '').slice(0, 7);
      const end = String(contract.end_date || '').slice(0, 7);
      if (start && competence < start) return false;
      if (end && competence > end) return false;
      return true;
    })
    .filter((contract) => !existing.has(`${contract.id}|${competence}`))
    .map((contract) => {
      const [year, month] = competence.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const dueDay = Math.min(Math.max(Number(contract.due_day) || 10, 1), daysInMonth);

      return {
        contract_id: contract.id,
        kitnet_id: contract.kitnet_id,
        tenant_id: contract.tenant_id,
        competence,
        expected_value: toMoney(contract.rent_value),
        due_date: `${competence}-${String(dueDay).padStart(2, '0')}`,
        status: RECEIVABLE_STATUS.PENDING,
        notes: '',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'local-user',
        updated_by: 'local-user',
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
    const { receivables, contracts, kitnets, tenants, payments } = await receivableRepository.getContext();
    const data = withContext(receivables, contracts, kitnets, tenants, payments);

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
      .reduce((sum, row) => sum + toMoney(row.net_value ?? row.paid_value ?? row.expected_value), 0);
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
      // "??" e net_value primeiro, igual a calculateReceivedValue e ao
      // financialService.netPaymentValue: "||" faria um pagamento de R$ 0,00
      // intencional (mês perdoado, status pago) cair para o expected_value
      // cheio, inflando "Recebido no mês" — o card divergia do valor real.
      receivedThisMonthValue: receivedThisMonth.reduce((sum, row) => sum + toMoney(row.net_value ?? row.paid_value ?? row.expected_value), 0),
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

  async generateForCompetence(competence) {
    const { receivables, contracts } = await receivableRepository.getContext();
    const toCreate = buildReceivablesForCompetence(contracts, receivables, competence);

    for (const payload of toCreate) {
      await receivableRepository.create(payload);
    }

    return { created: toCreate.length };
  },

  async registerPayment(receivable, paymentPayload) {
    // "??" (não "||"): um pagamento de R$ 0,00 intencional (ex.: mês
    // perdoado) é um valor válido e não pode virar "não informado" só
    // porque 0 é falsy — isso silenciosamente lançaria o valor cheio.
    const paidValue = toMoney(paymentPayload.paid_value ?? receivable.expected_value);
    const discount = toMoney(paymentPayload.discount);
    const fine = toMoney(paymentPayload.fine);
    const interest = toMoney(paymentPayload.interest);
    const netValue = calculatePaymentNetValue({ paid_value: paidValue, discount, fine, interest });
    const totalPaid = paidValue + toMoney(receivable.paid_value);
    const status = totalPaid >= toMoney(receivable.expected_value) ? RECEIVABLE_STATUS.PAID : RECEIVABLE_STATUS.PARTIAL;
    const receiptNumber = await receivableRepository.getNextReceiptNumber();

    const payload = {
      ...paymentPayload,
      receivable_id: receivable.id,
      receipt_number: receiptNumber,
      paid_value: paidValue,
      net_value: netValue,
      payment_date: formatDate(paymentPayload.payment_date || today()),
      payment_method: paymentPayload.payment_method || 'pix',
      destination_account: paymentPayload.destination_account || 'Mercado Pago',
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
    return { ...result, netValue, status, receiptNumber };
  },

  async updateReceivable(receivable, payload) {
    return receivableRepository.update(receivable.id, {
      contract_id: payload.contract_id,
      competence: payload.competence,
      expected_value: toMoney(payload.expected_value),
      due_date: formatDate(payload.due_date),
      notes: payload.notes || '',
      updated_at: new Date().toISOString(),
      updated_by: payload.updated_by || 'local-user',
    });
  },
};

export default receivableService;
