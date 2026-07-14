-- Executar em uma base de desenvolvimento ou dentro de BEGIN/ROLLBACK.
-- Nao contem senha, token ou chave. Os UUIDs sao perfis de teste/operacao
-- publicos dentro do proprio banco e nao permitem autenticacao isoladamente.

begin;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d5781e1e-91cd-41bb-8219-2f6875533731","role":"authenticated"}';

insert into public.records (id, entity, active, data)
values (
  'audit-test-receivable',
  'Receivable',
  true,
  jsonb_build_object(
    'id', 'audit-test-receivable',
    'contract_id', 'audit-test-contract',
    'kitnet_id', 'audit-test-kitnet',
    'tenant_id', 'audit-test-tenant',
    'competence', '2099-01',
    'destination_account', 'Conta padrao do recebivel',
    'expected_value', 100.00,
    'paid_value', 0,
    'status', 'pendente',
    'active', true
  )
);

insert into public.records (id, entity, active, data)
values (
  'audit-test-receivable-2',
  'Receivable',
  true,
  '{"id":"audit-test-receivable-2","contract_id":"audit-test-contract-2","kitnet_id":"audit-test-kitnet-2","tenant_id":"audit-test-tenant-2","competence":"2099-02","expected_value":100,"paid_value":0,"status":"pendente","active":true}'::jsonb
);

insert into public.records (id, entity, active, data)
values (
  'audit-test-partial-receivable',
  'Receivable',
  true,
  '{"id":"audit-test-partial-receivable","contract_id":"audit-test-contract-partial","competence":"2099-03","expected_value":100,"paid_value":40,"status":"parcial","active":true}'::jsonb
);

insert into public.records (id, entity, active, data)
values (
  'audit-test-expense',
  'Expense',
  true,
  jsonb_build_object(
    'id', 'audit-test-expense',
    'value', 10,
    'audit_origin', 'forged_frontend_origin',
    'audit_justification', repeat('x', 700)
  )
);

do $$
begin
  assert (select origin from public.audit_log where entity_id='audit-test-expense') = 'data_api',
    'frontend falsificou audit_origin';
  assert (select length(justification) from public.audit_log where entity_id='audit-test-expense') = 500,
    'justificativa nao foi limitada';
  assert not (select data ? 'audit_origin' or data ? 'audit_justification' from public.records where id='audit-test-expense'),
    'metadados de auditoria foram persistidos no JSON';
end;
$$;

do $$
declare
  omitted_result jsonb;
  zero_result jsonb;
  next_result jsonb;
  inactive_receipt text;
begin
  omitted_result := public.register_receivable_payment(
    'audit-test-partial-receivable', 'audit-test-omitted-value',
    '{"payment_date":"2099-03-10"}'::jsonb
  );
  assert (omitted_result -> 'payment' ->> 'paid_value')::numeric = 60,
    'paid_value ausente nao usou o saldo restante';
  assert omitted_result -> 'receivable' ->> 'status' = 'pago',
    'paid_value ausente nao quitou recebivel parcial';

  zero_result := public.register_receivable_payment(
    'audit-test-receivable-2', 'audit-test-zero-value',
    '{"paid_value":0,"payment_date":"2099-02-10"}'::jsonb
  );
  assert (zero_result -> 'payment' ->> 'paid_value')::numeric = 0,
    'paid_value zero foi substituido pelo saldo';
  assert (zero_result -> 'receivable' ->> 'paid_value')::numeric = 0,
    'pagamento zero alterou saldo do recebivel';

  inactive_receipt := omitted_result ->> 'receipt_number';
  update public.records set active=false where id='audit-test-omitted-value';
  assert exists (
    select 1 from public.records
    where id='audit-test-omitted-value' and data ->> 'receipt_number'=inactive_receipt
  ), 'recibo inativo foi removido';

  next_result := public.register_receivable_payment(
    'audit-test-receivable-2', 'audit-test-after-inactive-receipt',
    '{"paid_value":1,"payment_date":"2099-03-11"}'::jsonb
  );
  assert next_result ->> 'receipt_number' <> inactive_receipt,
    'numero de recibo inativo foi reutilizado';
end;
$$;

update public.records
set data = data || jsonb_build_object('created_by', 'forged-client', 'audit_origin', 'forged')
where id='audit-test-expense';

do $$
begin
  assert (select data ->> 'created_by' from public.records where id='audit-test-expense') = auth.uid()::text,
    'created_by foi alterado pelo cliente no update';
  assert (select data ->> 'updated_by' from public.records where id='audit-test-expense') = auth.uid()::text,
    'updated_by nao foi atualizado';
