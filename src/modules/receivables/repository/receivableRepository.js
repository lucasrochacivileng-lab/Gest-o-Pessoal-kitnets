import { repository as appRepository } from '../../../repository/index.js';

const ENTITY = 'Receivable';
const PAYMENT_ENTITY = 'Payment';
const CONTRACT_ENTITY = 'Contract';
const KITNET_ENTITY = 'Kitnet';
const TENANT_ENTITY = 'Tenant';

const normalize = (row = {}) => ({ ...row });

export const receivableRepository = {
  async list() {
    const rows = await appRepository.list(ENTITY);
    return rows.map(normalize);
  },

  async getById(id) {
    const rows = await this.list();
    return rows.find((row) => row.id === id) || null;
  },

  async create(payload) {
    return appRepository.create(ENTITY, payload);
  },

  async update(id, payload) {
    return appRepository.update(ENTITY, id, payload);
  },

  async softDelete(id) {
    return appRepository.removeSoft(ENTITY, id);
  },

  async restore(id) {
    return this.update(id, { active: true });
  },

  async pay(receivable, paymentPayload) {
    const payment = await appRepository.create(PAYMENT_ENTITY, paymentPayload);
    const updatedReceivable = await appRepository.update(ENTITY, receivable.id, {
      status: paymentPayload.status || receivable.status,
      updated_at: paymentPayload.updated_at,
      updated_by: paymentPayload.updated_by,
      paid_value: paymentPayload.paid_value,
    });

    return { payment, receivable: updatedReceivable };
  },

  async listOverdue() {
    const rows = await this.list();
    return rows.filter((row) => row.status === 'vencido');
  },

  async listPending() {
    const rows = await this.list();
    return rows.filter((row) => row.status === 'pendente');
  },

  async listPaid() {
    const rows = await this.list();
    return rows.filter((row) => row.status === 'pago');
  },

  async listByKitnet(kitnetId) {
    const [rows, contracts] = await Promise.all([this.list(), appRepository.list(CONTRACT_ENTITY)]);
    const contractIds = contracts.filter((contract) => contract.kitnet_id === kitnetId).map((contract) => contract.id);
    return rows.filter((row) => contractIds.includes(row.contract_id));
  },

  async listByContract(contractId) {
    const rows = await this.list();
    return rows.filter((row) => row.contract_id === contractId);
  },

  async listByTenant(tenantId) {
    const [rows, contracts] = await Promise.all([this.list(), appRepository.list(CONTRACT_ENTITY)]);
    const contractIds = contracts.filter((contract) => contract.tenant_id === tenantId).map((contract) => contract.id);
    return rows.filter((row) => contractIds.includes(row.contract_id));
  },

  async getContext() {
    const [receivables, contracts, kitnets, tenants] = await Promise.all([
      this.list(),
      appRepository.list(CONTRACT_ENTITY),
      appRepository.list(KITNET_ENTITY),
      appRepository.list(TENANT_ENTITY),
    ]);

    return { receivables, contracts, kitnets, tenants };
  },
};

export default receivableRepository;
