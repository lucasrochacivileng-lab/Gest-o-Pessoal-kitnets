# KitManager Pro

ERP web em React para gestão de kitnets, locatários, contratos, recebíveis, pagamentos, despesas, documentos e visão financeira.

O projeto nasceu como scaffold para reconstruir fora da Base44 o app KitManager, mas já possui uma base modular preparada para evoluir para uma aplicação de produção.

## Stack

- React 18
- Vite 5
- Tailwind CSS 3
- React Router
- Recharts
- Vitest
- pnpm

## Rodar localmente

```bash
pnpm install
pnpm dev
```

## Verificações

```bash
pnpm test
pnpm build
pnpm check
```

`pnpm check` executa a suíte de testes e o build de produção.

## Organização

- `src/app`: providers e rotas principais.
- `src/layouts`: layout de aplicação e navegação lateral.
- `src/modules`: módulos de negócio organizados por domínio.
- `src/components`: componentes compartilhados.
- `src/services`: serviços de aplicação e cliente local.
- `src/repository`: camada central de persistência.
- `src/data`: seed local de desenvolvimento.
- `src/styles`: tokens, tema e estilos globais.

## Persistência

No estado atual, a aplicação usa `localStorage` com seed em memória para desenvolvimento local. O acesso aos dados passa por `src/repository/index.js`, mantendo uma fronteira clara para futura substituição por Supabase.

## Entidades mapeadas

Kitnet, Tenant, Contract, Receivable, Payment, Expense, Construction, CreditCard, Document, PersonalIncome, ExpertReport, ComplementaryProject e User.
