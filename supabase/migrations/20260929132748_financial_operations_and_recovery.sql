-- Operações financeiras mantêm cobrança e alertas na mesma transação.
-- Todas as funções públicas seguem RLS e exigem autenticação; backup é exclusivo do admin.
drop index if exists public.records_receivable_contract_competence_uidx;
create unique index records_receivable_contract_competence_uidx
on public.records ((data->>'contract_id'), (data->>'competence'),
  (case when data->>'type' = 'multa_quebra' then 'multa_quebra' else 'aluguel' end))
where entity = 'Receivable' and active
  and coalesce(data->>'status', '') not in ('cancelado', 'cancelled')
  and nullif(data->>'contract_id', '') is not null and nullif(data->>'competence', '') is not null;

create or replace function public.sync_rent_notification_state()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
declare closed boolean;
begin
  if new.entity <> 'Receivable' or current_setting('app.restore_scope', true) = 'restore' then return new; end if;
  closed := not new.active or new.data->>'status' in ('pago','cancelado','cancelled')
    or coalesce((new.data->>'paid_value')::numeric,0) >= coalesce((new.data->>'expected_value')::numeric,0);
  if closed then
    update public.records set data = data || jsonb_build_object('status','resolvida',
      'resolved_at',clock_timestamp(),'resolution_source','receivable'), updated_at=clock_timestamp()
    where entity='Notification' and active and data->>'type'='rent_due'
      and data->>'entity'='Receivable' and data->>'entity_id'=new.id
      and coalesce(data->>'status','') not in ('confirmada','ignorada','resolvida');
  else
    update public.records set data = (data - 'resolved_at' - 'confirmed_at') || jsonb_build_object(
      'status','pendente','scheduled_for',to_char(current_date,'YYYY-MM-DD')), updated_at=clock_timestamp()
    where entity='Notification' and active and data->>'type'='rent_due'
      and data->>'entity'='Receivable' and data->>'entity_id'=new.id
      and data->>'status' in ('resolvida','confirmada');
  end if;
  return new;
end;
$$;
create trigger records_80_rent_notifications after insert or update on public.records
for each row execute function public.sync_rent_notification_state();

create or replace function public.maintain_payment_balance()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  target text; receivable public.records%rowtype; old_paid numeric:=0; new_paid numeric:=0;
  amount numeric; discount numeric; fine numeric; interest numeric; total numeric; expected numeric;
begin
  if current_setting('app.restore_scope', true) = 'restore' then return new; end if;
  if tg_op='UPDATE' and old.entity='Payment' and new.entity<>'Payment' then
    raise exception 'A entidade de um pagamento não pode ser alterada.';
  end if;
  if new.entity <> 'Payment' then return new; end if;
  target := nullif(new.data->>'receivable_id','');
  if tg_op='UPDATE' then
    if old.entity <> new.entity or old.data->>'receivable_id' is distinct from new.data->>'receivable_id' then
      raise exception 'O vínculo do pagamento não pode ser alterado; estorne e registre novamente.';
    end if;
    if not old.active and new.active then raise exception 'Um pagamento estornado não pode ser reativado.'; end if;
    if old.active then old_paid:=round(coalesce((old.data->>'paid_value')::numeric,0),2); end if;
  end if;
  amount:=round(coalesce((new.data->>'paid_value')::numeric,0),2);
  discount:=round(coalesce((new.data->>'discount')::numeric,0),2);
  fine:=round(coalesce((new.data->>'fine')::numeric,0),2);
  interest:=round(coalesce((new.data->>'interest')::numeric,0),2);
  if amount::text in ('NaN','Infinity','-Infinity') or discount::text in ('NaN','Infinity','-Infinity')
    or fine::text in ('NaN','Infinity','-Infinity') or interest::text in ('NaN','Infinity','-Infinity')
    or least(amount,discount,fine,interest)<0 or amount-discount+fine+interest<0 then
    raise exception 'Informe valores monetários válidos e não negativos.';
  end if;
  new.data := new.data || jsonb_build_object('net_value',amount-discount+fine+interest,
    'paid_value',amount,'discount',discount,'fine',fine,'interest',interest,'active',new.active);
  if new.active then new_paid:=amount; else new.data:=new.data || '{"status":"estornado"}'::jsonb; end if;
  if target is null then return new; end if;
  select * into receivable from public.records where id=target and entity='Receivable' and active for update;
  if not found then raise exception 'Recebível não encontrado ou sem permissão.'; end if;
  if new.active and receivable.data->>'status' in ('cancelado','cancelled') then raise exception 'Recebível cancelado.'; end if;
  expected:=round(coalesce((receivable.data->>'expected_value')::numeric,0),2);
  total:=round(coalesce((receivable.data->>'paid_value')::numeric,0),2)-old_paid+new_paid;
  if total<0 or total>expected then raise exception 'O pagamento excede o saldo ou o recebível está inconsistente.'; end if;
  new.data:=new.data || jsonb_build_object('contract_id',receivable.data->>'contract_id',
    'kitnet_id',receivable.data->>'kitnet_id','tenant_id',receivable.data->>'tenant_id','competence',receivable.data->>'competence');
  update public.records set data=data || jsonb_build_object('paid_value',total,'status',
    case when total>=expected then 'pago' when total>0 or new.active then 'parcial' else 'pendente' end), updated_at=clock_timestamp()
    where id=target;
  return new;
