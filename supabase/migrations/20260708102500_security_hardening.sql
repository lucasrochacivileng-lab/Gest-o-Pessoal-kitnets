-- Correções apontadas pelo Security Advisor do Supabase (2026-07-08):
--
-- 1. set_updated_at sem search_path fixo ("Function Search Path Mutable"):
--    fixa o caminho de busca para impedir que a função seja induzida a
--    resolver objetos fora dos schemas esperados.
--
-- 2. Funções de papel (is_admin, can_manage_kitnets, current_app_role)
--    executáveis por visitantes não logados ("Public Can Execute SECURITY
--    DEFINER Function"): revoga o EXECUTE de public/anon e mantém apenas
--    para authenticated — as policies de RLS da tabela records dependem
--    delas, então usuários logados PRECISAM continuar podendo executá-las
--    (o aviso "Signed-In Users Can Execute" é intencional neste desenho).
alter function public.set_updated_at() set search_path = pg_catalog, public;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.can_manage_kitnets() from public, anon;
revoke execute on function public.current_app_role() from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_manage_kitnets() to authenticated;
grant execute on function public.current_app_role() to authenticated;
