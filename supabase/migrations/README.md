# Migrations

O número do arquivo é a **ordem de aplicação**, e ela reproduz a ordem real em
que as migrations rodaram no projeto `ngtazecajkiescyxlqou`. Aplicar os arquivos
em sequência num banco vazio produz o mesmo esquema que está em produção.

| Arquivo | `version` aplicada | Quando |
|---|---|---|
| `0001_records` | 20260708102302 | 08/07 10:23 |
| `0002_realtime` | — | publicação Realtime, aplicada pelo SQL Editor |
| `0003_security_hardening` | — | aplicada antes do rastreamento por version |
| `0004_receivable_integrity` | 20260713014942 | 13/07 01:49 |
| `0005_financial_core_hardening` | 20260713024420 | 13/07 02:44 |
| `0006_financial_notification_inbox` | 20260715003806 | 15/07 00:38 |
| `0007_financial_inbox_confirm_fix` | 20260715004111 | 15/07 00:41 |
| `0008_financial_inbox_boleto` | 20260715013755 | 15/07 01:37 |
| `0009_internal_transfer_reconciliation` | 20260715015308 | 15/07 01:53 |
| `0010_bank_notification_accounts` | 20260716022644 | 16/07 02:26 |
| `0011_card_invoice_due_date_helper` | 20260717010725 | 17/07 01:07 |
| `0012_notification_purchase_uses_invoice_month` | 20260717010803 | 17/07 01:08 |
| `0013_fix_card_name_fallback_on_confirm` | 20260717010818 | 17/07 01:08 |
| `0014_confirm_uses_card_display_name` | 20260717010849 | 17/07 01:08 |
| `0015_revoke_anon_records_privileges` | 20260811… | 11/08 |

## Por que a ordem importa aqui

`confirm_financial_inbox_transaction` é redefinida por **quatro** migrations
(0006, 0007, 0012 e 0014). Quem vale é a última a rodar. Trocar a ordem dos
arquivos faz um banco reconstruído do zero ficar com uma versão diferente da que
está em produção — sem erro nenhum na aplicação, o que torna a falha silenciosa.

O mesmo vale para `ignore_financial_inbox_transaction`, definida na 0007 e
redefinida na 0009.

## Como conferir se o repositório está fiel ao banco

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

Toda linha dessa consulta precisa ter um arquivo correspondente aqui, na mesma
ordem relativa. Cinco migrations chegaram a existir só no banco (a 0007 e as
0011 a 0014) e foram recuperadas a partir de `schema_migrations.statements` —
se você aplicar algo pelo SQL Editor ou pelo MCP, crie o arquivo junto.

## Ao adicionar uma migration nova

Use o próximo número livre e **não renumere as existentes**: os números já
publicados são referência em commits e na documentação.