end;
$$;
create trigger records_05_payment_balance before insert or update on public.records
for each row execute function public.maintain_payment_balance();

create or replace function public.amend_receivable_payment(
  p_payment_id text, p_values jsonb, p_previous jsonb, p_reverse boolean, p_justification text
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare payment public.records%rowtype; target text; patch jsonb;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  if nullif(btrim(p_justification),'') is null then raise exception 'Informe o motivo da correção ou estorno.'; end if;
  select data->>'receivable_id' into target from public.records where id=p_payment_id and entity='Payment';
  -- Mesma ordem de bloqueio da baixa normal: recebível, depois pagamento.
  perform 1 from public.records where id=target and entity='Receivable' for update;
  select * into payment from public.records where id=p_payment_id and entity='Payment' for update;
  if not found then raise exception 'Pagamento não encontrado.'; end if;
  if not payment.active then
    if p_reverse then return jsonb_build_object('payment',payment.data,'idempotentReplay',true); end if;
    raise exception 'Pagamento estornado não pode ser corrigido.';
  end if;
  if p_previous is null or p_previous='{}'::jsonb or not payment.data @> p_previous then
    raise exception 'O pagamento mudou. Atualize a tela antes de corrigir ou estornar.';
  end if;
  if p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'Dados inválidos.'; end if;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into patch from jsonb_each(p_values)
    where key=any(array['paid_value','discount','fine','interest','payment_date','payment_method','bank_account_id','destination_account','receipt_url','notes']);
  if patch ? 'payment_date' then
    if coalesce(patch->>'payment_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data de pagamento inválida.'; end if;
    perform (patch->>'payment_date')::date;
  end if;
  update public.records set active=not p_reverse, data=data || patch || jsonb_build_object(
    'active',not p_reverse,'audit_justification',p_justification,'updated_at',clock_timestamp()), updated_at=clock_timestamp()
    where id=p_payment_id returning * into payment;
  return jsonb_build_object('payment',payment.data,'receivable',(select data from public.records where id=target));
end;
$$;

create or replace function public.terminate_rental_contract(p_contract_id text,p_exit_date date,p_launch_fine boolean)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  contract public.records%rowtype; cancelled integer; fine_value numeric:=0; fine_months numeric;
  total_days integer; remaining_days integer; base_fine numeric; fine_data jsonb:=null;
  fine_id text; result jsonb;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  select * into contract from public.records where id=p_contract_id and entity='Contract' and active for update;
  if not found then raise exception 'Contrato não encontrado.'; end if;
  if contract.data->>'status'='encerrado' then
    return coalesce(contract.data->'termination_result',jsonb_build_object('canceledReceivables',0,'fineReceivable',null));
  end if;
  if p_exit_date is null or p_exit_date < (contract.data->>'start_date')::date then raise exception 'Data de saída inválida.'; end if;
  fine_months:=greatest(coalesce((contract.data->>'fine_months')::numeric,3),0);
  base_fine:=fine_months*coalesce((contract.data->>'rent_value')::numeric,0);
  total_days:=greatest((contract.data->>'end_date')::date-(contract.data->>'start_date')::date,1);
  remaining_days:=least(greatest((contract.data->>'end_date')::date-p_exit_date,0),total_days);
  fine_value:=coalesce(round(base_fine*remaining_days/total_days,2),0);
  perform 1 from public.records where entity='Receivable' and data->>'contract_id'=p_contract_id order by id for update;
  update public.records set active=false,data=data || '{"active":false,"status":"cancelado"}'::jsonb,updated_at=clock_timestamp()
    where entity='Receivable' and active and data->>'contract_id'=p_contract_id
      and data->>'competence'>to_char(p_exit_date,'YYYY-MM') and coalesce((data->>'paid_value')::numeric,0)=0
      and coalesce(data->>'status','')<>'pago';
  get diagnostics cancelled = row_count;
  if p_launch_fine and fine_value>0 then
    fine_id:=gen_random_uuid()::text;
    fine_data:=jsonb_build_object('id',fine_id,'active',true,'contract_id',p_contract_id,
      'kitnet_id',contract.data->>'kitnet_id','tenant_id',contract.data->>'tenant_id',
      'bank_account_id',contract.data->>'bank_account_id','type','multa_quebra',
      'competence',to_char(p_exit_date,'YYYY-MM'),'due_date',p_exit_date::text,
      'expected_value',fine_value,'paid_value',0,'status','pendente');
    insert into public.records(id,entity,active,data) values(fine_id,'Receivable',true,fine_data);
  end if;
  result:=jsonb_build_object('canceledReceivables',cancelled,'fineReceivable',fine_data,
    'fine',jsonb_build_object('fine',fine_value,'baseFine',base_fine,'fineMonths',fine_months,'totalDays',total_days,'remainingDays',remaining_days));
  update public.records set data=data || jsonb_build_object('status','encerrado','original_end_date',data->>'end_date',
    'end_date',p_exit_date::text,'terminated_at',clock_timestamp(),'termination_result',result),updated_at=clock_timestamp() where id=p_contract_id;
  update public.records set data=data || '{"status":"vaga"}'::jsonb,updated_at=clock_timestamp()
    where entity='Kitnet' and id=contract.data->>'kitnet_id' and not exists(select 1 from public.records c where c.entity='Contract'
      and c.active and c.data->>'status'='ativo' and c.data->>'kitnet_id'=contract.data->>'kitnet_id');
  update public.records set data=data || '{"status":"inativo","kitnet_id":""}'::jsonb,updated_at=clock_timestamp()
    where entity='Tenant' and id=contract.data->>'tenant_id' and not exists(select 1 from public.records c where c.entity='Contract'
      and c.active and c.data->>'status'='ativo' and c.data->>'tenant_id'=contract.data->>'tenant_id');
  return result;
end;
$$;

create or replace function public.export_application_backup()
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare snapshot jsonb;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Somente administradores podem exportar a base completa.'; end if;
  -- Subconsultas em uma única instrução compartilham o snapshot MVCC.
  select jsonb_build_object(
    'records',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]'::jsonb) from public.records r),
    'notifications',(select coalesce(jsonb_agg(to_jsonb(n) order by id),'[]'::jsonb) from public.notifications n),
    'transactions',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb) from public.transactions t)
  ) into snapshot;
  return jsonb_build_object('format','kitmanager-backup','version',2,'created_at',clock_timestamp(),
    'database',snapshot,'revision',md5(snapshot::text));
