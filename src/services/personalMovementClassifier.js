const EXPENSE_TYPES = new Set(['expense', 'card_transaction']);
const TRANSFER_TYPES = new Set(['transfer', 'investment_transfer']);

export const isPersonalExpense = (row = {}) => EXPENSE_TYPES.has(row.type);
export const isPersonalTransfer = (row = {}) => TRANSFER_TYPES.has(row.type);
