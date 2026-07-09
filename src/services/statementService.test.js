import { describe, expect, it } from 'vitest';
import { buildStatement } from './statementService.js';

describe('statementService', () => {
  const kitnets = [{ id: 'k1', name: 'Kitnet 01' }];
  const tenants = [{ id: 't1', name: 'Maria' }];
  const contracts = [{ id: 'c1', kitnet_id: 'k1', tenant_id: 't1' }];
  const receivables = [{ id: 'r1', contract_id: 'c1', kitnet_id: 'k1', tenant_id: 't1', competence: '2026-07' }];

  it('resolve a origem do pagamento pela cadeia receivable -> contract', () => {
    const payments = [{ id: 'p1', receivable_id: 'r1', payment_date: '2026-07-10', paid_value: 800 }];

    const result = buildStatement({ payments, receivables, contracts, kitnets, tenants, monthKey: '2026-07' });

    expect(result.movements).toHaveLength(1);
    expect(result.movements[0].label).toBe('Aluguel — Kitnet 01');
    expect(result.movements[0].detail).toBe('Maria · 2026-07');
    expect(result.movements[0].kind).toBe('entrada');
    expect(result.totalIn).toBe(800);
  });

  it('só conta despesas pagas como saída realizada; pendentes vão para a lista separada', () => {
    const expenses = [
      { id: 'e1', date: '2026-07-05', description: 'Água', value: 90, status: 'pago', kitnet_id: 'k1' },
      { id: 'e2', date: '2026-07-08', description: 'Internet', value: 129.9, status: 'pendente', kitnet_id: 'k1' },
    ];

    const result = buildStatement({ expenses, monthKey: '2026-07' });

    expect(result.movements).toHaveLength(1);
    expect(result.movements[0].label).toBe('Água');
    expect(result.totalOut).toBe(90);
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0].label).toBe('Internet');
  });

  it('ignora lançamentos pessoais marcados como revisar/ignorar', () => {
    const personal = [
      { id: 'pi1', date: '2026-07-03', type: 'expense', status: 'pago', description: 'Mercado', value: 300 },
      { id: 'pi2', date: '2026-07-04', type: 'card_transaction', status: 'revisar', description: 'Compra cartão', value: 150 },
      { id: 'pi3', date: '2026-07-05', type: 'income', status: 'recebido', description: 'Salário', value: 4000 },
    ];

    const result = buildStatement({ personal, monthKey: '2026-07' });

    expect(result.movements).toHaveLength(2);
    expect(result.totalIn).toBe(4000);
    expect(result.totalOut).toBe(300);
  });

  it('calcula o saldo do mês (entradas - saídas)', () => {
    const payments = [{ id: 'p1', receivable_id: 'r1', payment_date: '2026-07-10', paid_value: 800 }];
    const expenses = [{ id: 'e1', date: '2026-07-05', description: 'Água', value: 90, status: 'pago' }];

    const result = buildStatement({ payments, expenses, receivables, contracts, kitnets, tenants, monthKey: '2026-07' });

    expect(result.balance).toBe(710);
  });

  it('filtra estritamente pelo mês informado', () => {
    const expenses = [{ id: 'e1', date: '2026-06-30', description: 'Fora do mês', value: 50, status: 'pago' }];
    const result = buildStatement({ expenses, monthKey: '2026-07' });
    expect(result.movements).toHaveLength(0);
  });
});