end;
$$;

insert into public.records (id, entity, active, data)
values ('audit-test-hard-delete', 'Expense', true, '{"id":"audit-test-hard-delete","value":1}'::jsonb);
delete from public.records where id='audit-test-hard-delete';

do $$
begin
  assert exists (
    select 1 from public.audit_log
    where entity_id='audit-test-hard-delete' and action='delete'
      and before_data is not null and after_data is null
  ), 'DELETE fisico nao foi auditado';
end;
$$;

do $$
declare
  result jsonb;
  replay jsonb;
  first_receipt text;
begin
  result := public.register_receivable_payment(
    'audit-test-receivable',
    'audit-test-payment-1',
    '{"paid_value":40,"discount":0.10,"fine":0.20,"interest":0.30,"payment_date":"2099-01-10","contract_id":"forged-contract","kitnet_id":"forged-kitnet","tenant_id":"forged-tenant","competence":"1900-01","receivable_id":"forged-receivable","audit_origin":"forged-origin"}'::jsonb
  );

  assert result ->> 'schema_version' = '1', 'schema_version ausente';
  assert result -> 'receivable' ->> 'status' = 'parcial', 'status parcial incorreto';
  assert (result -> 'receivable' ->> 'paid_value')::numeric = 40, 'total parcial incorreto';
  assert (result ->> 'outstanding_value')::numeric = 60, 'saldo parcial incorreto';
  assert (result -> 'payment' ->> 'net_value')::numeric = 40.40, 'liquido nao foi recalculado no banco';
  assert result -> 'payment' ->> 'created_by' = auth.uid()::text, 'created_by nao usa auth.uid';
  assert result -> 'payment' ->> 'contract_id' = 'audit-test-contract', 'contract_id nao veio do recebivel';
  assert result -> 'payment' ->> 'kitnet_id' = 'audit-test-kitnet', 'kitnet_id nao veio do recebivel';
  assert result -> 'payment' ->> 'tenant_id' = 'audit-test-tenant', 'tenant_id nao veio do recebivel';
  assert result -> 'payment' ->> 'competence' = '2099-01', 'competence nao veio do recebivel';
  assert result -> 'payment' ->> 'destination_account' = 'Conta padrao do recebivel', 'conta padrao nao foi herdada';
  first_receipt := result ->> 'receipt_number';

  replay := public.register_receivable_payment(
    'audit-test-receivable',
    'audit-test-payment-1',
    '{"paid_value":40,"discount":0.10,"fine":0.20,"interest":0.30,"payment_date":"2099-01-10"}'::jsonb
  );
  assert (replay ->> 'idempotent_replay')::boolean, 'retry nao foi marcado como replay';
  assert replay ->> 'receipt_number' = first_receipt, 'retry gerou outro recibo';
  assert (select count(*) from public.records where id='audit-test-payment-1') = 1, 'retry duplicou pagamento';
  assert (select data ->> 'paid_value' from public.records where id='audit-test-receivable')::numeric = 40,
    'retry somou pagamento novamente';

  -- Simula retry depois de a resposta original ter sido perdida.
  replay := public.register_receivable_payment(
    'audit-test-receivable',
    'audit-test-payment-1',
    '{"paid_value":40,"discount":0.10,"fine":0.20,"interest":0.30,"payment_date":"2099-01-10"}'::jsonb
  );
  assert replay ->> 'receipt_number' = first_receipt, 'retry tardio alterou recibo';

  begin
    perform public.register_receivable_payment(
      'audit-test-receivable', 'audit-test-payment-1',
      '{"paid_value":41,"discount":0.10,"fine":0.20,"interest":0.30,"payment_date":"2099-01-10"}'::jsonb
    );
    raise exception 'mesmo ID com valor diferente foi aceito';
  exception when unique_violation then
    assert sqlerrm = 'PAYMENT_IDEMPOTENCY_CONFLICT';
  end;

  begin
    perform public.register_receivable_payment(
      'audit-test-receivable-2', 'audit-test-payment-1',
      '{"paid_value":40,"discount":0.10,"fine":0.20,"interest":0.30,"payment_date":"2099-01-10"}'::jsonb
    );
    raise exception 'mesmo ID com recebivel diferente foi aceito';
  exception when unique_violation then
    assert sqlerrm = 'PAYMENT_IDEMPOTENCY_CONFLICT';
  end;

  begin
    perform public.register_receivable_payment(
      'audit-test-receivable', 'audit-test-negative-net',
      '{"paid_value":1,"discount":2,"payment_date":"2099-01-10"}'::jsonb
    );
    raise exception 'valor liquido negativo foi aceito';
  exception when sqlstate '22023' then
    assert sqlerrm = 'PAYMENT_NEGATIVE_NET_VALUE';
  end;

  result := public.register_receivable_payment(
    'audit-test-receivable',
    'audit-test-payment-2',
    '{"paid_value":60,"payment_date":"2099-01-11"}'::jsonb
  );

  assert result -> 'receivable' ->> 'status' = 'pago', 'quitacao nao marcou pago';
  assert (result -> 'receivable' ->> 'paid_value')::numeric = 100, 'quitacao total incorreta';
  assert (result ->> 'outstanding_value')::numeric = 0, 'quitacao deixou saldo';
  assert result -> 'payment' ->> 'receipt_number'
      <> (select data ->> 'receipt_number' from public.records where id='audit-test-payment-1'),
      'recibos duplicados';
