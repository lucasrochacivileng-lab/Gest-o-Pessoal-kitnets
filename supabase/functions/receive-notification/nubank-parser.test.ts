import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNubankNotification, suggestByRules } from './nubank-parser.ts';

test('extrai compra aprovada do Nubank', () => {
  assert.deepEqual(parseNubankNotification(
    'Compra aprovada',
    'Compra de R$ 32,50 aprovada em IFOOD',
  ), {
    recognized: true,
    transactionType: 'purchase',
    direction: 'out',
    amount: 32.5,
    merchant: 'IFOOD',
    description: 'Compra em IFOOD',
    parserVersion: 'nubank-v1',
  });
});

test('extrai Pix enviado', () => {
  const result = parseNubankNotification('Pix realizado', 'Você fez um Pix de R$ 150,00 para Maria Silva.');
  assert.equal(result.transactionType, 'pix_sent');
  assert.equal(result.amount, 150);
  assert.equal(result.merchant, 'Maria Silva');
});

test('extrai Pix recebido', () => {
  const result = parseNubankNotification('Pix recebido', 'Você recebeu um Pix de João Souza no valor de R$ 950,00.');
  assert.equal(result.transactionType, 'pix_received');
  assert.equal(result.amount, 950);
  assert.equal(result.merchant, 'João Souza');
});

test('nao inventa valor quando a notificacao nao e reconhecida', () => {
  const result = parseNubankNotification('Novidade no app', 'Confira as novidades do Nubank.');
  assert.equal(result.recognized, false);
  assert.equal(result.amount, undefined);
});

test('regra personalizada tem prioridade sobre regra embutida', () => {
  const result = suggestByRules('Compra em IFOOD', [
    { keyword: 'ifood', category: 'familia', segment: 'kitnets', priority: 0, enabled: true },
  ]);
  assert.deepEqual(result, { category: 'familia', costCenter: 'kitnets', source: 'custom_rule' });
});

