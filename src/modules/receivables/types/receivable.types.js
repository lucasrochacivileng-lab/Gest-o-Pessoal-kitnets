export const RECEIVABLE_STATUS = {
  PENDING: 'pendente',
  PARTIAL: 'parcial',
  PAID: 'pago',
  OVERDUE: 'vencido',
};

export const RECEIVABLE_FILTERS = {
  ALL: 'all',
  OVERDUE: 'vencidos',
  UPCOMING: 'avencer',
  PAID: 'pagos',
  PARTIAL: 'parciais',
  THIS_MONTH: 'mes',
};

export const createReceivableDraft = (contract = {}) => ({
  contract_id: contract.id || '',
  competence: '',
  expected_value: contract.rent_value || 0,
  due_date: '',
  status: RECEIVABLE_STATUS.PENDING,
  notes: '',
  active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'local-user',
  updated_by: 'local-user',
});
