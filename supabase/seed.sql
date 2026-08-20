-- Perfis determinísticos usados exclusivamente pelos testes locais de RLS.
-- Não contém credenciais e não é aplicado por `supabase db push`.

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
values
  (
    'd5781e1e-91cd-41bb-8219-2f6875533731',
    'admin.rls@example.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  ),
  (
    'f3863393-651c-4594-b0a1-3ea70b077596',
    'manager.rls@example.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  )
on conflict (id) do nothing;

insert into public.profiles (id, name, role, active)
values
  ('d5781e1e-91cd-41bb-8219-2f6875533731', 'Administrador de teste', 'ADMIN', true),
  ('f3863393-651c-4594-b0a1-3ea70b077596', 'Gestor de teste', 'KITNET_MANAGER', true)
on conflict (id) do update
set name = excluded.name,
    role = excluded.role,
    active = excluded.active,
    deleted_at = null;
