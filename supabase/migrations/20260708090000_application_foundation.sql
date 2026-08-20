-- Fundação mínima da aplicação antes da criação de public.records.
--
-- O projeto nasceu sobre um banco já existente e as primeiras migrations
-- versionadas dependiam de profiles, notifications, app_role e helpers de
-- autorização que só existiam no remoto. Este arquivo torna essas dependências
-- explícitas para que um banco Supabase vazio possa aplicar a sequência inteira.

do $$
begin
  create type public.app_role as enum ('ADMIN', 'KITNET_MANAGER');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_url text,
  role public.app_role not null default 'KITNET_MANAGER',
  active boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.profiles enable row level security;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles as profile
  where profile.id = (select auth.uid())
    and profile.active
    and profile.deleted_at is null
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'ADMIN'::public.app_role, false)
$$;

create or replace function public.can_manage_kitnets()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_app_role() in ('ADMIN'::public.app_role, 'KITNET_MANAGER'::public.app_role),
    false
  )
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  target_entity text not null,
  target_id text,
  title text not null,
  message text not null default '',
  status text not null default 'pendente',
  confirmed_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists notifications_owner_status_created_idx
  on public.notifications (owner_id, status, created_at desc)
  where deleted_at is null;

alter table public.notifications enable row level security;

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

drop policy if exists notifications_owner_access on public.notifications;
create policy notifications_owner_access
  on public.notifications for all to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());

revoke all on table public.profiles, public.notifications from anon;
grant usage on schema public to authenticated, service_role;
grant usage on type public.app_role to authenticated, service_role;
grant select on table public.profiles to authenticated;
grant update (name, avatar_url) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;
grant all on table public.profiles, public.notifications to service_role;
