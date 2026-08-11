import * as XLSX from 'xlsx';
import { applyRules } from './classificationRuleService.js';
import { matchStatementAgainstNotifications } from './notificationPurchaseMatchService.js';
import { clampDay } from './cardCycleService.js';
import { parseMoneyInput } from './money.js';

const DEFAULT_CATEGORY = 'outros';
const DEFAULT_CONTEXT = 'pessoal';

const CATEGORY_RULES = [
  { category: 'combustivel', context: 'pessoal', patterns: ['posto', 'shell', 'ipiranga', 'petrobras', 'combustivel', 'gasolina', 'etanol'] },
  { category: 'transporte', context: 'pessoal', patterns: ['nutag', 'pedagio', 'sem parar', 'conectcar', 'estacionamento'] },
  { category: 'investimento kitnets', context: 'obra', patterns: ['ar condicionado', 'ar-condicionado', 'split', 'fotovoltaico', 'solar', 'soollar', 'fotus', 'kitnet', 'kit 08', 'kit08'] },
  { category: 'material de construcao', context: 'obra', patterns: ['material', 'construcao', 'cimento', 'telha', 'hidraul', 'eletric', 'leroy', 'casa construtor', 'ferragista', 'ferragens', 'casa das tintas', 'mundo das utilidad', 'telascup', 'irmaossoares', 'cioneyrodriguesfe'] },
  { category: 'mercado', context: 'pessoal', patterns: ['supermercado', 'mercado', 'atacadao', 'assai', 'carrefour', 'extra', 'kitandas', 'tatico', 'primavera supermercado', 'supermercado reis'] },
  { category: 'alimentacao', context: 'pessoal', patterns: ['ifood', 'restaurante', 'lanche', 'lanchon', 'pizz', 'burger', 'padaria', 'panificadora', 'acai'] },
  { category: 'farmacia', context: 'pessoal', patterns: ['farmacia', 'drogaria', 'raia', 'drogasil', 'medic'] },
  { category: 'lazer', context: 'pessoal', patterns: ['barbearia', 'nuuvem', 'youtube member'] },
  { category: 'assinatura', context: 'pessoal', patterns: ['netflix', 'spotify', 'prime', 'amazon prime', 'google', 'chatgpt', 'apple', 'microsoft', 'assinatura'] },
  { category: 'familia', context: 'pessoal', patterns: ['familia', 'pai', 'mae', 'filho', 'bebe', 'metlife', 'vida'] },
  { category: 'impostos', context: 'pessoal', patterns: ['imposto', 'iptu', 'ipva', 'darf', 'gps'] },
  { category: 'emprestimos', context: 'pessoal', patterns: ['emprestimo', 'mutua', 'financiamento'] },
];

