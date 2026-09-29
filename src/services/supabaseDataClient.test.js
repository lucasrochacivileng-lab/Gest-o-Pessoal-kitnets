import { beforeEach, describe, expect, it, vi } from 'vitest';

// Banco falso em memória imitando a superfície do supabase-js usada pelo cliente.
const state = vi.hoisted(() => ({
  rows: [],
  insertCalls: 0,
  failInsertAt: null,
  rpcCalls: [],
  rpcError: null,
  rpcData: null,
  pageSize: 500,
}));

vi.mock('./supabaseClient.js', () => {
  const from = () => ({
    select() {
      let cursor = '';
      const builder = {
        eq: () => builder,
        neq: () => builder,
        order: () => builder,
        limit: () => builder,
        gt: (_key, value) => { cursor = value; return builder; },
        then: (resolve) => resolve({ data: state.rows.filter((row) => row.id > cursor).sort((a,b) => a.id.localeCompare(b.id)).slice(0, state.pageSize), error: null }),
        maybeSingle: async () => ({ data: state.rows[0] ? { ...state.rows[0] } : null, error: null }),
      };
      return builder;
    },
    insert: async (payload) => {
      state.insertCalls += 1;
      if (state.failInsertAt === state.insertCalls) {
        return { error: { message: 'falha simulada de rede' } };
      }
      const list = Array.isArray(payload) ? payload : [payload];
      state.rows.push(...list.map((row) => ({ ...row })));
      return { error: null };
    },
    delete: () => ({
      not: async () => {
        state.rows = [];
        return { error: null };
      },
    }),
  });

  return {
    supabase: {
      from,
      rpc: async (name, params) => {
        state.rpcCalls.push({ name, params });
        if (name === 'restore_application_backup') {
          if (state.rpcError) return { error: state.rpcError, data: null };
          state.rows = params.p_backup.database.records;
          return { data: { restored: true }, error: null };
        }
        return {
          data: state.rpcData || {
            schema_version: 1,
            payment: { ...params.p_payment_data, id: params.p_payment_id, receipt_number: '2026-0007' },
            receivable: { id: params.p_receivable_id, paid_value: 800, status: 'pago' },
            receipt_number: '2026-0007',
            outstanding_value: 0,
          },
          error: state.rpcError,
        };
      },
    },
    isSupabaseEnabled: true,
  };
});

import { supabaseDataClient } from './supabaseDataClient.js';

const seedRow = {
  id: 'antigo-1',
  entity: 'Kitnet',
  active: true,
  data: { id: 'antigo-1', name: 'Kitnet Antiga', active: true },
};

describe('supabaseDataClient.importBackup', () => {
  beforeEach(() => {
    state.rows = [{ ...seedRow }];
    state.insertCalls = 0;
    state.failInsertAt = null;
    state.rpcCalls = [];
    state.rpcError = null;
    state.rpcData = null;
    state.pageSize = 500;
  });

  it('substitui os dados pelos do backup quando a importação dá certo', async () => {
    await supabaseDataClient.importBackup({ Tenant: [{ id: 'novo-1', name: 'Novo Locatário' }] }, { expectedRevision: 'snapshot' });

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].entity).toBe('Tenant');
    expect(state.rows[0].data.name).toBe('Novo Locatário');
  });

  it('usa uma RPC transacional e não apaga dados pelo cliente em caso de falha', async () => {
    state.rpcError = { message: 'A base mudou desde a cópia de segurança.' };

    await expect(supabaseDataClient.importBackup({ Tenant: [{ id: 'novo-1', name: 'Novo Locatário' }] }, { expectedRevision: 'snapshot' }))
      .rejects.toThrow(/base mudou/);

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].id).toBe('antigo-1');
    expect(state.rows[0].data.name).toBe('Kitnet Antiga');
    expect(state.insertCalls).toBe(0);
  });

  it('rejeita arquivo malformado sem apagar nada', async () => {
    await expect(supabaseDataClient.importBackup({ Tenant: 'não é uma lista' }))
      .rejects.toThrow(/precisa ser uma lista/);

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].id).toBe('antigo-1');
  });

  it('lista mais de mil registros mesmo com limite menor imposto pelo servidor', async () => {
    state.pageSize = 113;
    state.rows = Array.from({ length: 1234 }, (_, i) => ({ id: String(i).padStart(5, '0'), active: true, data: { name: `Item ${i}` } }));
    const result = await supabaseDataClient.list('Kitnet');
    expect(result).toHaveLength(1234);
    expect(new Set(result.map((row) => row.id)).size).toBe(1234);
  });

  it('bloqueia reset remoto e backup sem IDs antes de qualquer escrita', async () => {
    await expect(supabaseDataClient.resetData()).rejects.toThrow(/não pode apagar/);
    await expect(supabaseDataClient.importBackup({ Tenant: [{ name: 'Sem ID' }] })).rejects.toThrow(/sem ID/);
    expect(state.rpcCalls).toHaveLength(0);
    expect(state.rows[0].id).toBe('antigo-1');
  });

  it('registra pagamento pelo RPC atomico e usa o recibo gerado no banco', async () => {
    const result = await supabaseDataClient.payReceivable(
      { id: 'recebivel-1' },
      { paid_value: 800, payment_date: '2026-07-12' },
    );

    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0].name).toBe('register_receivable_payment');
    expect(state.rpcCalls[0].params.p_receivable_id).toBe('recebivel-1');
    expect(result.receiptNumber).toBe('2026-0007');
    expect(result.receivable.status).toBe('pago');
  });

  it('rejeita resposta incompleta da RPC em vez de exibir falso sucesso', async () => {
    state.rpcData = { schema_version: 1, payment: { id: 'p1' } };

    await expect(supabaseDataClient.payReceivable(
      { id: 'recebivel-1' },
      { paid_value: 800 },
    )).rejects.toThrow(/resposta de pagamento incompleta|nao foi confirmado/i);
  });

  it('traduz erro de pagamento acima do saldo sem expor SQL', async () => {
    state.rpcError = { message: 'PAYMENT_EXCEEDS_OUTSTANDING', code: '22023' };

    await expect(supabaseDataClient.payReceivable(
      { id: 'recebivel-1' },
      { paid_value: 900 },
    )).rejects.toThrow('O valor pago nao pode ser maior que o saldo restante.');
  });

  it('informa replay idempotente retornado pelo banco', async () => {
    state.rpcData = {
      schema_version: 1,
      payment: { id: 'p-retry', receipt_number: '2026-0008' },
      receivable: { id: 'recebivel-1', paid_value: 100, status: 'parcial' },
      receipt_number: '2026-0008',
      outstanding_value: 700,
      idempotent_replay: true,
    };

    const result = await supabaseDataClient.payReceivable(
      { id: 'recebivel-1' },
      { paid_value: 100 },
    );

    expect(result.idempotentReplay).toBe(true);
    expect(result.receiptNumber).toBe('2026-0008');
  });

  it('reutiliza a chave de idempotencia e nao a inclui nos dados editaveis', async () => {
    await supabaseDataClient.payReceivable(
      { id: 'recebivel-1' },
      { payment_id: 'retry-estavel-1', paid_value: 100 },
    );

    expect(state.rpcCalls[0].params.p_payment_id).toBe('retry-estavel-1');
    expect(state.rpcCalls[0].params.p_payment_data.payment_id).toBeUndefined();
  });
});
