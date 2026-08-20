-- Tabela única de registros: cada linha é um objeto de uma entidade (Kitnet, Tenant, Contract...).
-- O objeto completo fica em `data` (jsonb), preservando campos dinâmicos criados pelos formulários.
-- APLICADA no projeto ngtazecajkiescyxlqou em 2026-07-08 (migration create_records_table),
-- junto com a cópia dos dados das tabelas relacionais legadas (properties, tenants, contracts,
-- receivables, payments, expenses, construction_projects, documents, personal_finances,
-- credit_cards, loans, notifications) para dentro de records.
create table if not exists public.records (
  id text primary key,
  entity text not null,
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists records_entity_active_idx on public.records (entity) where active;

alter table public.records enable row level security;

drop policy if exists records_role_access on public.records;

-- ADMIN acessa tudo; KITNET_MANAGER acessa apenas entidades das kitnets
-- (reutiliza as funções is_admin() e can_manage_kitnets() já existentes no projeto).
create policy records_role_access
  on public.records
  for all
  to authenticated
  using (
    is_admin()
    or (
      can_manage_kitnets()
      and entity not in ('PersonalIncome', 'CreditCard', 'Loan', 'ExpertReport', 'ComplementaryProject', 'Import')
    )
  )
  with check (
    is_admin()
    or (
      can_manage_kitnets()
      and entity not in ('PersonalIncome', 'CreditCard', 'Loan', 'ExpertReport', 'ComplementaryProject', 'Import')
    )
  );
