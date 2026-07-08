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

O acesso aos dados passa por `src/repository/index.js`. Com as variáveis `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` configuradas (ou os padrões embutidos), os dados vivem na tabela `records` do Supabase, com login via Supabase Auth. Defina `VITE_SUPABASE_DISABLE=true` para forçar o modo local (`localStorage` com seed em memória).

## PWA (instalar no celular)

O app é um PWA: no celular, abra o site no navegador e use "Adicionar à tela inicial" (Android/Chrome mostra o aviso de instalação automaticamente). Os ícones ficam em `public/icons` e o manifest/service worker são gerados pelo `vite-plugin-pwa` no build. O service worker atualiza sozinho a cada novo deploy.

## Sincronização em tempo real

Com Supabase ativo, as telas escutam mudanças na tabela `records` (Supabase Realtime) e recarregam sozinhas quando outro dispositivo cria/edita registros. Para funcionar, a tabela precisa estar na publicação `supabase_realtime` — aplique `supabase/migrations/0002_realtime.sql` no SQL Editor do projeto Supabase (uma única vez).

## Publicar na Vercel

1. Importe o repositório do GitHub em [vercel.com/new](https://vercel.com/new) (framework: Vite; build `pnpm build`; output `dist`).
2. O `vercel.json` já contém o rewrite de SPA para as rotas do React Router funcionarem em acesso direto.
3. Cada push na branch `main` gera um deploy automático.

## Entidades mapeadas

Kitnet, Tenant, Contract, Receivable, Payment, Expense, Construction, CreditCard, Document, PersonalIncome, ExpertReport, ComplementaryProject e User.