end;
$$;

do $$
begin
  begin
    perform public.register_receivable_payment(
      'audit-test-receivable', 'audit-test-overpayment', '{"paid_value":0.01}'::jsonb
    );
    raise exception 'pagamento excedente foi aceito';
  exception when sqlstate '22023' then
    assert sqlerrm = 'PAYMENT_EXCEEDS_OUTSTANDING';
  end;

  begin
    perform public.register_receivable_payment(
      'audit-test-receivable', 'audit-test-negative', '{"paid_value":-1}'::jsonb
    );
    raise exception 'pagamento negativo foi aceito';
  exception when sqlstate '22023' then
    assert sqlerrm = 'PAYMENT_NEGATIVE_AMOUNT';
  end;
end;
$$;

update public.records set active=false, data=data || '{"active":false}'::jsonb
where id='audit-test-receivable';

do $$
begin
  begin
    perform public.register_receivable_payment(
      'audit-test-receivable', 'audit-test-inactive', '{"paid_value":1}'::jsonb
    );
    raise exception 'recebivel inativo foi aceito';
  exception when no_data_found then
    assert sqlerrm = 'PAYMENT_RECEIVABLE_NOT_FOUND';
  end;

  assert (select count(*) from public.audit_log where entity_id='audit-test-receivable') >= 4,
    'auditoria do recebivel incompleta';
  assert (select count(*) from public.audit_log where entity='Payment' and entity_id like 'audit-test-payment-%') = 2,
    'auditoria dos pagamentos incompleta';
  assert (select bool_and(origin='register_receivable_payment') from public.audit_log where entity='Payment' and entity_id like 'audit-test-payment-%'),
    'origem da auditoria de pagamento incorreta';
end;
$$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}';

do $$
begin
  begin
    perform public.register_receivable_payment(
      'audit-test-receivable', 'audit-test-no-profile', '{"paid_value":1}'::jsonb
    );
    raise exception 'usuario sem perfil conseguiu registrar pagamento';
  exception when no_data_found then
    assert sqlerrm = 'PAYMENT_RECEIVABLE_NOT_FOUND';
  end;
end;
$$;

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"f3863393-651c-4594-b0a1-3ea70b077596","role":"authenticated"}';

do $$
begin
  begin
    update public.profiles
    set role='ADMIN', active=true
    where id=auth.uid();
    raise exception 'usuario comum conseguiu alterar role/active';
  exception when insufficient_privilege then
    null;
  end;

  assert public.current_app_role() = 'KITNET_MANAGER', 'usuario comum elevou o proprio papel';

  begin
    perform public.admin_update_profile_access(auth.uid(), 'ADMIN', true);
    raise exception 'usuario comum conseguiu chamar RPC administrativa';
  exception when insufficient_privilege then
    assert sqlerrm = 'PROFILE_ADMIN_REQUIRED';
  end;

  update public.profiles set name=name where id=auth.uid();
  assert public.current_app_role() = 'KITNET_MANAGER', 'edicao comum alterou permissao';
end;
$$;

reset role;

do $$
begin
  assert not has_function_privilege('anon', 'public.register_receivable_payment(text,text,jsonb)', 'execute'),
    'anon possui EXECUTE na RPC';
  assert has_function_privilege('authenticated', 'public.register_receivable_payment(text,text,jsonb)', 'execute'),
    'authenticated perdeu EXECUTE na RPC';
end;
$$;

rollback;
