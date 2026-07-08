import * as XLSX from 'xlsx';

const DEFAULT_CATEGORY = 'outros';
const DEFAULT_CONTEXT = 'pessoal';

const CATEGORY_RULES = [
  { category: 'combustivel', context: 'pessoal', patterns: ['posto', 'shell', 'ipiranga', 'petrobras', 'combustivel', 'gasolina', 'etanol'] },
  { category: 'investimento kitnets', context: 'obra', patterns: ['ar condicionado', 'ar-condicionado', 'split', 'fotovoltaico', 'solar', 'soollar', 'fotus', 'kitnet', 'kit 08', 'kit08'] },
  { category: 'material de construcao', context: 'obra', patterns: ['material', 'construcao', 'cimento', 'telha', 'hidraul', 'eletric', 'leroy', 'casa construtor'] },
  { category: 'mercado', context: 'pessoal', patterns: ['supermercado', 'mercado', 'atacadao', 'assai', 'carrefour', 'extra'] },
  { category: 'alimentacao', context: 'pessoal', patterns: ['ifood', 'restaurante', 'lanche', 'pizz', 'burger', 'padaria', 'acai'] },
  { category: 'farmacia', context: 'pessoal', patterns: ['farmacia', 'drogaria', 'raia', 'drogasil', 'medic'] },
  { category: 'assinatura', context: 'pessoal', patterns: ['netflix', 'spotify', 'prime', 'amazon prime', 'google', 'apple', 'microsoft', 'assinatura'] },
  { category: 'familia', context: 'pessoal', patterns: ['familia', 'pai', 'mae', 'filho'] },
  { category: 'impostos', context: 'pessoal', patterns: ['imposto', 'iptu', 'ipva', 'darf', 'gps'] },
  { category: 'emprestimos', context: 'pessoal', patterns: ['emprestimo', 'mutua', 'financiamento'] },
];

const FIELD_ALIASES = {
  date: ['data', 'data compra', 'data_compra', 'data_tx', 'purchase_date', 'dt compra'],
  description: ['descricao', 'descrição', 'descricao original', 'descricao_original', 'historico', 'histórico', 'estabelecimento', 'lançamento', 'lancamento'],
  value: ['valor', 'valor r$', 'valor_compra', 'valor_compra_r$', 'amount'],
  card: ['cartao', 'cartão', 'card', 'nome cartao', 'nome do cartão'],
  installment: ['parcela', 'parcelas', 'installment'],
  currentInstallment: ['parcela atual', 'parcela_atual', 'current_installment'],
  totalInstallments: ['parcela total', 'parcelas totais', 'parcela_total', 'total_installments'],
};

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const headerKey = (headers, aliases) => headers.find((header) => aliases.includes(normalize(header)));

const getField = (row, headers, key) => {
  const field = headerKey(headers, FIELD_ALIASES[key]);
  return field ? row[field] : '';
};

export const parseMoney = (value) => {
  if (typeof value === 'number') return Math.abs(value);
  const text = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(,|$))/g, '')
    .replace(',', '.');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
};

const excelDateToIso = (serial) => {
  const parsed = Number(serial);
  if (!Number.isFinite(parsed)) return '';
  const date = new Date((Math.floor(parsed) - 25569) * 86400 * 1000);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

export const parseDate = (value) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);

  const text = String(value).trim();
  if (/^\d{5,6}$/.test(text)) return excelDateToIso(text);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  return '';
};

