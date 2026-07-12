const toMoney = (value) => Number(value || 0);
const monthOf = (date) => String(date || '').slice(0, 7);

export const CARD_TRANSACTION_STATUS = {
  REVIEW: 'revisar',
  IGNORE: 'ignorar',
};

export const isCardTransaction = (row = {}) => (
  row.type === 'card_transaction' && row.status !== CARD_TRANSACTION_STATUS.IGNORE
);

export const getEconomicOrigin = (row = {}) => {
  // O segmento novo manda quando existe; senão, cai no `context` histórico.
  // Só custo de kitnet aparece como "kitnets" na divisão da fatura; perícias,
  // projetos, trabalho e pessoal entram todos como gasto pessoal do cartão.
  if (row.segment === 'kitnets') return 'kitnets';
  if (row.segment) return 'pessoal';
  if (['kitnets', 'obra'].includes(row.context)) return 'kitnets';
  return 'pessoal';
};

export const getCostType = (row = {}) => {
  const category = String(row.category || '').toLowerCase();
  const context = String(row.context || '').toLowerCase();

  if (context === 'obra') return 'investimento';
  if (category.includes('investimento')) return 'investimento';
  if (category.includes('material') || category.includes('construcao') || category.includes('construção')) return 'investimento';
  if (category.includes('fotovoltaico') || category.includes('solar')) return 'investimento';
  if (category.includes('emprestimo') || category.includes('empréstimo') || category.includes('financiamento')) return 'financiamento';

  return 'custeio';
};

const byDateThenDescription = (a, b) => (
  String(a.date || '').localeCompare(String(b.date || ''))
  || String(a.description || '').localeCompare(String(b.description || ''))
);

export const buildCardInvoices = ({ personal = [], month }) => {
  const groups = new Map();

  personal
    .filter(isCardTransaction)
    .filter((row) => monthOf(row.date) === month)
    .forEach((row) => {
      const cardName = row.card_name || 'Cartão sem nome';
      const current = groups.get(cardName) || {
        id: cardName,
        cardName,
        dueDate: row.date || '',
        total: 0,
        personalTotal: 0,
        kitnetsTotal: 0,
        investmentTotal: 0,
        reviewCount: 0,
        itemCount: 0,
        items: [],
      };

      const value = toMoney(row.value);
      const origin = getEconomicOrigin(row);
      const costType = getCostType(row);
      const item = {
        ...row,
        value,
        origin,
        costType,
      };

      current.total += value;
      current.itemCount += 1;
      current.dueDate = current.dueDate && row.date
        ? (String(row.date) < String(current.dueDate) ? row.date : current.dueDate)
        : row.date || current.dueDate;
      if (origin === 'kitnets') current.kitnetsTotal += value;
      else current.personalTotal += value;
      if (costType === 'investimento' || costType === 'financiamento') current.investmentTotal += value;
      if ([CARD_TRANSACTION_STATUS.REVIEW, 'sugerido'].includes(row.status)) current.reviewCount += 1;
      current.items.push(item);
      groups.set(cardName, current);
    });

  return [...groups.values()]
    .map((invoice) => ({
      ...invoice,
      items: invoice.items.sort(byDateThenDescription),
    }))
    .sort((a, b) => b.total - a.total);
};

export const buildCardInvoiceSummary = (invoices = []) => ({
  invoiceTotal: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
  personalTotal: invoices.reduce((sum, invoice) => sum + invoice.personalTotal, 0),
  kitnetsTotal: invoices.reduce((sum, invoice) => sum + invoice.kitnetsTotal, 0),
  investmentTotal: invoices.reduce((sum, invoice) => sum + invoice.investmentTotal, 0),
  reviewCount: invoices.reduce((sum, invoice) => sum + invoice.reviewCount, 0),
});

// Recortes que os cards de resumo do topo aplicam à tabela de detalhe. Cada
// um casa com a mesma dimensão que o card soma (origem pessoal/kitnets ou
// custo de investimento/financiamento), para clicar no card mostrar
// exatamente os itens daquele total — e não a fatura de um cartão qualquer.
export const INVOICE_VIEWS = { pessoal: 'pessoal', kitnets: 'kitnets', investimento: 'investimento' };

export const matchesInvoiceView = (item = {}, view = '') => {
  if (view === INVOICE_VIEWS.pessoal) return item.origin === 'pessoal';
  if (view === INVOICE_VIEWS.kitnets) return item.origin === 'kitnets';
  if (view === INVOICE_VIEWS.investimento) return item.costType === 'investimento' || item.costType === 'financiamento';
  return true;
};

// Fonte da tabela de detalhe: um recorte por dimensão (view) atravessa TODAS
// as faturas; sem view, mostra os itens do cartão selecionado. Assim o que
// aparece na tabela sempre corresponde ao card destacado logo acima.
export const selectInvoiceItems = ({ invoices = [], selectedInvoice = null, view = '' }) => {
  if (view) {
    return invoices
      .flatMap((invoice) => invoice.items || [])
      .filter((item) => matchesInvoiceView(item, view))
      .sort(byDateThenDescription);
  }
  return selectedInvoice ? selectedInvoice.items : [];
};

export default buildCardInvoices;
