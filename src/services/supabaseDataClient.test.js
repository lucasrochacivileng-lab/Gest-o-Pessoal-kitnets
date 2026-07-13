import { beforeEach, describe, expect, it, vi } from 'vitest';

// Banco falso em memória imitando a superfície do supabase-js usada pelo cliente.
const state = vi.hoisted(() => ({
  rows: [],
  insertCalls: 0,
  failInsertAt: null,
  rpcCalls: [],
}));

vi.mock('./supabaseClient.js', () => {
  const from = () => ({
    select() {
      const builder = {
        eq: () => builder,
        neq: () => builder,
        order: async () => ({ data: state.rows.map((row) => ({ ...row })), error: null }),
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
        return {
          data: {
            payment: { ...params.p_payment_data, receipt_number: '2026-0007' },
            receivable: { id: params.p_receivable_id, paid_value: 800, status: 'pago' },
            receipt_number: '2026-0007',
          },
          error: null,
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
  });

  it('substitui os dados pelos do backup quando a importação dá certo', async () => {
    await supabaseDataClient.importBackup({ Tenant: [{ name: 'Novo Locatário' }] });

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].entity).toBe('Tenant');
    expect(state.rows[0].data.name).toBe('Novo Locatário');
  });

  it('restaura os dados anteriores quando a importação falha no meio', async () => {
    state.failInsertAt = 1; // primeira inserção (o backup novo) falha

    await expect(supabaseDataClient.importBackup({ Tenant: [{ name: 'Novo Locatário' }] }))
      .rejects.toThrow(/restaurados automaticamente/);

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].id).toBe('antigo-1');
    expect(state.rows[0].data.name).toBe('Kitnet Antiga');
  });

  it('rejeita arquivo malformado sem apagar nada', async () => {
    await expect(supabaseDataClient.importBackup({ Tenant: 'não é uma lista' }))
      .rejects.toThrow(/precisa ser uma lista/);

    expect(state.rows).toHaveLength(1);
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
});
