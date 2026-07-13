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
    'competence', '2099-01',
    'expected_value', 100.00,
    'paid_value', 0,
    'status', 'pendente',
    'active', true
  )
);

do $$
declare
  result jsonb;
begin
  result := public.register_receivable_payment(
    'audit-test-receivable',
    'audit-test-payment-1',
    '{"paid_value":40,"discount":0.10,"fine":0.20,"interest":0.30,"payment_date":"2099-01-10"}'::jsonb
  );

  assert result ->> 'schema_version' = '1', 'schema_version ausente';
  assert result -> 'receivable' ->> 'status' = 'parcial', 'status parcial incorreto';
  assert (result -> 'receivable' ->> 'paid_value')::numeric = 40, 'total parcial incorreto';
  assert (result ->> 'outstanding_value')::numeric = 60, 'saldo parcial incorreto';
  assert (result -> 'payment' ->> 'net_value')::numeric = 40.40, 'liquido nao foi recalculado no banco';
  assert result -> 'payment' ->> 'created_by' = auth.uid()::text, 'created_by nao usa auth.uid';

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

do $$
begin
  assert not has_function_privilege('anon', 'public.register_receivable_payment(text,text,jsonb)', 'execute'),
    'anon possui EXECUTE na RPC';
  assert has_function_privilege('authenticated', 'public.register_receivable_payment(text,text,jsonb)', 'execute'),
    'authenticated perdeu EXECUTE na RPC';
end;
$$;

rollback;
