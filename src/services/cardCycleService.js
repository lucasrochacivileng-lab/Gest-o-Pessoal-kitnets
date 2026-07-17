// Ciclo da fatura: descobre em QUAL fatura uma compra cai e QUE PERÍODO uma
// fatura cobre, a partir do fechamento e do vencimento do cartão.
//
// Exemplo do Nubank (fecha dia 3, vence dia 10): a fatura que vence em 10/07
// cobre as compras de 04/06 a 03/07. Por isso uma compra de 15/06 aparece como
// despesa de JULHO — não é erro, é quando o dinheiro sai.
//
// Cada cartão tem seu ciclo: o Amazon fecha dia 24 e vence dia 10, então ele
// fecha num mês e vence no seguinte.

const pad = (value) => String(value).padStart(2, '0');
const isoDate = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

// Dia que existe no mês: fechamento dia 31 em fevereiro vira o dia 28/29.
const clampDay = (year, month, day) => Math.min(Math.max(Number(day) || 1, 1), daysInMonth(year, month));

const addMonths = ({ year, month }, offset) => {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
};

const parseIso = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

const parseMonth = (value) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
};

const dayOf = (card, field) => {
  const value = Number(card?.[field]);
  return Number.isFinite(value) && value >= 1 && value <= 31 ? value : 0;
};

/**
 * O cartão sabe o próprio ciclo? Sem fechamento E vencimento não dá para dizer
 * em que fatura a compra cai — quem chama cai no comportamento antigo.
 */
export const hasCycle = (card) => Boolean(dayOf(card, 'closing_day') && dayOf(card, 'due_day'));

// A fatura fecha e vence no MESMO mês quando o vencimento vem depois do
// fechamento (Nubank: fecha 3, vence 10). Quando o vencimento é antes ou no
// mesmo dia (Amazon: fecha 24, vence 10), ela vence no mês seguinte.
const dueComesNextMonth = (card) => dayOf(card, 'due_day') <= dayOf(card, 'closing_day');

const dueDateFromClosing = (card, closing) => {
  const target = dueComesNextMonth(card) ? addMonths(closing, 1) : closing;
  return isoDate(target.year, target.month, clampDay(target.year, target.month, dayOf(card, 'due_day')));
};

/**
 * Em qual fatura esta compra cai.
 * A compra entra na PRIMEIRA fatura que fechar a partir dela: comprou dia 15/06
 * com fechamento dia 3, a próxima virada é 03/07 — cai na fatura de julho.
 *
 * @returns { month: 'YYYY-MM', dueDate: 'YYYY-MM-DD', closingDate: 'YYYY-MM-DD' }
 *          ou null se o cartão não tiver ciclo cadastrado
 */
export const invoiceForPurchase = ({ card, purchaseDate } = {}) => {
  const purchase = parseIso(purchaseDate);
  if (!purchase || !hasCycle(card)) return null;

  const closingDay = dayOf(card, 'closing_day');
  // Comprou depois do fechamento deste mês? Então só entra no próximo.
  const closingMonth = purchase.day <= clampDay(purchase.year, purchase.month, closingDay)
    ? { year: purchase.year, month: purchase.month }
    : addMonths({ year: purchase.year, month: purchase.month }, 1);

  const closingDate = isoDate(
    closingMonth.year,
    closingMonth.month,
    clampDay(closingMonth.year, closingMonth.month, closingDay),
  );
  const dueDate = dueDateFromClosing(card, closingMonth);

  return { month: dueDate.slice(0, 7), dueDate, closingDate };
};

/**
 * Que período de compras a fatura de um mês cobre.
 * A fatura é identificada pelo mês do VENCIMENTO (é assim que o app guarda o
 * lançamento), então aqui volta-se do vencimento até o fechamento anterior.
 *
 * @returns { start, end, dueDate, closingDate } ou null sem ciclo cadastrado
 */
export const invoicePeriod = ({ card, month } = {}) => {
  const due = parseMonth(month);
  if (!due || !hasCycle(card)) return null;

  // Se o cartão vence no mês seguinte ao fechamento, a fatura que vence neste
  // mês fechou no mês passado.
  const closingMonth = dueComesNextMonth(card) ? addMonths(due, -1) : due;
  const previousClosing = addMonths(closingMonth, -1);

  const closingDay = dayOf(card, 'closing_day');
  const closingDate = isoDate(
    closingMonth.year,
    closingMonth.month,
    clampDay(closingMonth.year, closingMonth.month, closingDay),
  );
  // Começa no dia SEGUINTE ao fechamento anterior: o dia do fechamento
  // pertence à fatura que fechou nele, não à próxima.
  const previousClosingDay = clampDay(previousClosing.year, previousClosing.month, closingDay);
  const startDate = new Date(Date.UTC(previousClosing.year, previousClosing.month - 1, previousClosingDay + 1));

  return {
    start: startDate.toISOString().slice(0, 10),
    end: closingDate,
    closingDate,
    dueDate: dueDateFromClosing(card, closingMonth),
  };
};

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .trim()
  .toLowerCase();

/**
 * Acha o cartão cadastrado a partir do nome gravado no lançamento.
 * Os nomes nem sempre batem exatamente ("Santander" no lançamento x
 * "Santander 7535/7909" no cadastro), então tenta o nome exato e, se não achar,
 * aceita que um contenha o outro.
 */
export const findCardByName = (cards = [], name = '') => {
  const target = normalize(name);
  if (!target) return null;

  const names = (card) => [card.card_name, card.name, card.bank].filter(Boolean).map(normalize);
  const exact = cards.find((card) => names(card).includes(target));
  if (exact) return exact;

  return cards.find((card) => names(card).some((item) => item.includes(target) || target.includes(item))) || null;
};

const MONTH_LABELS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const shortDate = (iso) => {
  const parsed = parseIso(iso);
  return parsed ? `${pad(parsed.day)}/${pad(parsed.month)}` : '';
};

/**
 * Frase que a tela mostra para a fatura não ser ambígua.
 * Ex.: "Fatura de julho — compras de 04/06 a 03/07, vence 10/07"
 */
export const describeInvoice = ({ card, month } = {}) => {
  const period = invoicePeriod({ card, month });
  const parsed = parseMonth(month);
  if (!parsed) return '';

  const label = `Fatura de ${MONTH_LABELS[parsed.month - 1]}`;
  if (!period) {
    return `${label} — cadastre o fechamento e o vencimento do cartão para ver o período das compras.`;
  }

  return `${label} — compras de ${shortDate(period.start)} a ${shortDate(period.end)}, vence ${shortDate(period.dueDate)}`;
};

export default { invoiceForPurchase, invoicePeriod, describeInvoice, findCardByName, hasCycle };
