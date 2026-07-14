import { describe, expect, it } from 'vitest';
import { buildSegmentConsolidation, resolveExpenseSegment } from './segmentConsolidationService.js';

const bySegment = (result, key) => result.segments.find((segment) => segment.key === key);

describe('buildSegmentConsolidation', () => {
  const base = {
    monthKey: '2026-07',
    payments: [
      { receivable_id: 'r-jul', payment_date: '2026-07-10', paid_value: 1200, net_value: 1200, status: 'pago' },
      { receivable_id: 'r-jun', payment_date: '2026-06-10', paid_value: 999, net_value: 999, status: 'pago' }, // fora do mês
    ],
    expenses: [
      { date: '2026-07-05', value: 300, status: 'pago' },
      { date: '2026-07-06', value: 999, status: 'pendente' }, // não pago, não conta
    ],
    projects: [
      { value: 5000, status: 'recebido', expected_payment_date: '2026-07-20' },
      { value: 8000, status: 'entregue', expected_payment_date: '2026-07-21' }, // ainda não recebido
    ],
    expertReports: [
      { fee_value: 2000, status: 'recebido', expected_payment_date: '2026-07-15' },
    ],
    personal: [
      { type: 'income', context: 'trabalho', value: 9000, status: 'recebido', date: '2026-07-31' },
      { type: 'income', context: 'pessoal', value: 500, status: 'recebido', date: '2026-07-02' },
      { type: 'income', context: 'trabalho', value: 9000, status: 'previsto', date: '2026-07-31' }, // previsto não conta
      { type: 'expense', context: 'pessoal', value: 400, status: 'pago', date: '2026-07-03' },
      { type: 'expense', context: 'obra', value: 700, status: 'pago', date: '2026-07-04' }, // vira despesa das kitnets
      // Compras no cartão PESSOAL: custo de kitnet no cartão conta como despesa
      // das kitnets; compra pessoal, como despesa pessoal; 'revisar' fica de fora.
      { type: 'card_transaction', context: 'kitnets', value: 250, status: 'pago', date: '2026-07-08' },
      { type: 'card_transaction', context: 'pessoal', value: 120, status: 'pago', date: '2026-07-09' },
      { type: 'card_transaction', context: 'kitnets', value: 999, status: 'revisar', date: '2026-07-09' },
    ],
  };

  it('separa entradas e saidas por segmento', () => {
    const result = buildSegmentConsolidation(base);

    // kitnets: despesa direta 300 + obra pessoal 700 + cartao kitnet 250 = 1250.
    expect(bySegment(result, 'kitnets')).toMatchObject({ income: 1200, expense: 1250, result: -50 });
    expect(bySegment(result, 'projetos')).toMatchObject({ income: 5000, expense: 0, result: 5000 });
    expect(bySegment(result, 'pericias')).toMatchObject({ income: 2000, expense: 0, result: 2000 });
    expect(bySegment(result, 'trabalho')).toMatchObject({ income: 9000, expense: 0, result: 9000 });
    // pessoal: despesa 400 + cartao pessoal 120 = 520.
    expect(bySegment(result, 'pessoal')).toMatchObject({ income: 500, expense: 520, result: -20 });
  });

  it('consolida o global somando todos os segmentos', () => {
    const { global } = buildSegmentConsolidation(base);

    expect(global.income).toBe(1200 + 5000 + 2000 + 9000 + 500);
    expect(global.expense).toBe(1250 + 520);
    expect(global.result).toBe(global.income - global.expense);
  });

  it('nao conta previsto/pendente nem lancamentos de outro mes', () => {
    const result = buildSegmentConsolidation(base);
    // salario previsto (9000) fora, aluguel de junho fora, projeto 'entregue' fora.
    expect(bySegment(result, 'trabalho').income).toBe(9000);
    expect(bySegment(result, 'projetos').income).toBe(5000);
  });

  it('ignora Payment sem vínculo de aluguel', () => {
    const result = buildSegmentConsolidation({
      monthKey: '2026-07',
      payments: [
        { payment_date: '2026-07-02', paid_value: 2000, net_value: 2000 },
        { receivable_id: 'r1', payment_date: '2026-07-10', paid_value: 1000, net_value: 1000 },
      ],
    });

    expect(bySegment(result, 'kitnets').income).toBe(1000);
  });

  it('usa a data real de recebimento antes de received_at', () => {
    const result = buildSegmentConsolidation({
      monthKey: '2026-06',
      projects: [{
        value: 2000,
        status: 'recebido',
        received_date: '2026-06-26',
        received_at: '2026-07-02',
      }],
    });

    expect(bySegment(result, 'projetos').income).toBe(2000);
  });

  it('coleta os itens que compoem cada segmento para o detalhe', () => {
    const result = buildSegmentConsolidation(base);

    const pericias = bySegment(result, 'pericias');
    expect(pericias.items).toHaveLength(1);
    expect(pericias.items[0]).toMatchObject({ kind: 'entrada', value: 2000, source: 'Perícia' });

    // pessoal: 1 entrada (500) + 2 saidas (400 pessoal + 120 cartao pessoal).
    const pessoal = bySegment(result, 'pessoal');
    expect(pessoal.items).toHaveLength(3);
    expect(pessoal.items.filter((item) => item.kind === 'saida')).toHaveLength(2);

    // kitnets: 1 aluguel + 1 despesa direta + obra pessoal + cartao kitnet.
    expect(bySegment(result, 'kitnets').items).toHaveLength(4);
    // 'revisar' e lancamentos de outro mes nao entram no detalhe.
    expect(bySegment(result, 'trabalho').items).toHaveLength(1);
  });

  it('roteia a despesa direta pelo segmento escolhido (nao mais tudo em kitnets)', () => {
    const result = buildSegmentConsolidation({
      monthKey: '2026-07',
      expenses: [
        { date: '2026-07-05', value: 100, status: 'pago', segment: 'pericias' },
        { date: '2026-07-06', value: 60, status: 'pago', segment: 'pessoal' },
        { date: '2026-07-07', value: 40, status: 'pago' }, // legado sem segmento -> kitnets
      ],
    });

    expect(bySegment(result, 'pericias').expense).toBe(100);
    expect(bySegment(result, 'pessoal').expense).toBe(60);
    expect(bySegment(result, 'kitnets').expense).toBe(40);
  });

  it('compra no cartao pessoal marcada como projeto conta no segmento projetos', () => {
    const result = buildSegmentConsolidation({
      monthKey: '2026-07',
      personal: [
        { type: 'card_transaction', segment: 'projetos', value: 250, status: 'pago', date: '2026-07-08' },
      ],
    });

    expect(bySegment(result, 'projetos').expense).toBe(250);
    expect(bySegment(result, 'pessoal').expense).toBe(0);
  });

  it('o segmento explicito tem prioridade sobre o context legado', () => {
    expect(resolveExpenseSegment({ segment: 'projetos', context: 'kitnets' })).toBe('projetos');
    expect(resolveExpenseSegment({ context: 'obra' })).toBe('kitnets');
    expect(resolveExpenseSegment({ context: 'pessoal' })).toBe('pessoal');
    expect(resolveExpenseSegment({}, 'kitnets')).toBe('kitnets');
    expect(resolveExpenseSegment({})).toBe('pessoal');
  });
});
