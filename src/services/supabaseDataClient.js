import { supabase } from './supabaseClient.js';

// Todas as entidades vivem numa única tabela `records` (id, entity, active, data jsonb).
// O objeto completo fica em `data`, preservando qualquer campo criado pelos formulários —
// mesma semântica flexível do localStorage, mas na nuvem.
const TABLE = 'records';
const IMPORT_CHUNK_SIZE = 200;

const createId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const toEntityRow = (row) => ({ ...row.data, id: row.id, active: row.active });

const throwIfError = (error, context) => {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
};

const PAYMENT_ERROR_MESSAGES = {
  PAYMENT_AUTH_REQUIRED: 'Sua sessao expirou. Entre novamente para registrar o pagamento.',
  PAYMENT_INVALID_PAYLOAD: 'Os dados do pagamento estao incompletos.',
  PAYMENT_INVALID_AMOUNT: 'Informe valores monetarios validos.',
  PAYMENT_NEGATIVE_AMOUNT: 'Pagamento, desconto, multa e juros nao podem ser negativos.',
  PAYMENT_INVALID_RECEIVABLE_BALANCE: 'O recebivel possui um saldo inconsistente e precisa ser revisado.',
  PAYMENT_EXCEEDS_OUTSTANDING: 'O valor pago nao pode ser maior que o saldo restante.',
  PAYMENT_INVALID_DATE: 'Informe uma data de pagamento valida.',
  PAYMENT_RECEIVABLE_NOT_FOUND: 'O recebivel nao existe, esta inativo ou voce nao tem permissao para acessa-lo.',
  PAYMENT_IDEMPOTENCY_CONFLICT: 'Este identificador de pagamento ja foi usado com dados diferentes. Atualize a tela e confira o historico.',
  PAYMENT_NEGATIVE_NET_VALUE: 'O desconto nao pode tornar o valor liquido do pagamento negativo.',
};

export const validatePaymentRpcResponse = (value) => {
  if (!value || typeof value !== 'object' || value.schema_version !== 1) {
    throw new Error('O banco retornou uma resposta de pagamento incompleta. Atualize a tela e confira o historico.');
  }
  if (!value.payment?.id || !value.receivable?.id || !value.receipt_number) {
    throw new Error('O pagamento nao foi confirmado de forma verificavel. Atualize a tela e confira o historico.');
  }
  if (value.payment.receipt_number !== value.receipt_number) {
    throw new Error('O recibo retornado pelo banco esta inconsistente. Atualize a tela e confira o historico.');
  }
  return value;
};

const throwPaymentError = (error) => {
  if (!error) return;
  const message = PAYMENT_ERROR_MESSAGES[error.message]
    || (/fetch|network/i.test(error.message || '')
      ? 'Nao foi possivel conectar ao banco. Nenhum pagamento foi confirmado.'
      : 'Nao foi possivel registrar o pagamento. Nenhuma confirmacao foi exibida.');
  const safeError = new Error(message);
  safeError.code = error.message || error.code || 'PAYMENT_UNKNOWN_ERROR';
  throw safeError;
};

const validateDb = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Backup inválido: o conteúdo precisa ser um objeto.');
  }

  Object.entries(value).forEach(([entity, rows]) => {
    if (!Array.isArray(rows)) {
      throw new Error(`Backup inválido: ${entity} precisa ser uma lista.`);
    }
  });
};

const deleteAllRows = async () => {
  const { error } = await supabase.from(TABLE).delete().not('id', 'is', null);
  throwIfError(error, 'Falha ao limpar a base remota');
};

