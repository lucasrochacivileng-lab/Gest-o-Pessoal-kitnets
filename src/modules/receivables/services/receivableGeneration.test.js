import { describe, expect, it } from 'vitest';
import { buildReceivablesForCompetence } from './receivableService.js';

const contract = (overrides = {}) => ({
  id: 'c1',
  kitnet_id: 'k1',
  tenant_id: 't1',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  rent_value: 800,
  due_day: 10,
  status: 'ativo',
  ...overrides,
});

describe('buildReceivablesForCompetence', () => {
  it('gera recebível para contrato ativo dentro da vigência', () => {
    const result = buildReceivablesForCompetence([contract({ bank_account_id: 'conta-inter' })], [], '2026-07');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      contract_id: 'c1',
      competence: '2026-07',
      expected_value: 800,
      due_date: '2026-07-10',
      status: 'pendente',
      bank_account_id: 'conta-inter',
    });
  });

  it('não duplica recebível já lançado para a mesma competência', () => {
    const existing = [{ contract_id: 'c1', competence: '2026-07' }];
    const result = buildReceivablesForCompetence([contract()], existing, '2026-07');

    expect(result).toHaveLength(0);
  });

  it('ignora contratos fora da vigência', () => {
    const result = buildReceivablesForCompetence([contract()], [], '2027-01');

    expect(result).toHaveLength(0);
  });

  it('ignora contratos não ativos', () => {
    const result = buildReceivablesForCompetence([contract({ status: 'encerrado' })], [], '2026-07');

    expect(result).toHaveLength(0);
  });

  it('ajusta o vencimento para o último dia do mês quando o dia não existe', () => {
    const result = buildReceivablesForCompetence([contract({ due_day: 31 })], [], '2026-02');

    expect(result[0].due_date).toBe('2026-02-28');
  });

  it('usa dia 10 como padrão quando o contrato não tem dia de vencimento', () => {
    const result = buildReceivablesForCompetence([contract({ due_day: undefined })], [], '2026-07');

    expect(result[0].due_date).toBe('2026-07-10');
  });
});
