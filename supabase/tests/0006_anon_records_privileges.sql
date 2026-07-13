-- Prova que a migration 0006 remove os privilegios de `anon` sobre
-- public.records sem afetar authenticated, service_role, o owner, RLS,
-- policies, a RPC de pagamento ou os dados.
--
-- Executar SEMPRE dentro de BEGIN/ROLLBACK (este script ja abre/fecha a
-- transacao e nao persiste nada). Pode ser rodado ANTES da aplicacao da
-- 0006 (o REVOKE roda dentro da transacao e demonstra o efeito) ou DEPOIS
-- (o REVOKE vira um no-op idempotente e as asserts continuam valendo).
--
-- Nao contem senha, token ou chave. Os UUIDs sao perfis de teste publicos
-- dentro do proprio banco e nao autenticam nada isoladamente (mesmos usados
-- em supabase/tests/financial_core_authenticated.sql).

begin;

-- ============================================================
-- REGISTRO: grants de records ANTES do revoke
-- ============================================================
select 'GRANTS ANTES' as etapa, grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'records'
 order by grantee, privilege_type;

-- ============================================================
-- REGISTRO: contagens ANTES (total + entidades financeiras)
-- ============================================================
select 'CONTAGENS ANTES' as etapa,
       count(*)                                        as total,
       count(*) filter (where entity = 'Payment')      as payment,
       count(*) filter (where entity = 'Receivable')   as receivable,
       count(*) filter (where entity = 'Contract')     as contract,
       count(*) filter (where entity = 'Expense')      as expense
  from public.records;

-- ============================================================
-- APLICA o revoke dentro da transacao e valida (12) contagem intacta
-- ============================================================
do $$
declare
  before_total bigint;
  after_total  bigint;
begin
  select count(*) into before_total from public.records;

  revoke all privileges on table public.records from anon;  -- idempotente

  select count(*) into after_total from public.records;
  assert before_total = after_total,
    '12: contagem total de registros mudou apos o revoke';
end;
$$;

-- ============================================================
-- (1-4) anon NAO possui SELECT/INSERT/UPDATE/DELETE em records
-- ============================================================
do $$
begin
  assert not has_table_privilege('anon', 'public.records', 'select'),
    '1: anon ainda possui SELECT em records';
  assert not has_table_privilege('anon', 'public.records', 'insert'),
    '2: anon ainda possui INSERT em records';
  assert not has_table_privilege('anon', 'public.records', 'update'),
    '3: anon ainda possui UPDATE em records';
  assert not has_table_privilege('anon', 'public.records', 'delete'),
    '4: anon ainda possui DELETE em records';
end;
$$;

-- ============================================================
-- (5) authenticated MANTEM os privilegios necessarios (CRUD)
-- ============================================================
do $$
begin
  assert has_table_privilege('authenticated', 'public.records', 'select'),
    '5: authenticated perdeu SELECT em records';
  assert has_table_privilege('authenticated', 'public.records', 'insert'),
    '5: authenticated perdeu INSERT em records';
  assert has_table_privilege('authenticated', 'public.records', 'update'),
    '5: authenticated perdeu UPDATE em records';
  assert has_table_privilege('authenticated', 'public.records', 'delete'),
    '5: authenticated perdeu DELETE em records';
end;
$$;

-- ============================================================
-- (11) service_role continua com CRUD sobre records
-- ============================================================
do $$
begin
  assert has_table_privilege('service_role', 'public.records', 'select'),
    '11: service_role perdeu SELECT em records';
  assert has_table_privilege('service_role', 'public.records', 'insert'),
    '11: service_role perdeu INSERT em records';
  assert has_table_privilege('service_role', 'public.records', 'update'),
    '11: service_role perdeu UPDATE em records';
  assert has_table_privilege('service_role', 'public.records', 'delete'),
    '11: service_role perdeu DELETE em records';
end;
$$;

-- ============================================================
-- (9-10) RPC register_receivable_payment: authenticated ok, anon bloqueada
-- ============================================================
do $$
begin
  assert has_function_privilege('authenticated',
    'public.register_receivable_payment(text,text,jsonb)', 'execute'),
    '9: authenticated perdeu EXECUTE na RPC de pagamento';
  assert not has_function_privilege('anon',
    'public.register_receivable_payment(text,text,jsonb)', 'execute'),
    '10: anon possui EXECUTE na RPC de pagamento';
