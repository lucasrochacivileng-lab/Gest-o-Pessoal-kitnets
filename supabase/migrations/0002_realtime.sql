-- Habilita o Supabase Realtime na tabela `records`: adiciona a tabela à
-- publicação `supabase_realtime` para que os clientes recebam eventos de
-- INSERT/UPDATE/DELETE (respeitando as policies de RLS já existentes).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
end;
$$;
