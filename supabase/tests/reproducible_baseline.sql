-- Falha imediatamente se o schema não tiver sido reconstruído por completo.
-- Executado após `supabase db reset`, portanto não depende de produção.

do $$
begin
  assert to_regclass('public.profiles') is not null,
    'profiles ausente depois do reset';
  assert to_regclass('public.records') is not null,
    'records ausente depois do reset';
  assert to_regclass('public.notifications') is not null,
    'notifications ausente depois do reset';
  assert to_regclass('public.transactions') is not null,
    'transactions ausente depois do reset';
  assert to_regclass('public.audit_log') is not null,
    'audit_log ausente depois do reset';

  assert to_regprocedure('public.current_app_role()') is not null,
    'current_app_role ausente depois do reset';
  assert to_regprocedure('public.register_receivable_payment(text,text,jsonb)') is not null,
    'RPC de pagamento ausente depois do reset';
  assert to_regprocedure('public.confirm_financial_inbox_transaction(uuid,text,text,text,text,date)') is not null,
    'RPC da caixa financeira ausente depois do reset';

  assert (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
    'RLS desabilitado em profiles';
  assert (select relrowsecurity from pg_class where oid = 'public.records'::regclass),
    'RLS desabilitado em records';
  assert (select relrowsecurity from pg_class where oid = 'public.notifications'::regclass),
    'RLS desabilitado em notifications';
  assert (select relrowsecurity from pg_class where oid = 'public.transactions'::regclass),
    'RLS desabilitado em transactions';
  assert (select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass),
    'RLS desabilitado em audit_log';

  assert exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'records'
  ), 'records não está na publicação Realtime';

  assert (select count(*) from public.profiles where id in (
    'd5781e1e-91cd-41bb-8219-2f6875533731'::uuid,
    'f3863393-651c-4594-b0a1-3ea70b077596'::uuid
  )) = 2, 'seed de perfis RLS incompleto';

  assert not has_table_privilege('anon', 'public.records', 'select'),
    'anon possui SELECT em records';
  assert has_table_privilege('authenticated', 'public.records', 'select'),
    'authenticated sem SELECT em records';
  assert has_table_privilege('authenticated', 'public.transactions', 'insert'),
    'authenticated sem INSERT em transactions';
  assert has_table_privilege('service_role', 'public.notifications', 'insert'),
    'service_role sem INSERT em notifications';
end;
$$;

select 'reproducible baseline ok' as result;
