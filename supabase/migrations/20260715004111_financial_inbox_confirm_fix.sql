-- Caixa de entrada financeira alimentada por notificacoes do celular.
-- A tabela notifications ja existia; os novos campos sao opcionais para
-- preservar os alertas de aluguel/contrato gravados anteriormente.

alter table public.notifications
  add column if not exists source text,
  add column if not exists package_name text,
  add column if not exists raw_title text,
  add column if not exists raw_text text,
  add column if not exists received_at timestamptz,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists parser_name text,
  add column if not exists parse_status text,
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_uidx
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  provider text not null default 'nubank',
  transaction_type text not null check (transaction_type in ('purchase', 'pix_sent', 'pix_received')),
  direction text not null check (direction in ('in', 'out')),
  amount numeric(14,2) not null check (amount > 0),
  merchant text,
  description text not null,
  occurred_at timestamptz not null,
  category_suggested text,
  cost_center_suggested text,
  category_confirmed text,
  cost_center_confirmed text,
  bank_account_id text,
  credit_card_id text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'ignored', 'error')),
  confirmed_record_entity text,
  confirmed_record_id text,
  raw_parse jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  deleted_at timestamptz
);

create index if not exists transactions_owner_status_occurred_idx
  on public.transactions (owner_id, status, occurred_at desc)
  where deleted_at is null;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

drop policy if exists transactions_admin_access on public.transactions;
create policy transactions_admin_access
  on public.transactions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- A caixa financeira e privada do administrador. Os alertas operacionais de
-- kitnets continuam disponiveis para o perfil KITNET_MANAGER.
drop policy if exists "notifications kitnet access" on public.notifications;
create policy "notifications kitnet access"
  on public.notifications
  for all
  to authenticated
  using (
    public.is_admin()
    or (public.can_manage_kitnets() and target_entity <> 'financial_inbox')
  )
  with check (
    public.is_admin()
    or (public.can_manage_kitnets() and target_entity <> 'financial_inbox')
  );

revoke all privileges on table public.transactions from anon;
grant select, update on table public.transactions to authenticated;

create or replace function public.confirm_financial_inbox_transaction(
  p_transaction_id uuid,
  p_category text,
  p_cost_center text,
  p_bank_account_id text default null,
  p_credit_card_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  tx public.transactions%rowtype;
  record_id text := gen_random_uuid()::text;
  record_data jsonb;
  record_type text;
  record_status text;
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
    else 'pago'
  end;

  record_data := jsonb_strip_nulls(jsonb_build_object(
    'id', record_id,
    'active', true,
    'type', record_type,
    'status', record_status,
    'description', tx.description,
    'value', tx.amount,
    'date', to_char(tx.occurred_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
    'category', coalesce(nullif(p_category, ''), tx.category_suggested, 'outros'),
    'segment', coalesce(nullif(p_cost_center, ''), tx.cost_center_suggested, 'pessoal'),
    'context', coalesce(nullif(p_cost_center, ''), tx.cost_center_suggested, 'pessoal'),
    'origin', case when tx.transaction_type = 'purchase' then 'cartao' else coalesce(nullif(p_cost_center, ''), tx.cost_center_suggested, 'pessoal') end,
    'payment_method', case when tx.transaction_type like 'pix_%' then 'pix' else 'cartao' end,
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
$$;

revoke execute on function public.confirm_financial_inbox_transaction(uuid, text, text, text, text) from public, anon;
grant execute on function public.confirm_financial_inbox_transaction(uuid, text, text, text, text) to authenticated;

create or replace function public.ignore_financial_inbox_transaction(p_transaction_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  tx public.transactions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Sem permissao para ignorar movimentacoes financeiras';
  end if;

  select * into tx
  from public.transactions
  where id = p_transaction_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Movimentacao nao encontrada';
  end if;

  if tx.status = 'confirmed' then
    raise exception 'Movimentacao confirmada nao pode ser ignorada';
  end if;

  update public.transactions
  set status = 'ignored', updated_by = auth.uid()
  where id = tx.id;

  update public.notifications
  set status = 'ignorada', updated_by = auth.uid(), updated_at = now()
  where id = tx.notification_id;

  return jsonb_build_object('success', true, 'transaction_id', tx.id);
end;
$$;

revoke execute on function public.ignore_financial_inbox_transaction(uuid) from public, anon;
grant execute on function public.ignore_financial_inbox_transaction(uuid) to authenticated;
