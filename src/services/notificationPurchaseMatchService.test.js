import { describe, expect, it } from 'vitest';
import {
  descriptionSimilarity,
  isNotificationPurchase,
  matchStatementAgainstNotifications,
  statementTotalValue,
} from './notificationPurchaseMatchService.js';

// Compra capturada pela notificação do banco: valor CHEIO, data da compra,
// sem parcelamento. `source_notification_id` é o que marca essa origem.
const notificacao = (over = {}) => ({
  id: 'n1',
  type: 'card_transaction',
  source_notification_id: 'notif-1',
  card_name: 'Nubank',
  description: 'Compra aprovada: PIZZARIA BELLA',
  value: 600,
  date: '2026-07-10',
  status: 'revisado',
  ...over,
});

// Linha crua da fatura (parseStatementRows): traz a PARCELA e o total.
const linhaFatura = (over = {}) => ({
  source_index: 1,
  card_name: 'Nubank',
  description: 'PIZZARIA BELLA LTDA',
  value: 100,
  installment_current: 1,
  installment_total: 6,
  purchase_date: '2026-07-10',
  ...over,
});

describe('isNotificationPurchase', () => {
  it('só reconhece compra de cartão vinda de notificação e não ignorada', () => {
    expect(isNotificationPurchase(notificacao())).toBe(true);
    // Veio de importação de fatura, não de notificação.
    expect(isNotificationPurchase({ type: 'card_transaction', origin_hash: 'x' })).toBe(false);
    expect(isNotificationPurchase(notificacao({ status: 'ignorar' }))).toBe(false);
    expect(isNotificationPurchase({ type: 'expense', source_notification_id: 'n' })).toBe(false);
  });
});

describe('statementTotalValue', () => {
  it('reconstrói o valor cheio a partir da parcela', () => {
    expect(statementTotalValue({ value: 100, installment_total: 6 })).toBe(600);
    expect(statementTotalValue({ value: 120, installment_total: 1 })).toBe(120);
    expect(statementTotalValue({ value: 120 })).toBe(120);
  });
});

describe('matchStatementAgainstNotifications', () => {
  it('casa a notificação de R$ 600 com a fatura que traz 6x de R$ 100', () => {
    const matches = matchStatementAgainstNotifications({
      transactions: [linhaFatura()],
      existing: [notificacao()],
    });

    expect(matches.get(1)?.id).toBe('n1');
  });

  it('casa compra à vista (notificação e fatura com o mesmo valor)', () => {
    const matches = matchStatementAgainstNotifications({
      transactions: [linhaFatura({ value: 120, installment_total: 1, description: 'IFOOD' })],
      existing: [notificacao({ value: 120, description: 'Compra aprovada: IFOOD*RESTAURANTE' })],
    });

    expect(matches.get(1)?.id).toBe('n1');
  });

  it('aceita o arredondamento da parcela (R$ 600 em 7x = 85,71)', () => {
    const matches = matchStatementAgainstNotifications({
      transactions: [linhaFatura({ value: 85.71, installment_total: 7 })],
      existing: [notificacao({ value: 600 })],
    });

    expect(matches.get(1)?.id).toBe('n1');
  });

  it('não casa cartões diferentes', () => {
    const matches = matchStatementAgainstNotifications({
      transactions: [linhaFatura()],
      existing: [notificacao({ card_name: 'Santander' })],
    });

    expect(matches.size).toBe(0);
  });

  it('não casa valores diferentes', () => {
    const matches = matchStatementAgainstNotifications({
      transactions: [linhaFatura({ value: 100, installment_total: 6 })],
      existing: [notificacao({ value: 900 })],
    });

    expect(matches.size).toBe(0);
  });

  it('não casa compra muito distante na data', () => {
    const matches = matchStatementAgainstNotifications({
      transactions: [linhaFatura({ purchase_date: '2026-07-25' })],
      existing: [notificacao({ date: '2026-07-10' })],
    });

    expect(matches.size).toBe(0);
  });

  it('tolera 1 dia de diferença (compra tarde da noite cai no dia seguinte)', () => {
    const matches = matchStatementAgainstNotifications({
      transactions: [linhaFatura({ purchase_date: '2026-07-11' })],
      existing: [notificacao({ date: '2026-07-10' })],
    });

    expect(matches.get(1)?.id).toBe('n1');
  });

  it('ignora notificação já aposentada por uma importação anterior', () => {
    const matches = matchStatementAgainstNotifications({
      transactions: [linhaFatura()],
      existing: [notificacao({ status: 'ignorar' })],
    });

    expect(matches.size).toBe(0);
  });

  it('casa um para um: dois cafés iguais no mesmo dia são dois gastos reais', () => {
    const matches = matchStatementAgainstNotifications({
      transactions: [
        linhaFatura({ source_index: 1, description: 'CAFETERIA', value: 10, installment_total: 1 }),
        linhaFatura({ source_index: 2, description: 'CAFETERIA', value: 10, installment_total: 1 }),
      ],
      existing: [
        notificacao({ id: 'n1', description: 'Compra aprovada: CAFETERIA', value: 10 }),
        notificacao({ id: 'n2', description: 'Compra aprovada: CAFETERIA', value: 10 }),
      ],
    });

    // Cada linha casa com uma notificação distinta — nenhuma sobra e nenhuma
    // é usada duas vezes (o que apagaria um café de verdade).
    expect([matches.get(1).id, matches.get(2).id].sort()).toEqual(['n1', 'n2']);
  });

  it('sobrando uma notificação a mais, casa só o que existe na fatura', () => {
    const matches = matchStatementAgainstNotifications({
      transactions: [linhaFatura({ value: 10, installment_total: 1, description: 'CAFETERIA' })],
      existing: [
        notificacao({ id: 'n1', description: 'Compra aprovada: CAFETERIA', value: 10 }),
        notificacao({ id: 'n2', description: 'Compra aprovada: CAFETERIA', value: 10 }),
      ],
    });

    expect(matches.size).toBe(1);
  });

  it('entre candidatos iguais em valor e data, escolhe o mais parecido no texto', () => {
    const matches = matchStatementAgainstNotifications({
      transactions: [linhaFatura({ description: 'POSTO IPIRANGA', value: 200, installment_total: 1 })],
      existing: [
        notificacao({ id: 'n-farmacia', description: 'Compra aprovada: DROGARIA PACHECO', value: 200 }),
        notificacao({ id: 'n-posto', description: 'Compra aprovada: POSTO IPIRANGA', value: 200 }),
      ],
    });

    expect(matches.get(1)?.id).toBe('n-posto');
  });
});

describe('descriptionSimilarity', () => {
  it('ignora o ruído do banco e enxerga o estabelecimento em comum', () => {
    expect(descriptionSimilarity('Compra aprovada no cartao: PIZZARIA BELLA', 'PIZZARIA BELLA LTDA')).toBe(1);
  });

  it('dá zero para estabelecimentos sem nada em comum', () => {
    expect(descriptionSimilarity('Compra aprovada: DROGARIA', 'POSTO IPIRANGA')).toBe(0);
  });
});