const FIELD_ALIASES = {
  date: ['data', 'date', 'data compra', 'data_compra', 'data_tx', 'purchase_date', 'dt compra'],
  description: ['descricao', 'descrição', 'descricao original', 'descricao_original', 'historico', 'histórico', 'estabelecimento', 'lançamento', 'lancamento', 'title'],
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

// Alguns bancos emitem cart\u00f5es adicionais (titular + dependente) com n\u00fameros
// de final diferentes, mas a fatura \u00e9 uma s\u00f3. Sem normalizar, cada final vira
// um "cart\u00e3o" separado nas faturas de Despesas. Mapeie aqui o nome do cart\u00e3o
// adicional (como vem no extrato) para o nome do titular. Chave sempre em
// min\u00fasculas/sem acento (comparada via normalize).
const CARD_NAME_ALIASES = {
  'santander 7535': 'Santander 7909',
};

export const normalizeCardName = (value) => {
  const trimmed = String(value || '').trim();
  return CARD_NAME_ALIASES[normalize(trimmed)] || trimmed;
};

const headerKey = (headers, aliases) => headers.find((header) => aliases.includes(normalize(header)));

const getField = (row, headers, key) => {
  const field = headerKey(headers, FIELD_ALIASES[key]);
  return field ? row[field] : '';
};

// O separador decimal é sempre o ÚLTIMO ponto/vírgula da string (padrão
// BR "1.234.567,89" ou US "1,234,567.89"); tudo antes dele é separador de
// milhar e é descartado. A versão anterior só removia o ponto de milhar
// quando seguido de exatamente 3 dígitos + vírgula/fim — falhava (e
// devolvia 0 em silêncio) para qualquer valor com dois separadores de
// milhar, ex.: "1.234.567,89" (valores >= R$ 1 milhão).
//
// A conversão em si vive em money.js (parseMoneyInput), usada por todo o app.
// O que é específico da FATURA é o módulo: a fatura lista o valor da compra
// sem sinal, e o sinal do estorno vem da descrição da linha, não do número.
export const parseMoney = (value) => Math.abs(parseMoneyInput(value));

// Linhas de crédito da fatura — não são compras, mas não são a mesma coisa:
//
//   pagamento -> quita a fatura ANTERIOR. Não pertence a esta importação e
//                simplesmente sai.
//   estorno   -> devolve uma compra DESTA fatura. O banco lança a cobrança e a
//                devolução na mesma fatura, então descartar só o estorno deixa
//                a cobrança sozinha e infla o total. Precisa anular a compra
//                correspondente (ver applyRefunds).
const PAYMENT_TERMS = ['pagamento recebido', 'pagamento de fatura'];
const REFUND_TERMS = ['estorno', 'reembolso', 'devolucao'];

const hasTerm = (value, terms) => {
  const text = normalize(value);
  return terms.some((term) => text.includes(normalize(term)));
};

const isNegative = (value) => String(value ?? '').trim().startsWith('-') || Number(value) < 0;

export const isPaymentRow = ({ description } = {}) => hasTerm(description, PAYMENT_TERMS);

export const isRefundRow = ({ description, value } = {}) => (
  !isPaymentRow({ description })
  && (hasTerm(description, REFUND_TERMS) || isNegative(value))
);

// O Nubank escreve o estorno como:
//   Estorno de "Google Claude By Anth" (Google Claude By Anth)
// O nome entre aspas é o que casa com a linha da compra original.
export const refundTargetName = (description = '') => {
  const quoted = String(description).match(/["“]([^"”]+)["”]/);
  if (quoted) return quoted[1].trim();

  const after = String(description).match(/(?:estorno|reembolso|devolu[cç][aã]o)\s+(?:de\s+)?(.+)$/i);
  return after ? after[1].replace(/\s*\([^)]*\)\s*$/, '').trim() : '';
};

const dayDistance = (a, b) => {
  const first = Date.parse(`${a}T00:00:00Z`);
  const second = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return Infinity;
  return Math.abs(first - second) / 86400000;
};

// Casa cada estorno com a compra que ele devolve e marca a compra como
// estornada. O consumo é 1-a-1: duas assinaturas de R$ 110 no mesmo mês com um
// único estorno têm que deixar UMA cobrança de pé.
const applyRefunds = (purchases = [], refunds = []) => {
  const used = new Set();

  refunds.forEach((refund) => {
    const target = normalize(refundTargetName(refund.description));
    const candidates = purchases.filter((purchase) => {
      if (used.has(purchase.source_index)) return false;
      if (Math.abs(purchase.value - refund.value) > 0.01) return false;
      if (!target) return true;

      const text = normalize(purchase.description);
      return text.includes(target) || target.includes(text);
    });

    if (!candidates.length) return;

    // O estorno devolve uma compra ANTERIOR a ele: entre as candidatas, a mais
    // recente até a data do estorno. Sem nenhuma anterior, a mais próxima.
    const previous = candidates.filter((purchase) => (
      purchase.purchase_date && purchase.purchase_date <= refund.purchase_date
    ));
    const best = previous.length
      ? previous.reduce((a, b) => (a.purchase_date >= b.purchase_date ? a : b))
      : candidates.reduce((a, b) => (
        dayDistance(a.purchase_date, refund.purchase_date) <= dayDistance(b.purchase_date, refund.purchase_date) ? a : b
      ));

    used.add(best.source_index);
    best.refunded = true;
    best.refund_date = refund.purchase_date;
  });

  return purchases;
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
    const first = Number(match[1]);
    const second = Number(match[2]);
    const isMonthFirst = second > 12 && first <= 12;
    const day = isMonthFirst ? second : first;
    const month = isMonthFirst ? first : second;
    const date = new Date(Date.UTC(Number(year), month - 1, day));

    if (date.getUTCFullYear() === Number(year) && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return '';
};

const parseInstallment = ({ installment, currentInstallment, totalInstallments, description }) => {
  const direct = `${installment || ''} ${description || ''}`;
  const match = direct.match(/(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i);
  const current = Number(currentInstallment || match?.[1] || 1);
  const total = Number(totalInstallments || match?.[2] || current || 1);

  const safeCurrent = Number.isFinite(current) && current > 0 ? current : 1;
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 1;

  return {
    current: safeCurrent,
    // Nunca menor que a parcela atual: um total malformado ("5/3" na fatura)
    // faria o laço de buildInstallmentPreview não rodar nenhuma vez,
    // descartando a compra inteira da importação sem nenhum aviso.
    total: Math.max(safeTotal, safeCurrent),
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

const buildDueDate = (monthKey, dueDay) => {
  const [year, month] = String(monthKey).split('-').map(Number);
  return `${monthKey}-${String(clampDay(year, month, Number(dueDay) || 10)).padStart(2, '0')}`;
};

const matchKitnetId = (description, kitnets = []) => {
  const text = normalize(description);
  const numberMatch = text.match(/\bkit(?:net)?\s*0?(\d{1,2})\b/);
  if (!numberMatch) return '';

  const number = Number(numberMatch[1]);
  // Compara o número EXTRAÍDO do nome da kitnet, não um "includes" de texto:
  // procurar "Kit 1" com includes(' 1') casava "Kitnet 15" (contém " 1" antes
  // do "5"), atribuindo a transação à kitnet errada.
  const kitnet = kitnets.find((item) => {
    const kitnetNumber = normalize(item.name).match(/(\d{1,2})/);
    return kitnetNumber && Number(kitnetNumber[1]) === number;
  });

  return kitnet?.id || '';
};

export const buildOriginHash = ({ card_name, purchase_date, description, value, installment }) => [
  normalize(card_name),
  purchase_date || '',
  normalize(description),
  Number(value || 0).toFixed(2),
  installment || '',
].join('|');

// O banco RE-ROTULA a parcela a cada fatura: a mesma compra sai como
// "Loja - Parcela 5/12" na fatura de julho e "Loja - Parcela 6/12" na de
// agosto, com purchase_date do ciclo novo e, às vezes, 1 ou 2 centavos de
// diferença no arredondamento da parcela. Como a importação anterior já
// PROJETOU as parcelas futuras, o origin_hash — que embute descrição,
// purchase_date e valor exatos — não reconhece a projeção e a compra entra
// duas vezes.
//
// O que NÃO muda entre as duas leituras é: cartão + vencimento da parcela +
// estabelecimento (a descrição sem o rótulo da parcela) + o número da parcela.
// É essa a chave estável que reconhece a reprojeção.
//
// Cada banco escreve o rótulo do seu jeito e os dois precisam sair: o Nubank
// usa "Loja - Parcela 5/12" e o Bradescard/Amazon usa "LOJA SAO PAULO(05/10)".
const INSTALLMENT_LABEL = /\s*(?:-\s*parcela\s+\d{1,3}\s*\/\s*\d{1,3}|\(\s*\d{1,3}\s*\/\s*\d{1,3}\s*\))\s*$/;

export const merchantOf = (description = '') => normalize(description).replace(INSTALLMENT_LABEL, '').trim();

export const buildInstallmentKey = ({ card_name, date, description, installment } = {}) => [
  normalize(card_name),
  date || '',
  merchantOf(description),
  installment || '',
].join('|');

export const rowsFromWorkbook = (workbook) => {
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
};

export const parseStatementRows = (rows, { defaultCardName = '' } = {}) => {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);

  const parsed = rows.map((row, index) => {
    const description = String(getField(row, headers, 'description') || '').trim();
    const rawValue = getField(row, headers, 'value');
    const value = parseMoney(rawValue);
    const cardName = normalizeCardName(getField(row, headers, 'card') || defaultCardName || '');
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
      payment: isPaymentRow({ description }),
      refund: isRefundRow({ description, value: rawValue }),
      raw: row,
    };
  }).filter((row) => row.value > 0 && row.description);

  const purchases = parsed.filter((row) => !row.payment && !row.refund);
  const refunds = parsed.filter((row) => row.refund);

  // eslint-disable-next-line no-unused-vars
  return applyRefunds(purchases, refunds).map(({ payment, refund, ...row }) => row);
};

export const parseStatementFile = async (file, options = {}) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, raw: true });
  return parseStatementRows(rowsFromWorkbook(workbook), options);
};