export const supabaseDataClient = {
  async list(entity) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, active, data')
      .eq('entity', entity)
      .neq('active', false)
      .order('created_at', { ascending: true });

    throwIfError(error, `Falha ao listar ${entity}`);
    return (data || []).map(toEntityRow);
  },

  async create(entity, payload) {
    const value = { id: createId(), active: true, ...payload };
    const { error } = await supabase.from(TABLE).insert({
      id: String(value.id),
      entity,
      active: value.active !== false,
      data: value,
    });

    throwIfError(error, `Falha ao criar registro em ${entity}`);
    return value;
  },

  async update(entity, id, payload) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, data')
      .eq('entity', entity)
      .eq('id', String(id))
      .maybeSingle();

    throwIfError(error, `Falha ao buscar registro em ${entity}`);

    if (!data) {
      throw new Error(`Registro não encontrado em ${entity}: ${id}`);
    }

    const merged = { ...data.data, ...payload };
    const { error: updateError } = await supabase
      .from(TABLE)
      .update({
        data: merged,
        active: merged.active !== false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', String(id));

    throwIfError(updateError, `Falha ao atualizar registro em ${entity}`);
    return merged;
  },

  async removeSoft(entity, id) {
    return this.update(entity, id, { active: false });
  },

  async payReceivable(receivable, paymentPayload) {
    const paymentId = paymentPayload.payment_id || createId();
    const { payment_id: _paymentId, ...editablePaymentData } = paymentPayload;
    const { data, error } = await supabase.rpc('register_receivable_payment', {
      p_receivable_id: String(receivable.id),
      p_payment_id: String(paymentId),
      p_payment_data: editablePaymentData,
    });

    throwPaymentError(error);
    const result = validatePaymentRpcResponse(data);
    return {
      payment: result.payment,
      receivable: result.receivable,
      receiptNumber: result.receipt_number,
      outstandingValue: result.outstanding_value,
      idempotentReplay: result.idempotent_replay === true,
    };
  },

  async exportBackup() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, entity, active, data')
      .order('created_at', { ascending: true });

    throwIfError(error, 'Falha ao exportar backup');

    return (data || []).reduce((acc, row) => {
      if (!acc[row.entity]) acc[row.entity] = [];
      acc[row.entity].push(toEntityRow(row));
      return acc;
    }, {});
  },

  async importBackup(value) {
    validateDb(value);

    // Monta todas as linhas ANTES de tocar na base: se o arquivo estiver
    // malformado, a falha acontece sem apagar nada.
    const rows = Object.entries(value).flatMap(([entity, entityRows]) =>
      entityRows.map((row) => {
        const withId = { id: createId(), ...row };
        return {
          id: String(withId.id),
          entity,
          active: withId.active !== false,
          data: withId,
        };
      }),
    );

    // Snapshot dos dados atuais para restaurar caso a importação falhe no meio.
    const { data: snapshot, error: snapshotError } = await supabase
      .from(TABLE)
      .select('id, entity, active, data')
      .order('created_at', { ascending: true });

    throwIfError(snapshotError, 'Falha ao preparar a cópia de segurança antes da importação');

    const insertInChunks = async (list) => {
      for (let start = 0; start < list.length; start += IMPORT_CHUNK_SIZE) {
        const { error } = await supabase.from(TABLE).insert(list.slice(start, start + IMPORT_CHUNK_SIZE));
        throwIfError(error, 'Falha ao importar backup');
      }
    };

    await deleteAllRows();

    try {
      await insertInChunks(rows);
    } catch (importError) {
      let restored = false;

      try {
        await deleteAllRows();
        await insertInChunks(snapshot || []);
        restored = true;
      } catch {
        // restauração automática falhou; a orientação vai no erro abaixo
      }

      const detail = importError instanceof Error ? importError.message : String(importError);
      throw new Error(restored
        ? `A importação falhou e os dados anteriores foram restaurados automaticamente. Detalhe: ${detail}`
        : `A importação falhou e não foi possível restaurar automaticamente. Use o arquivo de segurança baixado antes da importação para recuperar os dados. Detalhe: ${detail}`);
    }

    return value;
  },

  async resetData() {
    await deleteAllRows();
    return {};
  },
};

export default supabaseDataClient;
