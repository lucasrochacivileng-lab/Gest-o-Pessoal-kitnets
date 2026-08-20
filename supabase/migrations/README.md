# Migrations do Supabase

Esta pasta é a fonte versionada do schema usado pela aplicação. Os arquivos
seguem o formato `<timestamp>_<nome>.sql` aceito pela Supabase CLI e são
aplicados em ordem crescente.

## O que foi normalizado

O projeto começou sobre um banco que já continha `profiles`, `notifications`, o
tipo `app_role` e os helpers de autorização. As migrations antigas começavam em
`records`, portanto falhavam num projeto vazio. A migration
`20260708090000_application_foundation.sql` materializa essas dependências.

As versões abaixo vieram diretamente do histórico remoto que estava registrado
no repositório:

| Migration | Versão remota original |
|---|---:|
| `records` | `20260708102302` |
| `receivable_integrity` | `20260713014942` |
| `financial_core_hardening` | `20260713024420` |
| `financial_notification_inbox` | `20260715003806` |
| `financial_inbox_confirm_fix` | `20260715004111` |
| `financial_inbox_boleto` | `20260715013755` |
| `internal_transfer_reconciliation` | `20260715015308` |
| `bank_notification_accounts` | `20260716022644` |
| `card_invoice_due_date_helper` | `20260717010725` |
| `notification_purchase_uses_invoice_month` | `20260717010803` |
| `fix_card_name_fallback_on_confirm` | `20260717010818` |
| `confirm_uses_card_display_name` | `20260717010849` |

`realtime` e `security_hardening` haviam sido aplicadas pelo SQL Editor, sem
entrada em `supabase_migrations.schema_migrations`; receberam versões locais
imediatamente posteriores a `records`. As migrations de 19/08 são idempotentes
e registram no histórico os grants que já eram necessários em produção.

## Reconstrução local

Pré-requisito: Docker em execução.

```powershell
npx supabase start
npx supabase db reset
npx supabase test db
```

`db reset` precisa terminar sem objetos preexistentes. O seed cria somente os
dois perfis determinísticos utilizados pelos testes de RLS; não contém senha,
token nem dado de produção.

## Conferência com o projeto remoto

Depois de autenticar e vincular a CLI ao projeto correto:

```powershell
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

O `dry-run` é obrigatório antes do primeiro push após esta normalização. Não use
`migration repair` nem renomeie migrations já aplicadas sem revisar a lista
local/remota completa.

## Regra daqui em diante

- Criar toda migration com `supabase migration new <nome>`.
- Nunca aplicar alteração apenas pelo SQL Editor.
- Todo PR que altera `supabase/` deve reconstruir o banco e executar os testes.
- Mudanças remotas só são promovidas depois de passarem em local ou staging.