export const buildInstallmentPreview = ({
  transactions,
  statementMonth,
  dueDay,
  defaultCardName = '',
  existingTransactions = [],
  kitnets = [],
  // Regras de classificação criadas pelo usuário (tela "Regras de
  // classificação"). Quando uma casa, ela MANDA na categoria/segmento; senão,
  // cai no classificador embutido por palavras-chave (classifyTransaction).
  rules = [],
}) => {
  const existingHashes = new Set(existingTransactions.map((item) => item.origin_hash).filter(Boolean));

  // Parcelas que uma importação ANTERIOR já projetou, indexadas pela chave
  // estável (ver buildInstallmentKey). Cada balde é consumido 1-a-1: o mesmo
  // estabelecimento pode ter várias compras caindo no mesmo vencimento com a
  // mesma parcela (três compras "Irmaossoares - Parcela 5/6" no mesmo mês), e
  // casar uma projeção com duas linhas apagaria um gasto real.
  const projected = new Map();
  existingTransactions.forEach((row) => {
    if (!row?.installment || !row?.date) return;
    if (row.status === 'ignorar') return;

    const key = buildInstallmentKey(row);
    if (!projected.has(key)) projected.set(key, []);
    projected.get(key).push({ value: Number(row.value || 0), origin_hash: row.origin_hash, taken: false });
  });

  const alreadyImported = (item, totalInstallments) => {
    const bucket = projected.get(buildInstallmentKey(item)) || [];
    let hit = bucket.find((entry) => !entry.taken && entry.origin_hash && entry.origin_hash === item.origin_hash);

    // A tolerância só vale para compra PARCELADA, a única que a importação
    // anterior reprojeta. Uma compra à vista aparece numa fatura só: para ela
    // vale o hash exato, senão dois pedágios de R$ 14,59 comprados em dias
    // diferentes viravam "duplicata" um do outro. A folga cresce com o número
    // de parcelas porque é aí que o arredondamento do banco escorrega.
    if (!hit && totalInstallments > 1) {
      const tolerance = Math.max(0.05, 0.01 * totalInstallments);
      hit = bucket.find((entry) => !entry.taken && Math.abs(entry.value - Number(item.value || 0)) <= tolerance);
    }

    if (hit) {
      hit.taken = true;
      return true;
    }

    return existingHashes.has(item.origin_hash);
  };

  // Compras que a notificação do banco já capturou (Caixa de Entrada). São a
  // MESMA compra desta linha da fatura — a fatura só sabe mais (parcelamento e
  // vencimento). Ao salvar, a notificação casada é aposentada para a compra não
  // contar duas vezes.
  const notificationMatches = matchStatementAgainstNotifications({
    transactions,
    existing: existingTransactions,
  });

  return transactions.flatMap((transaction) => {
    const rows = [];
    const notificationMatch = notificationMatches.get(transaction.source_index);
    const firstInstallment = transaction.installment_current || 1;
    const totalInstallments = Math.max(transaction.installment_total || firstInstallment, firstInstallment);
    const cardName = transaction.card_name || defaultCardName || 'Cartao';
    const classification = classifyTransaction(transaction.description);
    const userActions = applyRules(rules, { description: transaction.description, card_name: cardName }) || {};
    const category = userActions.category || classification.category;
    // Segmento: regra do usuário > sugestão pela classificação (obra vira
    // investimento nas kitnets) > pessoal.
    const segment = userActions.segment || (classification.context === 'obra' ? 'kitnets' : 'pessoal');

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
        // Segmento (centro de resultado): regra do usuário quando existe, senão
        // a sugestão da classificação (obra vira investimento nas kitnets; o
        // resto começa como pessoal). Fica editável na prévia para mandar a
        // compra para Perícias/Projetos etc. antes de salvar.
        segment,
        category,
        card_name: cardName,
        installment: installmentLabel,
        // Compra estornada entra IGNORADA, não some: o extrato mostra a
        // cobrança e a devolução, e sumir com ela faria a fatura importada
        // divergir da fatura do banco sem explicação. Ignorada, ela aparece na
        // lista mas fica fora do total (ver isCardTransaction).
        status: transaction.refunded ? 'ignorar' : 'revisar',
        recurring: false,
        kitnet_id: matchKitnetId(transaction.description, kitnets),
        expert_report_id: '',
        project_id: '',
        notes: transaction.refunded
          ? `Estornada na propria fatura${transaction.refund_date ? ` em ${transaction.refund_date}` : ''}. Ignorada para nao somar no caixa.`
          : 'Importado de fatura de cartao. Revisar segmento/categoria antes de confirmar no caixa.',
      };

      item.origin_hash = buildOriginHash(item);
      item.duplicate = alreadyImported(item, totalInstallments);

      // Só a PRIMEIRA parcela carrega o vínculo: a notificação é uma só (o
      // valor cheio da compra), e quem a aposenta ao salvar é uma linha só.
      if (notificationMatch && installmentNumber === firstInstallment && !item.duplicate) {
        item.supersedes_id = notificationMatch.id;
        item.supersedes_description = notificationMatch.description;
        item.supersedes_value = notificationMatch.value;
      }

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
  buildInstallmentKey,
  summarizeByCategory,
  classifyTransaction,
};
