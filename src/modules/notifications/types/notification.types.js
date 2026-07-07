export const NOTIFICATION_STATUS = {
  PENDING: 'pendente',
  SENT: 'enviada',
  CONFIRMED: 'confirmada',
  ERROR: 'erro',
  IGNORED: 'ignorada',
};

export const NOTIFICATION_TYPE = {
  EXPENSE_DUE: 'expense_due',
  RENT_DUE: 'rent_due',
  CONTRACT_DUE: 'contract_due',
};

export const NOTIFICATION_EVENT = {
  CREATED: 'created',
  SENT: 'sent',
  OPENED: 'opened',
  CONFIRMED: 'confirmed',
  SNOOZED: 'snoozed',
  IGNORED: 'ignored',
  ERROR: 'error',
};

export const NOTIFICATION_ENTITY = {
  EXPENSE: 'Expense',
  RECEIVABLE: 'Receivable',
  CONTRACT: 'Contract',
};

export const notificationStatusLabels = {
  [NOTIFICATION_STATUS.PENDING]: 'Pendente',
  [NOTIFICATION_STATUS.SENT]: 'Enviada',
  [NOTIFICATION_STATUS.CONFIRMED]: 'Confirmada',
  [NOTIFICATION_STATUS.ERROR]: 'Erro',
  [NOTIFICATION_STATUS.IGNORED]: 'Ignorada',
};

export const notificationTypeLabels = {
  [NOTIFICATION_TYPE.EXPENSE_DUE]: 'Conta/despesa a vencer',
  [NOTIFICATION_TYPE.RENT_DUE]: 'Aluguel a vencer',
  [NOTIFICATION_TYPE.CONTRACT_DUE]: 'Contrato a vencer',
};
