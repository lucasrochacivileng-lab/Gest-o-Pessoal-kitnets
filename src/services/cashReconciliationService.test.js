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
});