const parseInstallment = ({ installment, currentInstallment, totalInstallments, description }) => {
  const direct = `${installment || ''} ${description || ''}`;
  const match = direct.match(/(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i);
  const current = Number(currentInstallment || match?.[1] || 1);
  const total = Number(totalInstallments || match?.[2] || current || 1);

  return {
    current: Number.isFinite(current) && current > 0 ? current : 1,
    total: Number.isFinite(total) && total > 0 ? total : 1,
  };
};

export const classifyTransaction = (description = '') => {
  const text = normalize(description);
  const rule = CATEGORY_RULES.find((item) => item.patterns.some((pattern) => text.includes(normalize(pattern))));
  return {
    category: rule?.category || DEFAULT_CATEGORY,
    context: rule?.context || DEFAULT_CONTEXT,
  };
};

const addMonths = (monthKey, offset) => {
  const [year, month] = String(monthKey).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const buildDueDate = (monthKey, dueDay) => `${monthKey}-${String(Math.min(Math.max(Number(dueDay) || 10, 1), 28)).padStart(2, '0')}`;

const matchKitnetId = (description, kitnets = []) => {
  const text = normalize(description);
  const numberMatch = text.match(/\bkit(?:net)?\s*0?(\d{1,2})\b/);

  if (numberMatch) {
    const number = Number(numberMatch[1]);
    const kitnet = kitnets.find((item) => normalize(item.name).includes(`0${number}`) || normalize(item.name).includes(` ${number}`));
    if (kitnet) return kitnet.id;
  }

  return '';
};

export const buildOriginHash = ({ card_name, purchase_date, description, value, installment }) => [
  normalize(card_name),
  purchase_date || '',
  normalize(description),
  Number(value || 0).toFixed(2),
  installment || '',
].join('|');

export const rowsFromWorkbook = (workbook) => {
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
};

export const parseStatementRows = (rows, { defaultCardName = '' } = {}) => {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);

  return rows.map((row, index) => {
    const description = String(getField(row, headers, 'description') || '').trim();
    const value = parseMoney(getField(row, headers, 'value'));
    const cardName = String(getField(row, headers, 'card') || defaultCardName || '').trim();
    const purchaseDate = parseDate(getField(row, headers, 'date'));
    const installment = parseInstallment({
      installment: getField(row, headers, 'installment'),
      currentInstallment: getField(row, headers, 'currentInstallment'),
      totalInstallments: getField(row, headers, 'totalInstallments'),
      description,
    });

    return {
      source_index: index + 1,
      purchase_date: purchaseDate,
      description: description || `Lancamento ${index + 1}`,
      value,
      card_name: cardName,
      installment_current: installment.current,
      installment_total: installment.total,
      raw: row,
    };
  }).filter((row) => row.value > 0 && row.description);
};

export const parseStatementFile = async (file, options = {}) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return parseStatementRows(rowsFromWorkbook(workbook), options);
};

export const buildInstallmentPreview = ({
  transactions,
  statementMonth,
  dueDay,
  defaultCardName = '',
  existingTransactions = [],
  kitnets = [],
}) => {
  const existingHashes = new Set(existingTransactions.map((item) => item.origin_hash).filter(Boolean));

  return transactions.flatMap((transaction) => {
    const rows = [];
    const firstInstallment = transaction.installment_current || 1;
    const totalInstallments = Math.max(transaction.installment_total || firstInstallment, firstInstallment);
    const cardName = transaction.card_name || defaultCardName || 'Cartao';
    const classification = classifyTransaction(transaction.description);

    for (let installmentNumber = firstInstallment; installmentNumber <= totalInstallments; installmentNumber += 1) {
      const month = addMonths(statementMonth, installmentNumber - firstInstallment);
      const installmentLabel = `${installmentNumber}/${totalInstallments}`;
      const item = {
        type: 'card_transaction',
        date: buildDueDate(month, dueDay),
        purchase_date: transaction.purchase_date,
        description: transaction.description,
        value: transaction.value,
        context: classification.context,
        category: classification.category,
        card_name: cardName,
        installment: installmentLabel,
        status: 'revisar',
        recurring: false,
        kitnet_id: matchKitnetId(transaction.description, kitnets),
        notes: 'Importado de fatura de cartao. Revisar categoria/contexto antes de confirmar no caixa.',
      };

      item.origin_hash = buildOriginHash(item);
      item.duplicate = existingHashes.has(item.origin_hash);
      rows.push(item);
    }

    return rows;
  });
};

export const summarizeByCategory = (rows = []) => rows.reduce((acc, row) => {
  const category = row.category || DEFAULT_CATEGORY;
  acc[category] = (acc[category] || 0) + Number(row.value || 0);
  return acc;
}, {});

export default {
  parseStatementFile,
  parseStatementRows,
  buildInstallmentPreview,
  summarizeByCategory,
  classifyTransaction,
};
