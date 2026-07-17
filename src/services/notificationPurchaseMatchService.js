// Casa a compra capturada pela NOTIFICAÇÃO com a linha da FATURA importada
// depois. As duas são a MESMA compra vista em dois momentos:
//
//   notificação -> chega na hora da compra, com o valor CHEIO (R$ 600) e a
//                  data da compra. Não sabe do parcelamento.
//   fatura      -> chega no mês seguinte, já com a PARCELA (R$ 100), a data de
//                  vencimento e o "1/6".
//
// Sem casar as duas, a mesma pizza entra como R$ 600 (notificação) + 6x R$ 100
// (fatura) = R$ 1.200. A fatura é a fonte mais completa (sabe o parcelamento),
// então ela manda: ao importar, a notificação correspondente é aposentada.

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .trim()
  .toLowerCase();

const normalizeCard = (value) => normalize(value);

// Dias de folga entre a data da notificação e a data da compra na fatura.
// A notificação chega na hora; a fatura às vezes registra a compra no dia
// seguinte (compra tarde da noite, fuso, captura do lojista).
const DATE_TOLERANCE_DAYS = 3;

const daysBetween = (a, b) => {
  const first = Date.parse(`${a}T00:00:00Z`);
  const second = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return Infinity;
  return Math.abs(first - second) / 86400000;
};

/**
 * Veio da Caixa de Entrada (notificação do banco), não de importação de fatura.
 * A RPC confirm_financial_inbox_transaction grava `source_notification_id`; a
 * importação de fatura grava `origin_hash`. É isso que separa as duas origens.
 */
export const isNotificationPurchase = (row = {}) => (
  row.type === 'card_transaction'
  && Boolean(row.source_notification_id)
  && row.status !== 'ignorar'
);

/**
 * Valor cheio da compra na fatura: a linha traz a PARCELA, então o total é
 * parcela x número de parcelas. À vista (total 1) o total é a própria parcela.
 */
export const statementTotalValue = (transaction = {}) => {
  const installments = Math.max(Number(transaction.installment_total) || 1, 1);
  return Number(transaction.value || 0) * installments;
};

// Parcela sempre arredonda (R$ 600 em 7x = 85,71 x 7 = 599,97). A folga cresce
// com o número de parcelas porque o erro de arredondamento se acumula.
const valuesMatch = (notificationValue, transaction) => {
  const total = statementTotalValue(transaction);
  const installments = Math.max(Number(transaction.installment_total) || 1, 1);
  const tolerance = 0.01 * installments + 0.01;
  return Math.abs(Number(notificationValue || 0) - total) <= tolerance;
};

// Ruído que os bancos põem na notificação e que não existe na fatura.
const NOISE_TOKENS = new Set([
  'compra', 'aprovada', 'no', 'na', 'em', 'de', 'do', 'da', 'com', 'cartao',
  'credito', 'debito', 'final', 'valor', 'voce', 'fez', 'uma', 'pagamento',
  'transacao', 'estabelecimento', 'parcela', 'parcelas', 'vezes',
]);

const significantTokens = (text) => new Set(
  normalize(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !NOISE_TOKENS.has(token) && !/^\d+$/.test(token)),
);

/**
 * Quanto os textos se parecem (0 a 1). Só desempata: cartão + data + valor já
 * é uma identificação forte, e a descrição da notificação raramente é igual à
 * da fatura ("Compra aprovada: PIZZARIA BELLA" vs "PIZZARIA BELLA LTDA").
 */
export const descriptionSimilarity = (a, b) => {
  const first = significantTokens(a);
  const second = significantTokens(b);
  if (!first.size || !second.size) return 0;
  const shared = [...first].filter((token) => second.has(token)).length;
  return shared / Math.min(first.size, second.size);
};

/**
 * Casa as linhas da fatura com as compras já capturadas por notificação.
 *
 * Cada notificação casa com NO MÁXIMO uma linha da fatura (e vice-versa): duas
 * compras iguais no mesmo dia (dois cafés de R$ 10) são duas notificações e
 * duas linhas — casar uma com as duas apagaria um gasto real.
 *
 * @param transactions linhas cruas da fatura (parseStatementRows), antes de
 *        virarem parcelas
 * @param existing lançamentos PersonalIncome já gravados
 * @returns Map<source_index, lançamento de notificação correspondente>
 */
export const matchStatementAgainstNotifications = ({ transactions = [], existing = [] } = {}) => {
  const candidates = existing.filter(isNotificationPurchase);
  const used = new Set();
  const matches = new Map();

  transactions.forEach((transaction) => {
    const pool = candidates.filter((row) => {
      if (used.has(row.id)) return false;
      if (normalizeCard(row.card_name) !== normalizeCard(transaction.card_name)) return false;
      if (!valuesMatch(row.value, transaction)) return false;
      return daysBetween(row.date, transaction.purchase_date) <= DATE_TOLERANCE_DAYS;
    });

    if (!pool.length) return;

    // Entre os candidatos, o mais parecido no texto e, empatando, o mais
    // próximo na data.
    const best = pool
      .map((row) => ({
        row,
        similarity: descriptionSimilarity(row.description, transaction.description),
        distance: daysBetween(row.date, transaction.purchase_date),
      }))
      .sort((a, b) => (b.similarity - a.similarity) || (a.distance - b.distance))[0];

    used.add(best.row.id);
    matches.set(transaction.source_index, {
      ...best.row,
      match_similarity: best.similarity,
      match_distance_days: best.distance,
    });
  });

  return matches;
};

export default matchStatementAgainstNotifications;
