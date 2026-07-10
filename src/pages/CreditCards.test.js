import { describe, expect, it } from 'vitest';
import { filterCardTransactions } from './CreditCards.jsx';

describe('filterCardTransactions', () => {
  it('mostra so as linhas de cartao, nao as receitas/despesas pessoais comuns que dividem a mesma entidade', () => {
    const rows = [
      { id: 'card-1', type: 'card_transaction', description: 'Compra cartao' },
      { id: 'income-1', type: 'income', description: 'Salario' },
      { id: 'expense-1', type: 'expense', description: 'Aluguel de casa' },
      { id: 'sem-tipo' },
    ];

    expect(filterCardTransactions(rows).map((row) => row.id)).toEqual(['card-1']);
  });
});
