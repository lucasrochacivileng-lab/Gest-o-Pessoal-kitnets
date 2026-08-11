export const NOTIFICATION_STATUS = {
  PENDING: 'pendente',
  SENT: 'enviada',
  CONFIRMED: 'confirmada',
  ERROR: 'erro',
  IGNORED: 'ignorada',
  // Fechada sozinha porque o dado cadastrado já resolveu a pendência: o aluguel
  // foi recebido pela tela de Recebimentos, a conta foi paga em Despesas, o
  // contrato foi encerrado. Diferente de CONFIRMED, que é o usuário respondendo
  // "sim, foi pago" na caixa de pendências.
  RESOLVED: 'resolvida',
};

export const NOTIFICATION_TYPE = {
  EXPENSE_DUE: 'expense_due',
  RENT_DUE: 'rent_due',
  CONTRACT_DUE: 'contract_due',
  CONTRACT_ADJUST: 'contract_adjust',
  PROJECT_PAYMENT_DUE: 'project_payment_due',
};

export const NOTIFICATION_EVENT = {
  CREATED: 'created',
  SENT: 'sent',
  OPENED: 'opened',
  CONFIRMED: 'confirmed',
  SNOOZED: 'snoozed',
  IGNORED: 'ignored',
  ERROR: 'error',
  RESOLVED: 'resolved',
  // O texto do alerta foi reescrito a partir do dado atual (o valor ou a data
  // mudaram depois que a notificação foi criada).
  REFRESHED: 'refreshed',
};

export const NOTIFICATION_ENTITY = {
  EXPENSE: 'Expense',
  RECEIVABLE: 'Receivable',
  CONTRACT: 'Contract',
  PROJECT: 'ComplementaryProject',
  EXPERT_REPORT: 'ExpertReport',
};

export const notificationStatusLabels = {
  [NOTIFICATION_STATUS.PENDING]: 'Pendente',
  [NOTIFICATION_STATUS.SENT]: 'Enviada',
  [NOTIFICATION_STATUS.CONFIRMED]: 'Confirmada',
  [NOTIFICATION_STATUS.ERROR]: 'Erro',
  [NOTIFICATION_STATUS.IGNORED]: 'Ignorada',
  [NOTIFICATION_STATUS.RESOLVED]: 'Resolvida',
};

export const notificationTypeLabels = {
  [NOTIFICATION_TYPE.EXPENSE_DUE]: 'Conta/despesa a vencer',
  [NOTIFICATION_TYPE.RENT_DUE]: 'Aluguel a vencer',
  [NOTIFICATION_TYPE.CONTRACT_DUE]: 'Contrato a vencer',
  [NOTIFICATION_TYPE.CONTRACT_ADJUST]: 'Reajuste anual de aluguel',
  [NOTIFICATION_TYPE.PROJECT_PAYMENT_DUE]: 'Recebimento de projeto/perícia',
};
