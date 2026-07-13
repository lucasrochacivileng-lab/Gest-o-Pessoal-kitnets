-- Endurece o fluxo financeiro sem alterar dados existentes.
-- Esta migration substitui a funcao de 0004 mantendo a mesma assinatura.

alter function public.current_app_role() set search_path = pg_catalog, public;
alter function public.is_admin() set search_path = pg_catalog, public;
alter function public.can_manage_kitnets() set search_path = pg_catalog, public;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- RLS limita linhas, mas nao limita colunas. Sem estes grants um usuario
-- poderia usar a policy de perfil proprio para trocar role/active.
revoke all on table public.profiles from anon;
revoke insert, update, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (name, avatar_url) on table public.profiles to authenticated;

create or replace function public.admin_update_profile_access(
  p_user_id uuid,
  p_role public.app_role,
  p_active boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.profiles;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using message = 'PROFILE_ADMIN_REQUIRED', errcode = '42501';
  end if;
  if p_user_id is null or p_role is null or p_active is null then
    raise exception using message = 'PROFILE_INVALID_ACCESS_DATA', errcode = '22023';
  end if;

  update public.profiles
  set role = p_role,
      active = p_active,
      updated_by = auth.uid(),
      updated_at = clock_timestamp()
  where id = p_user_id and deleted_at is null
  returning * into updated_profile;

  if not found then
    raise exception using message = 'PROFILE_NOT_FOUND', errcode = 'P0002';
  end if;
  return updated_profile;
end;
$$;

revoke execute on function public.admin_update_profile_access(uuid, public.app_role, boolean) from public, anon;
grant execute on function public.admin_update_profile_access(uuid, public.app_role, boolean) to authenticated;

drop index if exists public.records_receivable_contract_competence_uidx;

create unique index records_receivable_contract_competence_uidx
  on public.records ((data ->> 'contract_id'), (data ->> 'competence'))
  where entity = 'Receivable'
    and active
    and coalesce(data ->> 'status', '') not in ('cancelado', 'cancelled')
    and nullif(data ->> 'contract_id', '') is not null
    and nullif(data ->> 'competence', '') is not null;

create unique index records_payment_receipt_number_uidx
  on public.records ((data ->> 'receipt_number'))
  where entity = 'Payment'
    and nullif(data ->> 'receipt_number', '') is not null;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  occurred_at timestamptz not null default clock_timestamp(),
  entity text not null,
  entity_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  origin text not null default 'data_api',
  justification text
);

create index if not exists audit_log_entity_idx
  on public.audit_log (entity, entity_id, occurred_at desc);
create index if not exists audit_log_actor_idx
  on public.audit_log (actor_id, occurred_at desc);

alter table public.audit_log enable row level security;

drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read
  on public.audit_log
  for select
  to authenticated
  using (public.is_admin());

revoke all on table public.audit_log from public, anon, authenticated;
grant select on table public.audit_log to authenticated;

create or replace function public.stamp_record_actor()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  actor text := auth.uid()::text;
  audit_origin text;
  audit_justification text;
begin
  if actor is not null then
    if tg_op = 'INSERT' then
      new.data := jsonb_set(new.data, '{created_by}', to_jsonb(actor), true);
    elsif old.data ? 'created_by' then
      new.data := jsonb_set(new.data, '{created_by}', old.data -> 'created_by', true);
    else
      new.data := new.data - 'created_by';
    end if;
    new.data := jsonb_set(new.data, '{updated_by}', to_jsonb(actor), true);
  end if;

  audit_origin := case current_setting('app.audit_scope', true)
    when 'register_receivable_payment' then 'register_receivable_payment'
    else 'data_api'
  end;
  audit_justification := left(btrim(coalesce(
    nullif(current_setting('app.audit_justification_internal', true), ''),
    new.data ->> 'audit_justification',
    ''
  )), 500);

  perform set_config('app.audit_origin', audit_origin, true);
  perform set_config('app.audit_justification', audit_justification, true);
  new.data := new.data - 'audit_origin' - 'audit_justification';
  return new;
end;
$$;

create or replace function public.write_record_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  safe_before jsonb;
  safe_after jsonb;
  omitted_fields text[] := array[
    'notes', 'document_number', 'document_path', 'inspection_report_path',
    'email', 'phone', 'whatsapp', 'attachment', 'file', 'content'
  ];
