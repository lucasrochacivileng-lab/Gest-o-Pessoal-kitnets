-- Relaciona provedores das notificacoes as contas transacionais principais.
do $$
declare
  nubank_account_id text;
begin
  update public.records
  set data = data || jsonb_build_object(
        'notification_provider', 'inter',
        'is_primary_transaction_account', true,
        'updated_at', now()
      ),
      updated_at = now()
  where entity = 'BankAccount'
    and active
    and data ->> 'name' = 'Banco Inter - Lucas';

  update public.records
  set data = data || jsonb_build_object(
        'notification_provider', 'itau',
        'is_primary_transaction_account', true,
        'updated_at', now()
      ),
      updated_at = now()
  where entity = 'BankAccount'
    and active
    and data ->> 'name' = 'Banco Itaú - Lucas';

  select id into nubank_account_id
  from public.records
  where entity = 'BankAccount'
    and active
    and data ->> 'notification_provider' = 'nubank'
    and data ->> 'is_primary_transaction_account' = 'true'
  limit 1;

  if nubank_account_id is null then
    nubank_account_id := gen_random_uuid()::text;
    insert into public.records (id, entity, active, data)
    values (
      nubank_account_id,
      'BankAccount',
      true,
      jsonb_build_object(
        'id', nubank_account_id,
        'active', true,
        'name', 'Nubank - Conta Lucas',
        'institution', 'Nubank',
        'type', 'conta_corrente',
        'notes', 'Conta transacional principal identificada pelas notificacoes do Nubank. Saldo inicial ainda nao informado.',
        'notification_provider', 'nubank',
        'is_primary_transaction_account', true,
        'created_at', now(),
        'updated_at', now()
      )
    );
  end if;

  update public.transactions
  set bank_account_id = nubank_account_id,
      updated_at = now()
  where provider = 'nubank'
    and transaction_type in ('pix_sent', 'pix_received')
    and bank_account_id is null
    and deleted_at is null;

  update public.notifications
  set status = 'ignorada',
      parse_status = 'ignored_noise',
      updated_at = now()
  where source = 'macrodroid'
    and status = 'pendente'
    and parse_status = 'unrecognized'
    and lower(coalesce(raw_title, '') || ' ' || coalesce(raw_text, ''))
      !~ '(pix|transferencia[[:space:]]+(recebida|enviada|realizada)|boleto|cobranca[[:space:]]+(emitida|registrada)|dda|compra[[:space:]]+(aprovada|realizada))';
end
$$;
