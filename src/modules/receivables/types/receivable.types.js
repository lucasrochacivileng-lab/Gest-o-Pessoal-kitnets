export const RECEIVABLE_STATUS = {
  PENDING: 'pendente',
  PARTIAL: 'parcial',
  PAID: 'pago',
  OVERDUE: 'vencido',
  // Mês que não será cobrado: unidade vaga, mês perdoado ou contrato encerrado
  // antes do fim. Sem esse status não havia como registrar uma vacância — o que
  // levou alguém a inventar "não alugada", que era inerte (virava "pendente" na
  // tela e ainda entrava como receita esperada na Previsão).
  CANCELLED: 'cancelado',
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
});
