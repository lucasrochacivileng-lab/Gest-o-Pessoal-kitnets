const EXPENSE_TYPES = new Set(['expense', 'card_transaction']);
const TRANSFER_TYPES = new Set(['transfer', 'investment_transfer']);

// Pagamento da FATURA do cartão. Não é um gasto novo: o gasto já foi contado
// quando a compra entrou (card_transaction). Ele é a quitação da dívida do
// cartão — dinheiro saindo do banco para o cartão. Contar a compra E o
// pagamento da fatura como gasto seria contar duas vezes a mesma coisa.
export const CARD_PAYMENT_TYPE = 'card_payment';

// Tipos que realmente movem a CONTA BANCÁRIA (saída de dinheiro):
// - 'expense': boleto/Pix pago direto da conta.
// - 'card_payment': o pagamento da fatura.
// Comprar no cartão (card_transaction) é gasto, mas NÃO tira dinheiro da conta
// no ato — por isso fica fora daqui. Quem tira é a fatura, no vencimento.
const BANK_OUTFLOW_TYPES = new Set(['expense', CARD_PAYMENT_TYPE]);

/** É gasto (entra em "gastos por categoria" e no resultado). */
export const isPersonalExpense = (row = {}) => EXPENSE_TYPES.has(row.type);

/** Movimento entre contas próprias / aplicação — nunca é gasto. */
export const isPersonalTransfer = (row = {}) => TRANSFER_TYPES.has(row.type);

/** Pagamento de fatura de cartão: sai do banco, quita o cartão, não é gasto. */
export const isCardPayment = (row = {}) => row.type === CARD_PAYMENT_TYPE;

/** Tira dinheiro da conta bancária (para saldo/conciliação do banco). */
export const leavesBankAccount = (row = {}) => BANK_OUTFLOW_TYPES.has(row.type);
