import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBankNotification, parseNubankNotification, suggestByRules } from './nubank-parser.ts';

test('extrai compra aprovada do Nubank', () => {
  assert.deepEqual(parseNubankNotification(
    'Compra aprovada',
    'Compra de R$ 32,50 aprovada em IFOOD',
  ), {
    recognized: true,
    relevant: true,
    provider: 'nubank',
    transactionType: 'purchase',
    direction: 'out',
    amount: 32.5,
    merchant: 'IFOOD',
    description: 'Compra em IFOOD',
    parserVersion: 'nubank-v1',
  });
});

test('reconhece Pix recebido do Inter', () => {
  const result = parseBankNotification(
    'br.com.intermedium',
    'Pix recebido',
    'Você recebeu R$ 500,00 via Pix de Carlos Souza',
  );
  assert.equal(result.provider, 'inter');
  assert.equal(result.transactionType, 'pix_received');
  assert.equal(result.amount, 500);
});

test('reconhece texto real de transferencia recebida do Nubank', () => {
  const result = parseBankNotification(
    'com.nu.production',
    'Transferência recebida',
    'Recebemos sua transferência de R$ 0,01.',
  );
  assert.equal(result.provider, 'nubank');
  assert.equal(result.transactionType, 'pix_received');
  assert.equal(result.direction, 'in');
  assert.equal(result.amount, 0.01);
  assert.equal(result.merchant, 'Pix recebido');
  assert.equal(result.description, 'Pix recebido');
});

test('reconhece compra do Itau', () => {
  const result = parseBankNotification(
    'com.itau',
    'Compra aprovada',
    'Compra de R$ 89,90 aprovada em POSTO CENTRAL',
  );
  assert.equal(result.provider, 'itau');
  assert.equal(result.transactionType, 'purchase');
  assert.equal(result.merchant, 'POSTO CENTRAL');
});

test('reconhece Pix enviado da Caixa', () => {
  const result = parseBankNotification(
    'br.com.gabba.Caixa',
    'Pix enviado',
    'Pix enviado para Maria Lima no valor de R$ 120,00',
  );
  assert.equal(result.provider, 'caixa');
  assert.equal(result.transactionType, 'pix_sent');
  assert.equal(result.merchant, 'Maria Lima');
});

test('reconhece compra do Mercado Pago', () => {
  const result = parseBankNotification(
    'com.mercadopago.wallet',
    'Compra aprovada',
    'Compra de R$ 56,20 aprovada em MERCADOLIVRE',
  );
  assert.equal(result.provider, 'mercado_pago');
  assert.equal(result.transactionType, 'purchase');
  assert.equal(result.amount, 56.2);
});

test('pacote desconhecido nao cria movimentacao', () => {
  const result = parseBankNotification('com.exemplo.app', 'Pix recebido', 'Pix recebido de R$ 10,00');
  assert.equal(result.recognized, false);
  assert.equal(result.parserVersion, 'unsupported-package');
});

test('reconhece boleto da Equatorial como conta prevista', () => {
  const result = parseBankNotification(
    'com.nu.production',
    'Novo boleto encontrado',
    'Boleto emitido por EQUATORIAL ENERGIA no valor de R$ 245,67 com vencimento em 20/07/2026',
  );
  assert.equal(result.transactionType, 'boleto_issued');
  assert.equal(result.amount, 245.67);
  assert.equal(result.merchant, 'EQUATORIAL ENERGIA');
  assert.equal(result.dueDate, '2026-07-20');
});

test('nao confunde boleto pago com boleto emitido', () => {
  const result = parseBankNotification(
    'com.itau',
    'Boleto pago',
    'Pagamento de boleto concluído no valor de R$ 245,67',
  );
  assert.equal(result.recognized, false);
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
  assert.equal(result.relevant, false);
  assert.equal(result.amount, undefined);
});

test('ignora oferta bancaria mesmo quando o texto possui valor', () => {
  const result = parseBankNotification(
    'com.itau',
    'Conheca o Consorcio Ganhe Mais',
    'Contrate uma carta de R$ 20.000,00 e concorra a premios.',
  );
  assert.equal(result.recognized, false);
  assert.equal(result.relevant, false);
});

test('preserva lembrete de boleto sem valor para revisao', () => {
  const result = parseBankNotification(
    'br.com.intermedium',
    'Seu boleto vence em breve',
    'Voce tem um boleto emitido por MUTUA que vence em breve.',
  );
  assert.equal(result.recognized, false);
  assert.equal(result.relevant, true);
});

test('regra personalizada tem prioridade sobre regra embutida', () => {
  const result = suggestByRules('Compra em IFOOD', [
    { keyword: 'ifood', category: 'familia', segment: 'kitnets', priority: 0, enabled: true },
  ]);
  assert.deepEqual(result, { category: 'familia', costCenter: 'kitnets', source: 'custom_rule' });
});
