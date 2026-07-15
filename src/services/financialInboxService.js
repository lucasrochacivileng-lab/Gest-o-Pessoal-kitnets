import { isSupabaseEnabled, supabase } from './supabaseClient.js';

const emptyInbox = { transactions: [], unrecognized: [] };

const throwIfError = (error, context) => {
  if (error) throw new Error(`${context}: ${error.message}`);
};

export const financialInboxService = {
  async list() {
    if (!isSupabaseEnabled || !supabase) return emptyInbox;

    const [transactionsResult, notificationsResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, notification:notifications(id, raw_title, raw_text, package_name, received_at, parse_status)')
        .is('deleted_at', null)
        .order('occurred_at', { ascending: false }),
      supabase
        .from('notifications')
        .select('id, raw_title, raw_text, package_name, received_at, parse_status, status')
        .eq('source', 'macrodroid')
        .eq('parse_status', 'unrecognized')
        .eq('status', 'pendente')
        .order('received_at', { ascending: false }),
    ]);

    throwIfError(transactionsResult.error, 'Falha ao carregar movimentações capturadas');
    throwIfError(notificationsResult.error, 'Falha ao carregar notificações não reconhecidas');

    return {
      transactions: transactionsResult.data || [],
      unrecognized: notificationsResult.data || [],
    };
  },

  async confirm(transactionId, values) {
    if (!isSupabaseEnabled || !supabase) throw new Error('A confirmação exige conexão com o Supabase.');

    const { data, error } = await supabase.rpc('confirm_financial_inbox_transaction', {
      p_transaction_id: transactionId,
      p_category: values.category || '',
      p_cost_center: values.costCenter || '',
      p_bank_account_id: values.bankAccountId || null,
      p_credit_card_id: values.creditCardId || null,
    });

    throwIfError(error, 'Falha ao confirmar movimentação');
    return data;
  },

  async ignore(transactionId) {
    if (!isSupabaseEnabled || !supabase) throw new Error('A ação exige conexão com o Supabase.');
    const { data, error } = await supabase.rpc('ignore_financial_inbox_transaction', {
      p_transaction_id: transactionId,
    });
    throwIfError(error, 'Falha ao ignorar movimentação');
    return data;
  },

  async ignoreNotification(notificationId) {
    if (!isSupabaseEnabled || !supabase) throw new Error('A ação exige conexão com o Supabase.');
    const { error } = await supabase
      .from('notifications')
      .update({ status: 'ignorada', updated_at: new Date().toISOString() })
      .eq('id', notificationId);
    throwIfError(error, 'Falha ao ignorar notificação');
  },
};

export default financialInboxService;