end;
$$;

create or replace function public.restore_application_backup(p_backup jsonb,p_expected_revision text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare snapshot jsonb; rows jsonb; legacy boolean;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Somente administradores podem restaurar a base.'; end if;
  if p_backup->>'format' is distinct from 'kitmanager-backup' or p_backup->>'version' is distinct from '2'
    or jsonb_typeof(p_backup#>'{database,records}') is distinct from 'array'
    or jsonb_typeof(p_backup#>'{database,notifications}') is distinct from 'array'
    or jsonb_typeof(p_backup#>'{database,transactions}') is distinct from 'array' then raise exception 'Backup inválido.'; end if;
  rows:=p_backup#>'{database,records}';
  if exists(select 1 from jsonb_array_elements(rows) r where jsonb_typeof(r)<>'object'
      or nullif(r->>'id','') is null or nullif(r->>'entity','') is null
      or jsonb_typeof(r->'data') is distinct from 'object' or jsonb_typeof(r->'active') is distinct from 'boolean'
      or r->>'id' is distinct from r#>>'{data,id}')
    or (select count(*) from jsonb_array_elements(rows))<>(select count(distinct r->>'id') from jsonb_array_elements(rows) r)
    then raise exception 'Backup contém registros inválidos ou IDs duplicados.'; end if;
  lock table public.records, public.notifications, public.transactions in share row exclusive mode;
  snapshot:=public.export_application_backup();
  if p_expected_revision is null or snapshot->>'revision' <> p_expected_revision then
    raise exception 'A base mudou desde a cópia de segurança. Exporte novamente antes de restaurar.';
  end if;
  legacy:=coalesce((p_backup->>'legacy')::boolean,false);
  perform set_config('app.restore_scope','restore',true);
  if not legacy then delete from public.transactions; delete from public.notifications; end if;
  delete from public.records;
  insert into public.records(id,entity,active,data,created_at,updated_at)
    select id,entity,active,data,coalesce(created_at,now()),coalesce(updated_at,now())
    from jsonb_populate_recordset(null::public.records,rows);
  if not legacy then
    insert into public.notifications select * from jsonb_populate_recordset(null::public.notifications,p_backup#>'{database,notifications}');
    insert into public.transactions select * from jsonb_populate_recordset(null::public.transactions,p_backup#>'{database,transactions}');
  end if;
  perform set_config('app.restore_scope','',true);
  return jsonb_build_object('restored',true,'records',jsonb_array_length(rows));
end;
$$;

create or replace function public.protect_record_deletion()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if current_user in ('authenticated','anon') and current_setting('app.restore_scope',true) is distinct from 'restore' then
    raise exception 'Exclusão definitiva indisponível no app. Use exclusão lógica ou estorno.';
  end if;
  return old;
end;
$$;
create trigger records_05_protect_delete before delete on public.records for each row execute function public.protect_record_deletion();

revoke execute on function public.sync_rent_notification_state(),public.maintain_payment_balance(),public.protect_record_deletion() from public,anon,authenticated;
revoke execute on function public.amend_receivable_payment(text,jsonb,jsonb,boolean,text),public.terminate_rental_contract(text,date,boolean),
  public.export_application_backup(),public.restore_application_backup(jsonb,text) from public,anon;
grant execute on function public.amend_receivable_payment(text,jsonb,jsonb,boolean,text),public.terminate_rental_contract(text,date,boolean),
  public.export_application_backup(),public.restore_application_backup(jsonb,text) to authenticated;

-- Retry verifica a identidade antes de aplicar a validação de saldo já baixado.
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

  if paid_cents > outstanding_cents then
    raise exception using message = 'PAYMENT_EXCEEDS_OUTSTANDING', errcode = '22023';
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

grant delete on public.notifications, public.transactions to authenticated;

-- A sincronização de uma tela antiga não pode reabrir uma cobrança quitada.
create or replace function public.guard_rent_notification_state()
returns trigger language plpgsql security invoker set search_path=pg_catalog,public as $$
declare target public.records%rowtype;
begin
  if current_setting('app.restore_scope',true)='restore' or new.entity<>'Notification'
    or new.data->>'type'<>'rent_due' or new.data->>'entity'<>'Receivable' then return new; end if;
  select * into target from public.records where entity='Receivable' and id=new.data->>'entity_id' for update;
  if found and (not target.active or target.data->>'status' in ('pago','cancelado','cancelled')
    or coalesce((target.data->>'paid_value')::numeric,0)>=coalesce((target.data->>'expected_value')::numeric,0))
    and coalesce(new.data->>'status','') not in ('confirmada','ignorada','resolvida') then
    new.data:=new.data || jsonb_build_object('status','resolvida','resolution_source','receivable','resolved_at',clock_timestamp());
  end if;
  return new;
end;
$$;
create trigger records_06_guard_rent_notification before insert or update on public.records
for each row execute function public.guard_rent_notification_state();
revoke execute on function public.guard_rent_notification_state() from public,anon,authenticated;
-- DELETE em transactions é necessário à recuperação, mas não a operações comuns.
create trigger transactions_protect_delete before delete on public.transactions
for each row execute function public.protect_record_deletion();
