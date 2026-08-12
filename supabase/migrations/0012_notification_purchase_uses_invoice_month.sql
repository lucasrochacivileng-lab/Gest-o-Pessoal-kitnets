-- Compra capturada por notificacao passa a nascer no MES DA FATURA, igual a
-- compra que vem da importacao. Antes ela ficava no mes da COMPRA: a mesma
-- pizza aparecia em junho enquanto so a notificacao existia e PULAVA para julho
-- quando a fatura era importada (o casamento substitui uma pela outra), sem o
-- usuario fazer nada. Agora a data da compra fica em 'purchase_date' (que e o
-- que o casamento notificacao x fatura usa) e 'date' guarda o vencimento.
-- Sem ciclo cadastrado no cartao, card_invoice_due_date devolve null e o
-- coalesce mantem o comportamento antigo.
create or replace function public.confirm_financial_inbox_transaction(
  p_transaction_id uuid,
  p_category text,
  p_cost_center text,
  p_bank_account_id text default null::text,
  p_credit_card_id text default null::text,
  p_due_date date default null::date
)
returns jsonb
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  tx public.transactions%rowtype;
  record_id text := gen_random_uuid()::text;
  record_data jsonb;
  record_type text;
  record_status text;
  record_date date;
  purchase_date date;
  card_name text;
begin
  if not public.is_admin() then
    raise exception 'Sem permissao para confirmar movimentacoes financeiras';
  end if;

  select * into tx
  from public.transactions
  where id = p_transaction_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Movimentacao nao encontrada';
  end if;

  if tx.status = 'confirmed' then
    return jsonb_build_object(
      'success', true,
      'transaction_id', tx.id,
      'record_id', tx.confirmed_record_id,
      'already_confirmed', true
    );
  end if;

  if tx.status <> 'pending' then
    raise exception 'Movimentacao nao esta pendente';
  end if;

  if tx.transaction_type in ('pix_sent', 'pix_received') and nullif(p_bank_account_id, '') is null then
    raise exception 'Selecione a conta bancaria do Pix';
  end if;

  if tx.transaction_type = 'purchase' and nullif(p_credit_card_id, '') is not null then
    select data ->> 'name' into card_name
    from public.records
    where id = p_credit_card_id and entity = 'CreditCard' and active;
  end if;

  record_type := case
    when tx.transaction_type = 'purchase' then 'card_transaction'
    when tx.transaction_type = 'pix_received' then 'income'
    else 'expense'
  end;
  record_status := case
    when tx.transaction_type = 'purchase' then 'revisado'
    when tx.transaction_type = 'pix_received' then 'recebido'
    when tx.transaction_type = 'boleto_issued' then 'previsto'
    else 'pago'
  end;

  -- Dia em que a compra foi feita (a notificacao chega na hora).
  purchase_date := (tx.occurred_at at time zone 'America/Sao_Paulo')::date;

  record_date := case
    when tx.transaction_type = 'boleto_issued' then coalesce(p_due_date, tx.due_date, purchase_date)
    -- Compra no cartao: a data do lancamento e o VENCIMENTO DA FATURA em que
    -- ela cai (e quando o dinheiro sai), nao o dia da compra.
    when tx.transaction_type = 'purchase' then coalesce(
      public.card_invoice_due_date(nullif(p_credit_card_id, ''), purchase_date),
      purchase_date
    )
    else purchase_date
  end;

  record_data := jsonb_strip_nulls(jsonb_build_object(
    'id', record_id,
    'active', true,
    'type', record_type,
    'status', record_status,
    'description', tx.description,
    'value', tx.amount,
    'date', to_char(record_date, 'YYYY-MM-DD'),
    -- So para compra: e o que casa a notificacao com a linha da fatura depois.
    'purchase_date', case when tx.transaction_type = 'purchase' then to_char(purchase_date, 'YYYY-MM-DD') end,
    'due_date', case when tx.transaction_type = 'boleto_issued' then to_char(record_date, 'YYYY-MM-DD') end,
    'category', coalesce(nullif(p_category, ''), tx.category_suggested, 'outros'),
    'segment', coalesce(nullif(p_cost_center, ''), tx.cost_center_suggested, 'pessoal'),
    'context', coalesce(nullif(p_cost_center, ''), tx.cost_center_suggested, 'pessoal'),
    'origin', case when tx.transaction_type = 'purchase' then 'cartao' else coalesce(nullif(p_cost_center, ''), tx.cost_center_suggested, 'pessoal') end,
    'payment_method', case
      when tx.transaction_type like 'pix_%' then 'pix'
      when tx.transaction_type = 'boleto_issued' then 'boleto'
      else 'cartao'
    end,
    'bank_account_id', nullif(p_bank_account_id, ''),
    'card_id', nullif(p_credit_card_id, ''),
    'card_name', card_name,
    'financial_inbox_transaction_id', tx.id,
    'source_notification_id', tx.notification_id,
    'created_at', now(),
    'updated_at', now(),
    'created_by', auth.uid(),
    'updated_by', auth.uid()
  ));

  insert into public.records (id, entity, active, data)
  values (record_id, 'PersonalIncome', true, record_data);

  update public.transactions
  set status = 'confirmed',
      due_date = case when tx.transaction_type = 'boleto_issued' then record_date else due_date end,
      category_confirmed = coalesce(nullif(p_category, ''), category_suggested, 'outros'),
      cost_center_confirmed = coalesce(nullif(p_cost_center, ''), cost_center_suggested, 'pessoal'),
      bank_account_id = nullif(p_bank_account_id, ''),
      credit_card_id = nullif(p_credit_card_id, ''),
      confirmed_record_entity = 'PersonalIncome',
      confirmed_record_id = record_id,
      confirmed_at = now(),
      updated_by = auth.uid()
  where id = tx.id;

  update public.notifications
  set status = 'confirmada', confirmed_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = tx.notification_id;

  return jsonb_build_object(
    'success', true,
    'transaction_id', tx.id,
    'record_id', record_id,
    'record_entity', 'PersonalIncome',
    'already_confirmed', false
  );
end;
$function$;
