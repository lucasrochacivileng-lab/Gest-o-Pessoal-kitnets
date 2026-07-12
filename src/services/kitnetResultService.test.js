import { describe, expect, it } from 'vitest';
import { buildKitnetResults } from './kitnetResultService.js';

const byName = (result, name) => result.kitnets.find((kitnet) => kitnet.name === name);

describe('buildKitnetResults', () => {
  const base = {
    monthKey: '2026-07',
    kitnets: [
      { id: 'k1', name: 'Kitnet 01' },
      { id: 'k2', name: 'Kitnet 02' },
    ],
    payments: [
      { payment_date: '2026-07-10', kitnet_id: 'k1', paid_value: 1000, net_value: 1000 },
      { payment_date: '2026-07-10', kitnet_id: 'k2', paid_value: 900, net_value: 900 },
      { payment_date: '2026-06-10', kitnet_id: 'k1', paid_value: 999, net_value: 999 }, // fora do mês
    ],
    expenses: [
      { date: '2026-07-05', value: 120, status: 'pago', segment: 'kitnets', kitnet_id: 'k1' },
      { date: '2026-07-06', value: 200, status: 'pago', segment: 'kitnets', kitnet_id: 'geral' }, // Geral
      { date: '2026-07-07', value: 80, status: 'pago', kitnet_id: 'k2' }, // legado sem segmento -> kitnets
      { date: '2026-07-08', value: 50, status: 'pago', segment: 'pessoal', kitnet_id: 'k1' }, // pessoal, ignora
      { date: '2026-07-09', value: 70, status: 'pendente', segment: 'kitnets', kitnet_id: 'k1' }, // não pago
    ],
    personal: [
      { type: 'card_transaction', segment: 'kitnets', kitnet_id: 'k2', value: 150, status: 'pago', date: '2026-07-08' },
      { type: 'card_transaction', segment: 'kitnets', kitnet_id: '', value: 60, status: 'pago', date: '2026-07-08' }, // sem unidade -> Geral
      { type: 'card_transaction', segment: 'pericias', kitnet_id: 'k1', value: 999, status: 'pago', date: '2026-07-08' }, // pericia, ignora
    ],
  };

  it('calcula renda e despesa vinculada por unidade', () => {
    const result = buildKitnetResults(base);

    // k1: aluguel 1000 - despesa direta 120 = 880 (o pessoal e o pendente nao contam).
    expect(byName(result, 'Kitnet 01')).toMatchObject({ income: 1000, expense: 120, result: 880 });
    // k2: aluguel 900 - (despesa legado 80 + cartao kitnet 150) = 670.
    expect(byName(result, 'Kitnet 02')).toMatchObject({ income: 900, expense: 230, result: 670 });
  });

  it('separa as despesas Geral (nao rateadas) num balde a parte', () => {
    const result = buildKitnetResults(base);
    // Geral: 200 (kitnet_id 'geral') + 60 (cartao sem unidade) = 260.
    expect(result.geral.expense).toBe(260);
  });

  it('consolida os totais somando unidades + Geral', () => {
    const { totals } = buildKitnetResults(base);
    expect(totals.income).toBe(1900);
    expect(totals.expense).toBe(120 + 230 + 260);
    expect(totals.result).toBe(totals.income - totals.expense);
  });

  it('ignora pericias/projetos e lancamentos pessoais no P&L da kitnet', () => {
    const result = buildKitnetResults(base);
    // A compra de pericia vinculada a k1 (999) nao pode inflar a despesa da k1.
    expect(byName(result, 'Kitnet 01').expense).toBe(120);
  });
});
