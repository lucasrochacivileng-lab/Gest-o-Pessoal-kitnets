import { describe, expect, it } from 'vitest';
import {
  calculateOutstandingValue,
  calculatePaymentNetValue,
  getReceivableStatus,
  receivableService,
} from './receivableService.js';
import { RECEIVABLE_FILTERS, RECEIVABLE_STATUS } from '../types/receivable.types.js';
import { repository } from '../../../repository/index.js';

describe('receivableService', () => {
  it('marks pending receivables as overdue when due date has passed', () => {
    const status = getReceivableStatus(
      { status: RECEIVABLE_STATUS.PENDING, due_date: '2026-07-01' },
      '2026-07-07',
    );

    expect(status).toBe(RECEIVABLE_STATUS.OVERDUE);
  });

  it('calculates net payment with discounts, fines and interest', () => {
    expect(calculatePaymentNetValue({ paid_value: 800, discount: 50, fine: 20, interest: 10 })).toBe(780);
  });

  it('calculates outstanding value using the amount already paid', () => {
    expect(calculateOutstandingValue({ expected_value: 800, paid_value: 300 })).toBe(500);
    expect(calculateOutstandingValue({ expected_value: 800, paid_value: 900 })).toBe(0);
  });

  it('filters receivables by contextual search text', () => {
    const receivables = [
      {
        id: 'r1',
        status: RECEIVABLE_STATUS.PENDING,
        due_date: '2026-07-10',
        competence: '2026-07',
        kitnet: { id: 'k1', name: 'Kitnet 01' },
        tenant: { id: 't1', name: 'Maria Souza' },
      },
    ];

    const result = receivableService.filterReceivables(receivables, {
      statusFilter: RECEIVABLE_FILTERS.ALL,
      search: 'maria',
    });

    expect(result).toHaveLength(1);
  });

  it('filtro "Este mes" usa o mes selecionado nos chips, nao sempre o mes-calendario real', () => {
    // Regressao: a tela sempre manda competenceFilter junto (preso ao mes dos
    // chips). Ver maio e clicar "Este mes" nao pode comparar contra o mes
    // real do sistema e sempre voltar vazio.
    const receivables = [
      { id: 'r-mai', status: RECEIVABLE_STATUS.PENDING, due_date: '2026-05-10', competence: '2026-05' },
    ];

    const result = receivableService.filterReceivables(receivables, {
      statusFilter: RECEIVABLE_FILTERS.THIS_MONTH,
      competenceFilter: '2026-05',
    });

    expect(result).toHaveLength(1);
  });

  it('keeps payment history attached to each receivable when filtering', () => {
    const receivables = [
      {
        id: 'r1',
        status: RECEIVABLE_STATUS.PARTIAL,
        due_date: '2026-07-20',
        competence: '2026-07',
        payments: [
          { id: 'p1', receivable_id: 'r1', paid_value: 300, payment_date: '2026-07-07' },
        ],
      },
    ];

    const result = receivableService.filterReceivables(receivables, {
      statusFilter: RECEIVABLE_FILTERS.PARTIAL,
    });

    expect(result[0].payments).toHaveLength(1);
  });

  it('marks partial receivables as overdue after due date', () => {
    const status = getReceivableStatus(
      { status: RECEIVABLE_STATUS.PARTIAL, due_date: '2026-07-01' },
      '2026-07-07',
    );

    expect(status).toBe(RECEIVABLE_STATUS.OVERDUE);
  });

  it('getSummary usa net_value no recebido do mes e nao infla um R$ 0,00 perdoado', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const summary = receivableService.getSummary([
      // Pago líquido de R$ 780 (com desconto): deve contar 780, não o esperado.
      { status: RECEIVABLE_STATUS.PAID, competence: currentMonth, expected_value: 800, paid_value: 800, net_value: 780 },
      // Mês perdoado (R$ 0,00 de propósito, status pago): não pode virar 800.
      { status: RECEIVABLE_STATUS.PAID, competence: currentMonth, expected_value: 800, paid_value: 0 },
    ]);

    expect(summary.receivedThisMonthValue).toBe(780);
  });

  it('getSummary com options.month nao pode esconder atrasados de outras competencias', () => {
    // Regressao: a tela de Recebimentos sempre passa um competenceFilter (o mes
    // selecionado nos chips). Um aluguel de maio ainda em atraso em julho tem
    // competence '2026-05', diferente do mes selecionado '2026-07' — o card
    // "Em atraso" deve continuar somando esse valor, nao zera-lo so porque o
    // usuario esta olhando o mes corrente.
    const summary = receivableService.getSummary([
      { status: RECEIVABLE_STATUS.OVERDUE, competence: '2026-05', expected_value: 800, paid_value: 0 },
      { status: RECEIVABLE_STATUS.PENDING, competence: '2026-07', due_date: '2026-07-10', expected_value: 800, paid_value: 0 },
    ], { month: '2026-07' });

    expect(summary.overdueValue).toBe(800);
  });

  it('copia kitnet_id/tenant_id/competence do recebivel para o Pagamento', async () => {
    // Regressao: a tela de Pagamentos le kitnet_id/tenant_id/competence
    // direto da linha do Payment (nao percorre receivable_id -> Receivable).
    // Sem essa copia, todo aluguel confirmado por "Receber" aparecia com
    // "—" em Kitnet/Locatario/Competencia mesmo tendo um recebivel vinculado.
    const receivable = await repository.create('Receivable', {
      competence: '2026-08',
      contract_id: 'c-teste',
      kitnet_id: 'k-teste',
      tenant_id: 't-teste',
      expected_value: 800,
      due_date: '2026-08-10',
      status: 'pendente',
      paid_value: 0,
      active: true,
    });

    const result = await receivableService.registerPayment(receivable, {
      paid_value: 800,
      contract_id: 'c-forjado',
      kitnet_id: 'k-forjada',
      tenant_id: 't-forjado',
      competence: '1900-01',
    });

    expect(result.payment.contract_id).toBe('c-teste');
    expect(result.payment.kitnet_id).toBe('k-teste');
    expect(result.payment.tenant_id).toBe('t-teste');
    expect(result.payment.competence).toBe('2026-08');
  });

  it('registra um pagamento de R$ 0,00 intencional em vez de lançar o valor cheio', async () => {
    const receivable = await repository.create('Receivable', {
      competence: '2026-07',
      expected_value: 800,
      due_date: '2026-07-10',
      status: 'pendente',
      paid_value: 0,
      active: true,
    });

    const result = await receivableService.registerPayment(receivable, { paid_value: 0 });

    expect(result.receivable.paid_value).toBe(0);
    expect(result.status).toBe(RECEIVABLE_STATUS.PARTIAL);
  });

  it('usa o valor esperado quando paid_value realmente não foi informado', async () => {
    const receivable = await repository.create('Receivable', {
      competence: '2026-07',
      expected_value: 800,
      due_date: '2026-07-10',
      status: 'pendente',
      paid_value: 0,
      active: true,
    });

    const result = await receivableService.registerPayment(receivable, {});

    expect(result.receivable.paid_value).toBe(800);
    expect(result.status).toBe(RECEIVABLE_STATUS.PAID);
  });
  it('bloqueia pagamento acima do saldo restante antes de persistir', async () => {
    const receivable = {
      id: 'recebivel-excedente',
      expected_value: 800,
      paid_value: 300,
      status: RECEIVABLE_STATUS.PARTIAL,
    };

    await expect(receivableService.registerPayment(receivable, { paid_value: 501 }))
      .rejects.toThrow('O valor pago nao pode ser maior que o saldo restante.');
  });

  it('rejeita valores negativos em vez de transforma-los silenciosamente em zero', async () => {
    const receivable = {
      id: 'recebivel-negativo',
      expected_value: 800,
      paid_value: 0,
      status: RECEIVABLE_STATUS.PENDING,
    };

    await expect(receivableService.registerPayment(receivable, { paid_value: -1 }))
      .rejects.toThrow(/nao podem ser negativos/i);
  });

  it('rejeita desconto que tornaria o valor liquido negativo', async () => {
    const receivable = {
      id: 'recebivel-liquido-negativo',
      expected_value: 800,
      paid_value: 0,
      status: RECEIVABLE_STATUS.PENDING,
    };

    await expect(receivableService.registerPayment(receivable, { paid_value: 10, discount: 11 }))
      .rejects.toThrow(/valor liquido.*negativo/i);
  });
});
