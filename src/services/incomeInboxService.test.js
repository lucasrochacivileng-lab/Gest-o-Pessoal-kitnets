import { describe, it, expect } from 'vitest';
import { buildIncomeInbox } from './incomeInboxService.js';

const baseData = {
  month: '2026-07',
  contracts: [{ id: 'c1', kitnet_id: 'k1', tenant_id: 't1' }],
  kitnets: [{ id: 'k1', name: 'Kitnet 01' }],
  tenants: [{ id: 't1', name: 'Maria' }],
  receivables: [
    // pago (não deve gerar linha previsto)
    { id: 'r1', contract_id: 'c1', kitnet_id: 'k1', tenant_id: 't1', competence: '2026-07', due_date: '2026-07-10', expected_value: 1000, paid_value: 1000, status: 'pago' },
    // pendente (gera previsto pelo saldo)
    { id: 'r2', contract_id: 'c1', kitnet_id: 'k1', tenant_id: 't1', competence: '2026-07', due_date: '2026-07-10', expected_value: 800, paid_value: 0, status: 'pendente' },
  ],
  payments: [
    { id: 'p1', receivable_id: 'r1', kitnet_id: 'k1', tenant_id: 't1', competence: '2026-07', payment_date: '2026-07-05', net_value: 1000 },
  ],
  projects: [
    { id: 'proj1', client: 'ACME', project_type: 'Estrutural', value: 5000, status: 'recebido', received_date: '2026-07-15' },
  ],
  expertReports: [
    { id: 'exp1', client: 'João', process_number: '123', fee_value: 3000, status: 'entregue', expected_payment_date: '2026-07-20' },
  ],
  personal: [
    { id: 'sal1', type: 'income', context: 'trabalho', description: 'Salário', value: 9000, date: '2026-07-01', status: 'recebido' },
    { id: 'ign1', type: 'income', context: 'pessoal', value: 50, date: '2026-07-01', status: 'revisar' },
  ],
};

describe('buildIncomeInbox', () => {
  it('junta aluguel recebido/previsto, perícia, projeto e salário do mês', () => {
    const { rows } = buildIncomeInbox(baseData);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));

    expect(byId['payment-p1']).toMatchObject({ tipo: 'aluguel', status: 'recebido', value: 1000, label: 'Aluguel — Kitnet 01' });
    expect(byId['receivable-r2']).toMatchObject({ tipo: 'aluguel', status: 'previsto', value: 800 });
    expect(byId['extra-project-proj1']).toMatchObject({ tipo: 'projeto', status: 'recebido', value: 5000 });
    expect(byId['extra-expert-exp1']).toMatchObject({ tipo: 'pericia', status: 'previsto', value: 3000 });
    expect(byId['personal-sal1']).toMatchObject({ tipo: 'salario', status: 'recebido', value: 9000 });
  });

  it('não gera linha previsto para recebível já pago', () => {
    const { rows } = buildIncomeInbox(baseData);
    expect(rows.find((r) => r.id === 'receivable-r1')).toBeUndefined();
  });

  it('ignora lançamento pessoal em revisar/ignorar', () => {
    const { rows } = buildIncomeInbox(baseData);
    expect(rows.find((r) => r.sourceId === 'ign1')).toBeUndefined();
  });

  it('soma recebido e previsto corretamente', () => {
    const { summary } = buildIncomeInbox(baseData);
    // recebido: 1000 (aluguel) + 5000 (projeto) + 9000 (salário) = 15000
    // previsto: 800 (aluguel r2) + 3000 (perícia) = 3800
    expect(summary.received).toBe(15000);
    expect(summary.previsto).toBe(3800);
    expect(summary.total).toBe(18800);
  });

  it('mostra o saldo em aberto de um recebível parcial como previsto', () => {
    const data = {
      ...baseData,
      payments: [],
      projects: [],
      expertReports: [],
      personal: [],
      receivables: [
        { id: 'rp', contract_id: 'c1', kitnet_id: 'k1', tenant_id: 't1', competence: '2026-07', due_date: '2026-07-10', expected_value: 1000, paid_value: 400, status: 'parcial' },
      ],
    };
    const { rows, summary } = buildIncomeInbox(data);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'previsto', value: 600 });
    expect(summary.previsto).toBe(600);
  });

  it('só considera o mês selecionado', () => {
    const { rows } = buildIncomeInbox({ ...baseData, month: '2026-08' });
    expect(rows).toHaveLength(0);
  });
});
