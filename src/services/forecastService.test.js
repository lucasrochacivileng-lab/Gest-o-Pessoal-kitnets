import { describe, expect, it } from 'vitest';
import { buildForecast } from './forecastService.js';

const base = { month: '2027-07', currentMonth: '2026-07' };

describe('buildForecast', () => {
  it('projeta aluguel de contrato vigente mesmo sem recebível lançado', () => {
    const result = buildForecast({
      ...base,
      contracts: [{ id: 'c1', kitnet_id: 'k1', rent_value: 950, status: 'ativo', start_date: '2026-07-01', end_date: '2027-07-31' }],
      kitnets: [{ id: 'k1', name: 'Kit 01' }],
    });

    expect(result.incomes).toHaveLength(1);
    expect(result.incomes[0]).toMatchObject({ label: 'Aluguel Kit 01', value: 950 });
    expect(result.totalIn).toBe(950);
  });

  it('não projeta aluguel fora da vigência do contrato', () => {
    const result = buildForecast({
      ...base,
      month: '2027-09',
      contracts: [{ id: 'c1', kitnet_id: 'k1', rent_value: 950, status: 'ativo', start_date: '2026-07-01', end_date: '2027-07-31' }],
    });

    expect(result.incomes).toHaveLength(0);
  });

  it('usa o valor restante quando o recebível do mês já existe', () => {
    const result = buildForecast({
      ...base,
      month: '2026-07',
      contracts: [{ id: 'c1', kitnet_id: 'k1', rent_value: 950, status: 'ativo', start_date: '2026-07-01', end_date: '2027-07-31' }],
      receivables: [{ contract_id: 'c1', competence: '2026-07', expected_value: 950, paid_value: 400, status: 'parcial' }],
    });

    expect(result.incomes[0].value).toBe(550);
  });

  it('inclui projeto no mês previsto e rola atrasados para o mês atual', () => {
    const projects = [
      { id: 'p1', client: 'Amigo', value: 100000, status: 'entregue', expected_payment_date: '2026-07-10' },
      { id: 'p2', client: 'Atrasado', value: 5000, status: 'entregue', expected_payment_date: '2026-05-10' },
      { id: 'p3', client: 'Recebido', value: 3000, status: 'recebido', expected_payment_date: '2026-07-15' },
    ];

    const result = buildForecast({ month: '2026-07', currentMonth: '2026-07', projects });

    expect(result.incomes).toHaveLength(2);
    expect(result.incomes.find((row) => row.label.includes('Amigo')).value).toBe(100000);
    expect(result.incomes.find((row) => row.label.includes('Atrasado')).source).toContain('rolado');
    expect(result.totalIn).toBe(105000);
  });

  it('projeta recorrentes pessoais (orçamento, salário, parcelas) em meses futuros', () => {
    const personal = [
      { type: 'income', description: 'Salário CemInfra', value: 8000, date: '2026-07-05', recurring: true, status: 'previsto' },
      { type: 'expense', description: 'Alimentação (média)', value: 1000, date: '2026-07-01', recurring: true, status: 'previsto' },
      { type: 'expense', description: 'Combustível', value: 800, date: '2026-07-01', recurring: true, status: 'previsto' },
      { type: 'expense', description: 'Pizza avulsa', value: 80, date: '2026-07-02', recurring: false, status: 'pago' },
    ];

    const result = buildForecast({ ...base, personal });

    expect(result.totalIn).toBe(8000);
    expect(result.totalOut).toBe(1800);
    expect(result.balance).toBe(6200);
    expect(result.outgoings.find((row) => row.label.includes('Pizza'))).toBeUndefined();
  });

  it('inclui despesas recorrentes das kitnets e parcelas de cartão importadas na previsão', () => {
    const result = buildForecast({
      ...base,
      expenses: [{ description: 'Água das kitnets', value: 110, date: '2026-07-05', recurring: true, status: 'pago' }],
      personal: [{ type: 'card_transaction', card_name: 'Nubank', description: 'EC LOJA', installment: '2/3', value: 999, date: '2027-07-01', status: 'revisar' }],
    });

    expect(result.outgoings).toHaveLength(2);
    expect(result.outgoings.find((row) => row.label.includes('Água'))).toBeTruthy();
    expect(result.outgoings.find((row) => row.label.includes('EC LOJA'))).toMatchObject({
      label: 'Nubank - EC LOJA (2/3)',
      value: 999,
      source: 'cartão importado - revisar',
    });
  });

  it('projeta transação de cartão recorrente em meses futuros', () => {
    const result = buildForecast({
      ...base,
      month: '2026-09',
      personal: [{
        type: 'card_transaction',
        card_name: 'Santander 7535',
        description: 'CLARO FLEX',
        value: 39.99,
        date: '2026-07-10',
        status: 'revisar',
        recurring: true,
      }],
    });

    expect(result.outgoings).toHaveLength(1);
    expect(result.outgoings[0]).toMatchObject({
      label: 'Santander 7535 - CLARO FLEX (recorrente)',
      value: 39.99,
      source: 'cartão importado - revisar',
    });
  });
});
