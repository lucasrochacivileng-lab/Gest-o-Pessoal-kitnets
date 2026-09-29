import { supabase } from './supabaseClient.js';
import { paymentSnapshot, validatePayment } from './financialMutations.js';
import { exportRemoteBackup, importRemoteBackup } from './remoteBackupService.js';

// Todas as entidades vivem numa única tabela `records` (id, entity, active, data jsonb).
// O objeto completo fica em `data`, preservando qualquer campo criado pelos formulários —
// mesma semântica flexível do localStorage, mas na nuvem.
const TABLE = 'records';


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
      ? 'A conexão falhou. Confira o histórico antes de repetir; o pagamento pode ter sido salvo.'
      : 'Nao foi possivel registrar o pagamento. Nenhuma confirmacao foi exibida.');
  const safeError = new Error(message);
  safeError.code = error.message || error.code || 'PAYMENT_UNKNOWN_ERROR';
  throw safeError;
};

export const supabaseDataClient = {
  async list(entity) {
    const rows = [];
    let cursor = null;
    // Cursor estável; continua até página vazia, mesmo se o servidor limitar a menos de 500.
    while (true) {
      let query = supabase.from(TABLE).select('id, active, data').eq('entity', entity)
        .neq('active', false).order('id', { ascending: true }).limit(500);
      if (cursor) query = query.gt('id', cursor);
      const { data, error } = await query;
      throwIfError(error, `Falha ao listar ${entity}`);
      if (!data?.length) break;
      const next = data[data.length - 1].id;
      if (next === cursor) throw new Error('A paginação não avançou. Tente recarregar.');
      rows.push(...data.map(toEntityRow));
      cursor = next;
    }
    return rows;
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

  async correctPayment(payment, values) {
    const validated = validatePayment({ ...payment, ...values });
    const { data, error } = await supabase.rpc('amend_receivable_payment', {
      p_payment_id: payment.id, p_values: paymentSnapshot(validated),
      p_previous: paymentSnapshot(payment), p_reverse: false,
      p_justification: values.justification || 'Correção pela tela de pagamentos',
    });
    if (error) throw new Error('Não foi possível corrigir o pagamento: ' + error.message);
    if (!data?.payment?.id) throw new Error('Correção não confirmada. Atualize a tela.');
    return data;
  },
  async reversePayment(payment, justification) {
    const { data, error } = await supabase.rpc('amend_receivable_payment', {
      p_payment_id: payment.id, p_values: {}, p_previous: paymentSnapshot(payment),
      p_reverse: true, p_justification: justification || 'Estorno pela tela de pagamentos',
    });
    if (error) throw new Error('Não foi possível estornar: ' + error.message);
    if (!data?.payment?.id) throw new Error('Estorno não confirmado. Atualize a tela.');
    return data;
  },
  async terminateContract(contractId, { exitDate, launchFine }) {
    const { data, error } = await supabase.rpc('terminate_rental_contract', {
      p_contract_id: contractId, p_exit_date: exitDate, p_launch_fine: launchFine,
    });
    if (error) throw new Error('Não foi possível encerrar o contrato: ' + error.message);
    if (!data || !Number.isInteger(data.canceledReceivables)) throw new Error('Encerramento não confirmado. Atualize a tela.');
    return data;
  },
  exportBackup: exportRemoteBackup,
  importBackup: importRemoteBackup,
  async resetData() {
    throw new Error('O reset local não pode apagar dados do Supabase.');
  },
};
export default supabaseDataClient;
