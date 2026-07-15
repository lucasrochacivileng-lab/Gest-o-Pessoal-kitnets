-- Pareia Pix de saida e entrada entre bancos proprios sem afetar resultado.
alter table public.transactions
  add column if not exists transfer_group_id uuid,
  add column if not exists is_transfer_primary boolean,
  add column if not exists destination_bank_account_id text;

create index if not exists transactions_transfer_group_idx
  on public.transactions (transfer_group_id)
  where transfer_group_id is not null;

alter table public.transactions
  drop constraint if exists transactions_transaction_type_check;

alter table public.transactions
  add constraint transactions_transaction_type_check
  check (transaction_type in ('purchase', 'pix_sent', 'pix_received', 'boleto_issued', 'internal_transfer'));

create or replace function public.confirm_internal_transfer(
  p_transaction_id uuid,
  p_source_account_id text,
  p_destination_account_id text
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
begin
  if not public.is_admin() then
    raise exception 'Sem permissao para confirmar transferencias internas';
  end if;

  if nullif(p_source_account_id, '') is null or nullif(p_destination_account_id, '') is null then
    raise exception 'Selecione as contas de origem e destino';
  end if;

  if p_source_account_id = p_destination_account_id then
    raise exception 'As contas de origem e destino devem ser diferentes';
  end if;

  select * into tx
  from public.transactions
  where id = p_transaction_id
    and transaction_type = 'internal_transfer'
    and is_transfer_primary is true
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Transferencia interna nao encontrada';
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
    raise exception 'Transferencia nao esta pendente';
  end if;

  if not exists (select 1 from public.records where id = p_source_account_id and entity = 'BankAccount' and active) then
    raise exception 'Conta de origem invalida';
  end if;

  if not exists (select 1 from public.records where id = p_destination_account_id and entity = 'BankAccount' and active) then
    raise exception 'Conta de destino invalida';
  end if;

  record_data := jsonb_build_object(
    'id', record_id,
    'active', true,
    'type', 'transferencia',
    'status', 'confirmado',
    'description', tx.description,
    'value', tx.amount,
    'date', to_char(tx.occurred_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
    'bank_account_id', p_source_account_id,
    'destination_account_id', p_destination_account_id,
    'financial_inbox_transfer_group_id', tx.transfer_group_id,
    'created_at', now(),
    'updated_at', now(),
    'created_by', auth.uid(),
    'updated_by', auth.uid()
  );

  insert into public.records (id, entity, active, data)
  values (record_id, 'BankMovement', true, record_data);

  update public.transactions
  set status = 'confirmed',
      bank_account_id = case when is_transfer_primary then p_source_account_id else bank_account_id end,
      destination_bank_account_id = p_destination_account_id,
      confirmed_record_entity = 'BankMovement',
      confirmed_record_id = record_id,
      confirmed_at = now(),
      updated_by = auth.uid()
  where transfer_group_id = tx.transfer_group_id;

  update public.notifications
  set status = 'confirmada', confirmed_at = now(), updated_by = auth.uid(), updated_at = now()
  where id in (
    select notification_id from public.transactions where transfer_group_id = tx.transfer_group_id
  );

  return jsonb_build_object(
    'success', true,
    'transaction_id', tx.id,
    'record_id', record_id,
    'record_entity', 'BankMovement',
    'already_confirmed', false
  );
end;
$$;

revoke execute on function public.confirm_internal_transfer(uuid, text, text) from public, anon;
grant execute on function public.confirm_internal_transfer(uuid, text, text) to authenticated;

create or replace function public.unpair_internal_transfer(p_transaction_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  tx public.transactions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Sem permissao para desfazer conciliacoes';
  end if;

  select * into tx
  from public.transactions
  where id = p_transaction_id
    and transaction_type = 'internal_transfer'
    and is_transfer_primary is true
    and status = 'pending'
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Transferencia interna pendente nao encontrada';
  end if;

  update public.transactions
  set transaction_type = case when direction = 'out' then 'pix_sent' else 'pix_received' end,
      description = coalesce(raw_parse ->> 'description', description),
      transfer_group_id = null,
      is_transfer_primary = null,
      updated_by = auth.uid()
  where transfer_group_id = tx.transfer_group_id;

  return jsonb_build_object('success', true, 'transaction_id', tx.id);
end;
$$;

revoke execute on function public.unpair_internal_transfer(uuid) from public, anon;
grant execute on function public.unpair_internal_transfer(uuid) to authenticated;

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
  where id = tx.id
    or (tx.transfer_group_id is not null and transfer_group_id = tx.transfer_group_id);

  update public.notifications
  set status = 'ignorada', updated_by = auth.uid(), updated_at = now()
  where id in (
    select notification_id from public.transactions
    where id = tx.id
      or (tx.transfer_group_id is not null and transfer_group_id = tx.transfer_group_id)
  );

  return jsonb_build_object('success', true, 'transaction_id', tx.id);
end;
$$;

revoke execute on function public.ignore_financial_inbox_transaction(uuid) from public, anon;
grant execute on function public.ignore_financial_inbox_transaction(uuid) to authenticated;
