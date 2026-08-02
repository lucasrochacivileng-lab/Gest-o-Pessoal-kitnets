// Importa um extrato bancário (hoje: CSV do Nubank "Data,Valor,Identificador,
// Descrição") e alimenta a MESMA Caixa de Entrada Financeira que já existe
// para as notificações do celular (MacroDroid) — cada linha vira 1
// notification + 1 transaction, igual à Edge Function receive-notification,
// só que a origem é um arquivo em vez de um push. Assim a tela/RPCs de
// confirmação (FinancialInbox.jsx, financialInboxService.js) funcionam sem
// mudar nada.
//
// O "Identificador" que o Nubank já manda em cada linha é um id ESTÁVEL por
// transação — usamos ele (não um hash construído) como chave de dedupe, então
// reimportar um extrato com meses sobrepostos não duplica nada.
import { applyRules } from './classificationRuleService.js';
import { classifyTransaction } from './cardStatementImportService.js';
import { isSupabaseEnabled, supabase } from './supabaseClient.js';
import { repository } from '../repository/index.js';

const parseDateBR = (value) => {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

// O Nubank já manda o CSV com ponto decimal (ex.: "-2000.00"), diferente da
// fatura de cartão (que usa vírgula) — não precisa da conversão de parseMoney.
const parseValue = (value) => {
  const parsed = Number(String(value || '').trim());
  return Number.isFinite(parsed) ? parsed : NaN;
};

// Parser de CSV simples: 4 colunas fixas, sem aspas/vírgulas dentro dos
// campos neste formato do Nubank (a Descrição pode ter vírgula? não usa).
export const parseNubankStatementCsv = (text) => {
  const lines = String(text || '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const [, ...body] = lines[0].toLowerCase().includes('data') ? lines : [null, ...lines];

  return body.map((line) => {
    const firstComma = line.indexOf(',');
    const secondComma = line.indexOf(',', firstComma + 1);
    const thirdComma = line.indexOf(',', secondComma + 1);
    if (firstComma < 0 || secondComma < 0 || thirdComma < 0) return null;

    return {
      date: parseDateBR(line.slice(0, firstComma)),
      value: parseValue(line.slice(firstComma + 1, secondComma)),
      identificador: line.slice(secondComma + 1, thirdComma).trim(),
      descricao: line.slice(thirdComma + 1).trim(),
    };
  }).filter((row) => row && row.date && row.identificador && Number.isFinite(row.value));
};

// O Nubank manda o Pix ORIGINAL e o "Estorno" (quando a transferência não se
// completa) com o MESMO Identificador e valores opostos. Sem cancelar isso, a
// tentativa que falhou entraria na Caixa de Entrada como se fosse dinheiro de
// verdade indo e voltando.
export const excludeReversedPix = (rows) => {
  const byId = new Map();
  rows.forEach((row) => {
    if (!byId.has(row.identificador)) byId.set(row.identificador, []);
    byId.get(row.identificador).push(row);
  });

  const canceledIds = new Set();
  byId.forEach((group, id) => {
    if (group.length > 1 && Math.abs(group.reduce((sum, row) => sum + row.value, 0)) < 0.01) {
      canceledIds.add(id);
    }
  });

  return rows.filter((row) => !canceledIds.has(row.identificador));
};

// Linhas que são mecânica interna do banco, não um lançamento pra revisar:
// aplicação/resgate em caixinha (não sabemos em qual das caixinhas cadastradas
// caiu) e pagamento de fatura (já tem fluxo próprio em Despesas > Pagamento de
// fatura, com o formato certo de registro — importar aqui criaria um tipo que
// a tabela transactions nem aceita).
const SKIP_PATTERNS = [/aplica[cç][aã]o rdb/i, /resgate rdb/i, /pagamento de fatura/i];

const extractCounterparty = (descricao) => {
  const withoutPrefix = descricao.replace(
    /^(transfer[êe]ncia\s+(recebida|enviada)(\s+pelo\s+pix)?|pagamento de boleto efetuado)\s*-?\s*/i,
    '',
  );
  const [first] = withoutPrefix.split(' - ');
  return (first || '').trim();
};

// Classifica 1 linha do extrato em pix_received/pix_sent (os únicos tipos que
// fazem sentido pra um extrato de CONTA — compra de cartão e boleto emitido
// são de outras origens). Devolve null pras linhas que devem ser ignoradas.
export const classifyStatementRow = (row) => {
  if (SKIP_PATTERNS.some((pattern) => pattern.test(row.descricao))) return null;

  const direction = row.value > 0 ? 'in' : 'out';
  const transactionType = direction === 'in' ? 'pix_received' : 'pix_sent';
  const counterparty = extractCounterparty(row.descricao);
  const merchant = counterparty || (direction === 'in' ? 'Recebimento' : 'Pagamento');
  const isBoleto = /pagamento de boleto efetuado/i.test(row.descricao);
  const description = direction === 'in'
    ? `Pix recebido de ${merchant}`
    : isBoleto ? `Boleto pago — ${merchant}` : `Pix enviado para ${merchant}`;

  return { transactionType, direction, amount: Math.abs(row.value), merchant, description };
};

// Categoria/segmento sugeridos: regra do usuário (Regras de classificação)
// primeiro, senão o classificador embutido por palavra-chave — mesma
// prioridade que a importação de fatura de cartão já usa.
const suggestClassification = (description, rules) => {
  const userActions = applyRules(rules, { description }) || {};
  const builtIn = classifyTransaction(description);
  return {
    category: userActions.category || builtIn.category,
    costCenter: userActions.segment || (builtIn.context === 'obra' ? 'kitnets' : 'pessoal'),
  };
};

// Monta o plano de importação (puro, sem IO): 1 item por linha aproveitável,
// já com o dedupe_key. O chamador assíncrono filtra o que já existe e grava.
export const buildStatementImportPlan = (rows, { rules = [], provider = 'nubank' } = {}) => {
  const kept = excludeReversedPix(rows);

  return kept.reduce((plan, row) => {
    const classified = classifyStatementRow(row);
    if (!classified) return plan;

    const suggestion = suggestClassification(classified.description, rules);

    plan.push({
      ...classified,
      provider,
      date: row.date,
      dedupeKey: `${provider}_csv:${row.identificador}`,
      categorySuggested: suggestion.category,
      costCenterSuggested: suggestion.costCenter,
      raw: row,
    });
    return plan;
  }, []);
};

export const bankStatementImportService = {
  async import({ file, bankAccountId, provider = 'nubank' }) {
    if (!isSupabaseEnabled || !supabase) {
      throw new Error('A importação de extrato exige conexão com o Supabase (a Caixa de Entrada só existe lá).');
    }
    if (!bankAccountId) throw new Error('Selecione de qual conta é este extrato.');

    const text = await file.text();
    const rows = parseNubankStatementCsv(text);
    if (!rows.length) throw new Error('Não achei nenhuma linha reconhecível nesse arquivo.');

    const rules = await repository.list('ClassificationRule');
    const plan = buildStatementImportPlan(rows, { rules, provider });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sessão expirada — entre de novo antes de importar.');

    const dedupeKeys = plan.map((item) => item.dedupeKey);
    const { data: existingRows, error: existingError } = await supabase
      .from('notifications')
      .select('dedupe_key')
      .in('dedupe_key', dedupeKeys);
    if (existingError) throw new Error(`Não foi possível checar duplicados: ${existingError.message}`);
    const existingKeys = new Set((existingRows || []).map((row) => row.dedupe_key));

    const toImport = plan.filter((item) => !existingKeys.has(item.dedupeKey));

    let imported = 0;
    for (const item of toImport) {
      const occurredAt = `${item.date}T12:00:00-03:00`;

      const { data: notification, error: notificationError } = await supabase
        .from('notifications')
        .insert({
          owner_id: user.id,
          target_entity: 'financial_inbox',
          title: item.description,
          message: item.raw.descricao,
          status: 'pendente',
          source: 'csv_import',
          package_name: `${item.provider}_csv`,
          raw_title: item.description,
          raw_text: item.raw.descricao,
          received_at: occurredAt,
          payload: item.raw,
          parser_name: `${item.provider}_csv-v1`,
          parse_status: 'parsed',
          dedupe_key: item.dedupeKey,
        })
        .select('id')
        .single();
      if (notificationError) throw new Error(`Falha ao importar "${item.description}": ${notificationError.message}`);

      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          owner_id: user.id,
          notification_id: notification.id,
          provider: item.provider,
          transaction_type: item.transactionType,
          direction: item.direction,
          amount: item.amount,
          merchant: item.merchant,
          description: item.description,
          occurred_at: occurredAt,
          category_suggested: item.categorySuggested,
          cost_center_suggested: item.costCenterSuggested,
          bank_account_id: bankAccountId,
          raw_parse: { ...item.raw, classification_source: 'bank_statement_import' },
        })
        .select('id')
        .single();
      if (transactionError) throw new Error(`Falha ao importar "${item.description}": ${transactionError.message}`);

      await supabase.from('notifications').update({ target_id: transaction.id }).eq('id', notification.id);
      imported += 1;
    }

    return {
      totalRows: rows.length,
      imported,
      duplicates: plan.length - toImport.length,
      ignored: rows.length - plan.length,
    };
  },
};

export default bankStatementImportService;