begin
  if coalesce(new.entity, old.entity) not in ('Payment', 'Receivable', 'Contract', 'Expense') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    audit_action := 'create';
  elsif tg_op = 'DELETE' then
    audit_action := 'delete';
  elsif old.active and not new.active then
    audit_action := 'soft_delete';
  elsif coalesce(new.data ->> 'status', '') in ('cancelado', 'cancelled')
      and coalesce(old.data ->> 'status', '') not in ('cancelado', 'cancelled') then
    audit_action := 'cancel';
  elsif coalesce(new.data ->> 'status', '') in ('estornado', 'reversed')
      and coalesce(old.data ->> 'status', '') not in ('estornado', 'reversed') then
    audit_action := 'reverse';
  else
    audit_action := 'update';
  end if;

  safe_before := case when tg_op = 'INSERT' then null else old.data - omitted_fields end;
  safe_after := case when tg_op = 'DELETE' then null else new.data - omitted_fields end;

  insert into public.audit_log (
    actor_id, entity, entity_id, action, before_data, after_data, origin, justification
  ) values (
    auth.uid(),
    coalesce(new.entity, old.entity),
    coalesce(new.id, old.id),
    audit_action,
    safe_before,
    safe_after,
    coalesce(nullif(current_setting('app.audit_origin', true), ''), 'data_api'),
    nullif(current_setting('app.audit_justification', true), '')
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists records_10_stamp_actor on public.records;
create trigger records_10_stamp_actor
  before insert or update on public.records
  for each row execute function public.stamp_record_actor();

drop trigger if exists records_90_audit on public.records;
create trigger records_90_audit
  after insert or update or delete on public.records
  for each row execute function public.write_record_audit();

revoke execute on function public.stamp_record_actor() from public, anon, authenticated;
revoke execute on function public.write_record_audit() from public, anon, authenticated;

create or replace function public.register_receivable_payment(
  p_receivable_id text,
  p_payment_id text,
  p_payment_data jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  receivable_row public.records%rowtype;
  existing_payment_row public.records%rowtype;
  payment_data jsonb;
  updated_receivable_data jsonb;
  payment_date date;
  receipt_year text;
  receipt_sequence integer;
  receipt_number text;
  paid_cents bigint;
  discount_cents bigint;
  fine_cents bigint;
  interest_cents bigint;
  net_cents bigint;
  current_paid_cents bigint;
  total_paid_cents bigint;
  expected_cents bigint;
  outstanding_cents bigint;
  new_status text;
  destination_account text;
  payment_method text;
  bank_account_id text;
begin
  if auth.uid() is null then
    raise exception using message = 'PAYMENT_AUTH_REQUIRED', errcode = '42501';
  end if;
  if p_payment_id is null or btrim(p_payment_id) = '' or p_payment_data is null
      or jsonb_typeof(p_payment_data) <> 'object' then
    raise exception using message = 'PAYMENT_INVALID_PAYLOAD', errcode = '22023';
  end if;

  -- Serializa retries do mesmo identificador, inclusive quando duas chamadas
  -- chegam antes de a primeira inserir a linha de Payment.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('payment-id-' || p_payment_id));

  select * into receivable_row
  from public.records
  where id = p_receivable_id and entity = 'Receivable' and active
    and coalesce(data ->> 'status', '') not in ('cancelado', 'cancelled')
  for update;

  if not found then
    raise exception using message = 'PAYMENT_RECEIVABLE_NOT_FOUND', errcode = 'P0002';
  end if;

  begin
    discount_cents := round(coalesce((p_payment_data ->> 'discount')::numeric, 0) * 100);
    fine_cents := round(coalesce((p_payment_data ->> 'fine')::numeric, 0) * 100);
    interest_cents := round(coalesce((p_payment_data ->> 'interest')::numeric, 0) * 100);
    current_paid_cents := round(coalesce((receivable_row.data ->> 'paid_value')::numeric, 0) * 100);
    expected_cents := round(coalesce((receivable_row.data ->> 'expected_value')::numeric, 0) * 100);
    paid_cents := case
      when p_payment_data ? 'paid_value'
        then round(coalesce((p_payment_data ->> 'paid_value')::numeric, 0) * 100)
      else greatest(expected_cents - current_paid_cents, 0)
    end;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using message = 'PAYMENT_INVALID_AMOUNT', errcode = '22003';
  end;

  if paid_cents < 0 or discount_cents < 0 or fine_cents < 0 or interest_cents < 0 then
    raise exception using message = 'PAYMENT_NEGATIVE_AMOUNT', errcode = '22023';
  end if;
  if expected_cents < 0 or current_paid_cents < 0 then
    raise exception using message = 'PAYMENT_INVALID_RECEIVABLE_BALANCE', errcode = '22023';
  end if;

  outstanding_cents := greatest(expected_cents - current_paid_cents, 0);
  if paid_cents > outstanding_cents then
    raise exception using message = 'PAYMENT_EXCEEDS_OUTSTANDING', errcode = '22023';
  end if;

  begin
    payment_date := coalesce(nullif(p_payment_data ->> 'payment_date', '')::date, current_date);
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception using message = 'PAYMENT_INVALID_DATE', errcode = '22007';
  end;

  total_paid_cents := current_paid_cents + paid_cents;
  net_cents := paid_cents - discount_cents + fine_cents + interest_cents;
  if net_cents < 0 then
    raise exception using message = 'PAYMENT_NEGATIVE_NET_VALUE', errcode = '22023';
  end if;
  new_status := case when total_paid_cents >= expected_cents then 'pago' else 'parcial' end;
  receipt_year := to_char(payment_date, 'YYYY');
  destination_account := coalesce(
    nullif(btrim(p_payment_data ->> 'destination_account'), ''),
    nullif(btrim(receivable_row.data ->> 'destination_account'), ''),
    'Mercado Pago'
  );
  payment_method := coalesce(nullif(btrim(p_payment_data ->> 'payment_method'), ''), 'pix');
  bank_account_id := nullif(btrim(p_payment_data ->> 'bank_account_id'), '');

  select * into existing_payment_row
  from public.records
  where id = p_payment_id
  for update;

  if found then
    if existing_payment_row.entity <> 'Payment'
        or not existing_payment_row.active
        or existing_payment_row.data ->> 'receivable_id' <> p_receivable_id
        or round(coalesce((existing_payment_row.data ->> 'paid_value')::numeric, 0) * 100) <> paid_cents
        or round(coalesce((existing_payment_row.data ->> 'discount')::numeric, 0) * 100) <> discount_cents
        or round(coalesce((existing_payment_row.data ->> 'fine')::numeric, 0) * 100) <> fine_cents
        or round(coalesce((existing_payment_row.data ->> 'interest')::numeric, 0) * 100) <> interest_cents
        or coalesce(existing_payment_row.data ->> 'payment_date', '') <> payment_date::text
        or coalesce(existing_payment_row.data ->> 'payment_method', 'pix') <> payment_method
        or coalesce(existing_payment_row.data ->> 'destination_account', 'Mercado Pago') <> destination_account
        or coalesce(existing_payment_row.data ->> 'bank_account_id', '') <> coalesce(bank_account_id, '') then
      raise exception using message = 'PAYMENT_IDEMPOTENCY_CONFLICT', errcode = '23505';
    end if;

    return jsonb_build_object(
      'schema_version', 1,
      'payment', existing_payment_row.data,
      'receivable', receivable_row.data,
      'receipt_number', existing_payment_row.data ->> 'receipt_number',
      'outstanding_value', outstanding_cents::numeric / 100,
      'idempotent_replay', true
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('payment-receipt-' || receipt_year));
  select coalesce(max((substring(data ->> 'receipt_number' from '^[0-9]{4}-([0-9]+)$'))::integer), 0) + 1
    into receipt_sequence
  from public.records
  where entity = 'Payment'
    and data ->> 'receipt_number' like receipt_year || '-%';

  receipt_number := receipt_year || '-' || lpad(receipt_sequence::text, 4, '0');
  perform set_config('app.audit_scope', 'register_receivable_payment', true);
  perform set_config(
    'app.audit_justification_internal',
    left(btrim(coalesce(p_payment_data ->> 'justification', p_payment_data ->> 'audit_justification', '')), 500),
    true
  );

  payment_data := (p_payment_data - array[
      'status', 'receipt_number', 'created_by', 'updated_by', 'net_value',
      'receivable_id', 'contract_id', 'kitnet_id', 'tenant_id', 'competence',
      'project_id', 'expert_report_id', 'segment', 'audit_origin',
      'audit_justification', 'justification'
    ])
    || jsonb_build_object(
      'id', p_payment_id,
      'active', true,
      'receivable_id', p_receivable_id,
      'contract_id', receivable_row.data ->> 'contract_id',
      'kitnet_id', receivable_row.data ->> 'kitnet_id',
      'tenant_id', receivable_row.data ->> 'tenant_id',
      'competence', receivable_row.data ->> 'competence',
      'paid_value', paid_cents::numeric / 100,
      'discount', discount_cents::numeric / 100,
      'fine', fine_cents::numeric / 100,
      'interest', interest_cents::numeric / 100,
      'net_value', net_cents::numeric / 100,
      'payment_date', payment_date::text,
      'payment_method', payment_method,
      'destination_account', destination_account,
      'bank_account_id', bank_account_id,
      'receipt_number', receipt_number,
      'status', new_status,
      'created_by', auth.uid()::text,
      'updated_by', auth.uid()::text,
      'created_at', clock_timestamp(),
      'updated_at', clock_timestamp()
    );

  insert into public.records (id, entity, active, data)
  values (p_payment_id, 'Payment', true, payment_data);

  updated_receivable_data := receivable_row.data || jsonb_build_object(
    'paid_value', total_paid_cents::numeric / 100,
    'status', new_status,
    'updated_at', clock_timestamp(),
    'updated_by', auth.uid()::text
  );

  update public.records
  set data = updated_receivable_data, updated_at = clock_timestamp()
  where id = p_receivable_id;

  perform set_config('app.audit_scope', '', true);
  perform set_config('app.audit_justification_internal', '', true);

  return jsonb_build_object(
    'schema_version', 1,
    'payment', payment_data,
    'receivable', updated_receivable_data,
    'receipt_number', receipt_number,
    'outstanding_value', greatest(expected_cents - total_paid_cents, 0)::numeric / 100
  );
end;
$$;

revoke execute on function public.register_receivable_payment(text, text, jsonb) from public, anon;
grant execute on function public.register_receivable_payment(text, text, jsonb) to authenticated;