end;
$$;

-- ============================================================
-- RLS e policy preservados (defesa em profundidade continua ativa)
-- ============================================================
do $$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.records'::regclass),
    'RLS foi desabilitado em records';
  assert exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'records'
       and policyname = 'records_role_access'
  ), 'policy records_role_access desapareceu';
end;
$$;

-- ============================================================
-- (6) ADMIN continua com CRUD permitido (via RLS)
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"d5781e1e-91cd-41bb-8219-2f6875533731","role":"authenticated"}';

do $$
begin
  insert into public.records (id, entity, active, data)
  values ('audit-0006-admin', 'Kitnet', true, '{"id":"audit-0006-admin","name":"K-0006"}'::jsonb);
  assert exists (select 1 from public.records where id = 'audit-0006-admin'),
    '6: ADMIN nao conseguiu inserir';

  update public.records set data = data || '{"name":"K-0006b"}'::jsonb
   where id = 'audit-0006-admin';
  assert (select data ->> 'name' from public.records where id = 'audit-0006-admin') = 'K-0006b',
    '6: ADMIN nao conseguiu atualizar';

  delete from public.records where id = 'audit-0006-admin';
  assert not exists (select 1 from public.records where id = 'audit-0006-admin'),
    '6: ADMIN nao conseguiu excluir';
end;
$$;

reset role;

-- ============================================================
-- (7) KITNET_MANAGER continua limitado pelas policies:
--     pode entidades de kitnet, NAO pode PersonalIncome
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"f3863393-651c-4594-b0a1-3ea70b077596","role":"authenticated"}';

do $$
begin
  assert public.current_app_role() = 'KITNET_MANAGER',
    '7: perfil de teste nao e KITNET_MANAGER';

  insert into public.records (id, entity, active, data)
  values ('audit-0006-km-kitnet', 'Kitnet', true, '{"id":"audit-0006-km-kitnet"}'::jsonb);
  assert exists (select 1 from public.records where id = 'audit-0006-km-kitnet'),
    '7: KITNET_MANAGER nao conseguiu inserir entidade de kitnet';

  begin
    insert into public.records (id, entity, active, data)
    values ('audit-0006-km-personal', 'PersonalIncome', true, '{"id":"audit-0006-km-personal"}'::jsonb);
    raise exception '7: KITNET_MANAGER conseguiu inserir PersonalIncome (policy falhou)';
  exception when insufficient_privilege then
    null;  -- 42501: new row violates row-level security policy
  end;
end;
$$;

reset role;

-- ============================================================
-- (8) usuario autenticado SEM perfil ativo continua bloqueado
-- ============================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}';

do $$
begin
  assert (select count(*) from public.records) = 0,
    '8: usuario sem perfil enxergou registros';

  begin
    insert into public.records (id, entity, active, data)
    values ('audit-0006-noprofile', 'Kitnet', true, '{"id":"audit-0006-noprofile"}'::jsonb);
    raise exception '8: usuario sem perfil conseguiu inserir';
  exception when insufficient_privilege then
    null;  -- 42501: new row violates row-level security policy
  end;
end;
$$;

reset role;

-- ============================================================
-- Limpa as linhas de teste inseridas acima (continua tudo em rollback)
-- ============================================================
delete from public.records where id like 'audit-0006-%';

-- ============================================================
-- REGISTRO: grants de records DEPOIS (anon deve ter sumido)
-- ============================================================
select 'GRANTS DEPOIS' as etapa, grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'records'
 order by grantee, privilege_type;

-- ============================================================
-- REGISTRO: contagens DEPOIS (devem bater com ANTES)
-- ============================================================
select 'CONTAGENS DEPOIS' as etapa,
       count(*)                                        as total,
       count(*) filter (where entity = 'Payment')      as payment,
       count(*) filter (where entity = 'Receivable')   as receivable,
       count(*) filter (where entity = 'Contract')     as contract,
       count(*) filter (where entity = 'Expense')      as expense
  from public.records;

rollback;
