import { repository as appRepository } from '../../../repository/index.js';
import { RECEIVABLE_STATUS } from '../types/receivable.types.js';

const ENTITY = 'Receivable';
const PAYMENT_ENTITY = 'Payment';
const CONTRACT_ENTITY = 'Contract';
const KITNET_ENTITY = 'Kitnet';
const TENANT_ENTITY = 'Tenant';
const BANK_ACCOUNT_ENTITY = 'BankAccount';

const normalize = (row = {}) => ({ ...row });

const VALID_STATUS = Object.values(RECEIVABLE_STATUS);

// Guarda de escrita. O `status` é gravado dentro de um jsonb livre, sem
// constraint no banco, então qualquer string entrava: foi assim que 'previsto'
// (vocabulário de PersonalIncome) e 'não alugada' contaminaram 27% dos
// registros. Como getReceivableStatus normaliza valores desconhecidos para
// "pendente", o erro ficava invisível na tela e só aparecia nos totais que
// filtram pelo campo cru. Falhar aqui é a única forma de não recair.
const assertValidStatus = (payload = {}) => {
  if (payload.status === undefined || payload.status === null) return payload;
  if (!VALID_STATUS.includes(payload.status)) {
    throw new Error(
      `Status de recebível inválido: "${payload.status}". Valores aceitos: ${VALID_STATUS.join(', ')}.`,
    );
  }
  return payload;
};

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
    return appRepository.create(ENTITY, assertValidStatus(payload));
  },

  async update(id, payload) {
    return appRepository.update(ENTITY, id, assertValidStatus(payload));
  },

  async softDelete(id) {
    return appRepository.removeSoft(ENTITY, id);
  },

  async restore(id) {
    return this.update(id, { active: true });
  },

  async pay(receivable, paymentPayload) {
    return appRepository.payReceivable(receivable, paymentPayload);
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

  async listPaymentsByReceivable(receivableId) {
    const rows = await appRepository.list(PAYMENT_ENTITY);
    return rows.filter((row) => row.receivable_id === receivableId);
  },

  async getNextReceiptNumber() {
    const rows = await appRepository.list(PAYMENT_ENTITY);
    const year = new Date().getFullYear();
    const next = rows.filter((row) => String(row.receipt_number || '').startsWith(`${year}-`)).length + 1;

    return `${year}-${String(next).padStart(4, '0')}`;
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

  async getBankAccountName(bankAccountId) {
    if (!bankAccountId) return '';
    const accounts = await appRepository.list(BANK_ACCOUNT_ENTITY);
    return accounts.find((account) => account.id === bankAccountId)?.name || '';
  },

  async getContext() {
    const [receivables, contracts, kitnets, tenants, payments] = await Promise.all([
      this.list(),
      appRepository.list(CONTRACT_ENTITY),
      appRepository.list(KITNET_ENTITY),
      appRepository.list(TENANT_ENTITY),
      appRepository.list(PAYMENT_ENTITY),
    ]);

    return { receivables, contracts, kitnets, tenants, payments };
  },
};

export default receivableRepository;
