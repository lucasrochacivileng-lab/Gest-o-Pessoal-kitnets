-- Impede duas cobrancas ativas para o mesmo contrato e competencia.
-- As clausulas nullif preservam lancamentos manuais antigos sem vinculo completo.
create unique index if not exists records_receivable_contract_competence_uidx
  on public.records ((data ->> 'contract_id'), (data ->> 'competence'))
  where entity = 'Receivable'
    and active
    and nullif(data ->> 'contract_id', '') is not null
    and nullif(data ->> 'competence', '') is not null;

-- Registra Payment e atualiza Receivable na mesma transacao. A funcao roda
-- como o usuario autenticado, portanto continua sujeita as policies de RLS.
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
  payment_data jsonb;
  updated_receivable_data jsonb;
  receipt_year text;
  receipt_sequence integer;
  receipt_number text;
  paid_cents bigint;
  total_paid_cents bigint;
  expected_cents bigint;
  new_status text;
begin
  select * into receivable_row
  from public.records
  where id = p_receivable_id and entity = 'Receivable' and active
  for update;

  if not found then
    raise exception 'Recebimento nao encontrado ou sem permissao: %', p_receivable_id;
  end if;

  paid_cents := round(coalesce((p_payment_data ->> 'paid_value')::numeric, 0) * 100);
  total_paid_cents := round(coalesce((receivable_row.data ->> 'paid_value')::numeric, 0) * 100) + paid_cents;
  expected_cents := round(coalesce((receivable_row.data ->> 'expected_value')::numeric, 0) * 100);
  new_status := case when total_paid_cents >= expected_cents then 'pago' else 'parcial' end;

  receipt_year := coalesce(nullif(left(p_payment_data ->> 'payment_date', 4), ''), to_char(current_date, 'YYYY'));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('payment-receipt-' || receipt_year));

  select coalesce(max((substring(data ->> 'receipt_number' from '^[0-9]{4}-([0-9]+)$'))::integer), 0) + 1
    into receipt_sequence
  from public.records
  where entity = 'Payment'
    and active
    and data ->> 'receipt_number' like receipt_year || '-%';

  receipt_number := receipt_year || '-' || lpad(receipt_sequence::text, 4, '0');
  payment_data := p_payment_data || jsonb_build_object(
    'id', p_payment_id,
    'active', true,
    'receipt_number', receipt_number,
    'status', new_status
  );

  insert into public.records (id, entity, active, data)
  values (p_payment_id, 'Payment', true, payment_data);

  updated_receivable_data := receivable_row.data || jsonb_build_object(
    'paid_value', total_paid_cents::numeric / 100,
    'status', new_status,
    'updated_at', coalesce(p_payment_data ->> 'updated_at', now()::text),
    'updated_by', coalesce(p_payment_data ->> 'updated_by', 'local-user')
  );

  update public.records
  set data = updated_receivable_data,
      updated_at = now()
  where id = p_receivable_id;

  return jsonb_build_object(
    'payment', payment_data,
    'receivable', updated_receivable_data,
    'receipt_number', receipt_number
  );
end;
$$;

revoke execute on function public.register_receivable_payment(text, text, jsonb) from public, anon;
grant execute on function public.register_receivable_payment(text, text, jsonb) to authenticated;
