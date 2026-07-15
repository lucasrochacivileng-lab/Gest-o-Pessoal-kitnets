export type NubankTransactionType = 'purchase' | 'pix_sent' | 'pix_received';
export type FinancialProvider = 'nubank' | 'inter' | 'itau' | 'caixa' | 'mercado_pago';

export type ParsedNubankNotification = {
  recognized: boolean;
  provider?: FinancialProvider;
  transactionType?: NubankTransactionType;
  direction?: 'in' | 'out';
  amount?: number;
  merchant?: string;
  description?: string;
  parserVersion: string;
};

const PROVIDER_PACKAGES: Array<{ provider: FinancialProvider; pattern: RegExp }> = [
  { provider: 'nubank', pattern: /(?:^|\.)nu\.production$|nubank/i },
  { provider: 'inter', pattern: /intermedium|bancointer/i },
  { provider: 'itau', pattern: /(?:^|\.)itau(?:\.|$)/i },
  { provider: 'caixa', pattern: /gabba\.caixa|gov\.caixa|caixatem/i },
  { provider: 'mercado_pago', pattern: /mercadopago|mercado\.pago/i },
];

export const detectFinancialProvider = (packageName = '') => (
  PROVIDER_PACKAGES.find(({ pattern }) => pattern.test(packageName))?.provider
);

const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim();

const parseBrazilianMoney = (value: string) => {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
};

const extractAmount = (text: string) => {
  const match = text.match(/R\$\s*([\d.]+,\d{2})/i);
  return match ? parseBrazilianMoney(match[1]) : undefined;
};

const cleanCounterparty = (value = '') => normalizeSpaces(value)
  .replace(/[.!?,;:]+$/g, '')
  .replace(/\s+(?:no valor|de)\s*$/i, '')
  .trim();

const extractAfter = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanCounterparty(match[1]);
  }
  return '';
};

export const parseBankNotification = (packageName = '', title = '', text = ''): ParsedNubankNotification => {
  const provider = detectFinancialProvider(packageName);
  if (!provider) return { recognized: false, parserVersion: 'unsupported-package' };

  const parserVersion = `${provider}-v1`;
  const combined = normalizeSpaces(`${title} ${text}`);
  const lower = combined.toLocaleLowerCase('pt-BR');
  const amount = extractAmount(combined);

  if (!amount) return { recognized: false, provider, parserVersion };

  if (/pix\s+(?:recebido|recebida)|voc[eê]\s+recebeu(?:\s+(?:um|via))?\s+pix|voc[eê]\s+recebeu\s+R\$.*\bvia\s+pix|recebimento\s+(?:via\s+)?pix/i.test(lower)) {
    const merchant = extractAfter(combined, [
      /pix\s+recebido\s+de\s+(.+?)(?:\s+no\s+valor|\s+de\s+R\$|$)/i,
      /voc[eê]\s+recebeu\s+(?:um\s+)?pix\s+de\s+(.+?)(?:\s+no\s+valor|\s+de\s+R\$|$)/i,
      /de\s+(.+?)(?:\s+no\s+valor|\s+de\s+R\$|$)/i,
    ]);
    return {
      recognized: true,
      provider,
      transactionType: 'pix_received',
      direction: 'in',
      amount,
      merchant: merchant || 'Pix recebido',
      description: merchant ? `Pix recebido de ${merchant}` : 'Pix recebido',
      parserVersion,
    };
  }

  if (/pix\s+(?:enviado|realizado|feito)|voc[eê]\s+(?:fez|enviou)\s+(?:um\s+)?pix|transfer[eê]ncia\s+(?:via\s+)?pix/i.test(lower)) {
    const merchant = extractAfter(combined, [
      /pix\s+(?:enviado|realizado|feito)\s+(?:para|a)\s+(.+?)(?:\s+no\s+valor|\s+de\s+R\$|$)/i,
      /voc[eê]\s+(?:fez|enviou)\s+(?:um\s+)?pix\s+(?:de\s+R\$\s*[\d.]+,\d{2}\s+)?(?:para|a)\s+(.+?)(?:\s+no\s+valor|$)/i,
      /(?:para|a)\s+(.+?)(?:\s+no\s+valor|$)/i,
    ]);
    return {
      recognized: true,
      provider,
      transactionType: 'pix_sent',
      direction: 'out',
      amount,
      merchant: merchant || 'Pix enviado',
      description: merchant ? `Pix enviado para ${merchant}` : 'Pix enviado',
      parserVersion,
    };
  }

  if (/compra\s+(?:aprovada|realizada)|voc[eê]\s+fez\s+uma\s+compra|cart[aã]o|d[eé]bito|cr[eé]dito/i.test(lower)) {
    const merchant = extractAfter(combined, [
      /(?:em|no estabelecimento)\s+(.+?)(?:\s+no\s+valor|\s+por\s+R\$|$)/i,
      /compra\s+(?:aprovada|realizada)\s+(?:de|no valor de)\s+R\$\s*[\d.]+,\d{2}\s+(?:em|no)\s+(.+)$/i,
      /compra\s+de\s+R\$\s*[\d.]+,\d{2}.*?\s+(?:em|no)\s+(.+)$/i,
    ]);
    return {
      recognized: true,
      provider,
      transactionType: 'purchase',
      direction: 'out',
      amount,
      merchant: merchant || 'Compra Nubank',
      description: merchant ? `Compra em ${merchant}` : 'Compra Nubank',
      parserVersion,
    };
  }

  return { recognized: false, provider, parserVersion };
};

export const parseNubankNotification = (title = '', text = '') => (
  parseBankNotification('com.nu.production', title, text)
);

const BUILT_IN_RULES = [
  { words: ['ifood', 'restaurante', 'lanchonete'], category: 'alimentacao', costCenter: 'pessoal' },
  { words: ['supermercado', 'mercado', 'atacadao'], category: 'mercado', costCenter: 'pessoal' },
  { words: ['posto', 'combustivel'], category: 'combustivel', costCenter: 'pessoal' },
  { words: ['farmacia', 'drogaria'], category: 'farmacia', costCenter: 'pessoal' },
  { words: ['amazon prime', 'netflix', 'spotify', 'melimais'], category: 'assinatura', costCenter: 'pessoal' },
  { words: ['leroy', 'telhanorte', 'material construcao'], category: 'material de construcao', costCenter: 'kitnets' },
];

type ClassificationRule = {
  keyword?: string;
  category?: string;
  segment?: string;
  priority?: number;
  enabled?: boolean;
};

const normalize = (value = '') => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export const suggestByRules = (description: string, customRules: ClassificationRule[] = []) => {
  const normalized = normalize(description);
  const custom = [...customRules]
    .filter((rule) => rule.enabled !== false && rule.keyword)
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))
    .find((rule) => normalized.includes(normalize(rule.keyword)));

  if (custom) {
    return {
      category: custom.category || 'outros',
      costCenter: custom.segment || 'pessoal',
      source: 'custom_rule',
    };
  }

  const builtIn = BUILT_IN_RULES.find((rule) => rule.words.some((word) => normalized.includes(normalize(word))));
  return builtIn
    ? { category: builtIn.category, costCenter: builtIn.costCenter, source: 'built_in_rule' }
    : { category: 'outros', costCenter: 'pessoal', source: 'fallback' };
};
