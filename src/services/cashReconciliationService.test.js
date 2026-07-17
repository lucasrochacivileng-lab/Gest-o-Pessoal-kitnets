import { describe, expect, it } from 'vitest';
import { buildCashReconciliation } from './cashReconciliationService.js';

describe('cashReconciliationService', () => {
  it('calcula o saldo da conta sem duplicar transferencias no total', () => {
    const result = buildCashReconciliation({
      accounts: [
        { id: 'a', opening_date: '2026-07-01', opening_balance: 1000, balance_date: '2026-07-31', actual_balance: 700 },
        { id: 'b', opening_date: '2026-07-01', opening_balance: 100, balance_date: '2026-07-31', actual_balance: 400 },
      ],
      expenses: [{ id: 'e', bank_account_id: 'a', date: '2026-07-05', value: 200, status: 'pago' }],
      bankMovements: [{ id: 't', type: 'transferencia', bank_account_id: 'a', destination_account_id: 'b', date: '2026-07-10', value: 300 }],
    });

    expect(result.accounts[0].calculatedBalance).toBe(500);
    expect(result.accounts[1].calculatedBalance).toBe(400);
    expect(result.calculatedTotal).toBe(900);
    expect(result.differenceTotal).toBe(200);
  });

  it('ignora lancamentos anteriores ao saldo de partida', () => {
    const result = buildCashReconciliation({
      accounts: [{ id: 'a', opening_date: '2026-07-12', opening_balance: 500, balance_date: '2026-07-12', actual_balance: 500 }],
      expenses: [{ bank_account_id: 'a', date: '2026-07-10', value: 200, status: 'pago' }],
    });
    expect(result.accounts[0].calculatedBalance).toBe(500);
    expect(result.differenceTotal).toBe(0);
  });

  it('compra no cartão não sai do banco; quem sai é o pagamento da fatura', () => {
    const result = buildCashReconciliation({
      accounts: [{ id: 'a', opening_date: '2026-07-01', opening_balance: 5000, balance_date: '2026-07-31', actual_balance: 3500 }],
      personal: [
        // Compra no cartão: é gasto, mas não tira dinheiro da conta agora.
        { type: 'card_transaction', bank_account_id: 'a', date: '2026-07-10', value: 2000, status: 'pago' },
        // Pagamento da fatura: aí sim sai do banco (e não é gasto novo).
        { type: 'card_payment', bank_account_id: 'a', date: '2026-07-05', value: 1500, status: 'pago' },
      ],
    });

    // 5000 - 1500 (só a fatura) = 3500. Se a compra também descontasse, daria
    // 1500 e o saldo calculado nunca bateria com o extrato do banco.
    expect(result.accounts[0].calculatedBalance).toBe(3500);
    expect(result.differenceTotal).toBe(0);
  });

  it('ignora Payment sem vínculo de aluguel', () => {
    const result = buildCashReconciliation({
      accounts: [{ id: 'a', opening_date: '2026-07-01', opening_balance: 0, balance_date: '2026-07-31', actual_balance: 1000 }],
      payments: [
        { bank_account_id: 'a', payment_date: '2026-07-02', paid_value: 2000 },
        { receivable_id: 'r1', bank_account_id: 'a', payment_date: '2026-07-10', paid_value: 1000 },
      ],
    });

    expect(result.calculatedTotal).toBe(1000);
    expect(result.differenceTotal).toBe(0);
  });
});
