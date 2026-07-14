# Fonte oficial de dados

Data do inventario: 12/07/2026. Contagens obtidas diretamente no projeto Supabase `ngtazecajkiescyxlqou`.

## Decisao atual

`public.records` e a fonte oficial do aplicativo atual. Todo acesso do frontend passa por `src/repository/index.js` e `src/services/supabaseDataClient.js`; a unica excecao operacional e a RPC `register_receivable_payment`, que tambem grava em `records`. Nenhum componente, hook ou service consulta diretamente as tabelas relacionais legadas. Nao existem views ou Edge Functions no repositorio.

As tabelas relacionais continuam protegidas por RLS e podem ser usadas por integracoes externas ou rotinas antigas fora deste repositorio. Por isso nao serao removidas, sincronizadas nem consideradas vazias apenas com base no frontend.

## Inventario

| Entidade | Fonte usada pelo frontend | Tabela legada | `records` total/ativo | Legada nao excluida | Dependencias principais | Recomendacao |
| --- | --- | --- | ---: | ---: | --- | --- |
| Propriedades/kitnets | `records:Kitnet` | `properties` | 10/10 | 10 | contratos, locatarios, recebiveis, pagamentos, despesas, documentos | Permanecer em `records`; candidata posterior, depois de contratos |
| Locatarios | `records:Tenant` | `tenants` | 10/9 | 9 | contratos, recebiveis, pagamentos, documentos | Permanecer em `records`; preservar exclusao logica |
| Contratos | `records:Contract` | `contracts` | 10/10 | 10 | kitnet, locatario, recebiveis, documentos | Permanecer em `records` ate reconciliar chaves |
| Recebiveis | `records:Receivable` | `receivables` | 131/131 | 60 | contrato, kitnet, locatario, pagamentos | Fonte oficial `records`; primeira candidata relacional junto com pagamentos |
| Pagamentos | `records:Payment` + RPC | `payments` | 13/13 | 9 | recebivel, kitnet, locatario, conta bancaria | Fonte oficial `records`; migrar atomicamente com recebiveis |
| Despesas | `records:Expense` | `expenses` | 60/59 | 22 | kitnet, segmento, projeto/pericia | Permanecer temporariamente em `records` |
| Receitas | `records:PersonalIncome` | `personal_finances` | 303/218 | 94 | cartao, conta, contexto/segmento | Permanecer temporariamente em `records`; modelo atual e mais rico |
| Cartoes | `records:CreditCard` + `PersonalIncome` | `credit_cards` | 4/4 | 3 | importacoes, parcelas e receitas pessoais | Permanecer em `records` |
| Documentos | `records:Document` | `documents` | 10/10 | 10 | kitnet, contrato, locatario | Permanecer em `records`; validar Storage antes de migrar |
| Notificacoes | `records:Notification` e `NotificationEvent` | `notifications`, `notification_events` | 16/16 | 6 | despesas, recebiveis, contratos | Permanecer em `records`; tabela legada esta defasada |

Outras entidades apenas em `records` ou sem equivalente direto relevante: `BankAccount`, `BankMovement`, `ComplementaryProject`, `ExpertReport`, `Construction`, `ImportBatch` e `Loan`.

## Evidencia de uso

- `supabaseDataClient` faz todas as operacoes CRUD em `public.records`.
- `dashboardRepository` apenas delega para o repository generico.
- Dashboard, Visao Geral, Consolidado, Extrato, Caixa, Previsao e relatorios listam entidades pelo repository.
- Contratos criam contrato, locatario e carne em `records`.
- Recebimentos usam `records` e a RPC transacional.
- Testes unitarios usam o mesmo contrato do repository em modo local.
- Migrations mantem tabelas relacionais anteriores, `records`, Realtime, RLS e RPCs.
- Nao ha `supabase/functions`, views versionadas ou consultas diretas a tabelas legadas no frontend.

## Estrategia proposta

1. **Fonte oficial atual:** declarar `records` como autoritativa no codigo e na operacao ate um corte formal.
2. **Legado:** congelar escrita das tabelas relacionais pelo aplicativo; nao apagar enquanto uso externo nao for descartado.
3. **Permanencia temporaria:** manter todas as entidades atuais em `records`; nao criar sincronizacao bidirecional improvisada.
4. **Primeira candidata:** migrar `Receivable` e `Payment` como um unico agregado, pois concentram maior risco e ja possuem RPC transacional.
5. **Leitura dupla:** criar um adapter somente leitura, atras de flag, que compare por ID e regras de negocio sem alterar a resposta ao usuario.
6. **Conciliacao:** comparar contagem, IDs, contrato/competencia, valores em centavos, status, soma de pagamentos e datas; gerar relatorio de divergencias.
7. **Corte:** importar snapshot para tabelas tipadas, congelar brevemente escrita, reconciliar novamente, ativar adapter relacional e monitorar.
8. **Rollback:** manter `records` intacta, desligar a flag e voltar ao adapter atual; eventos novos devem possuir identificador comum para replay.
9. **Aposentadoria:** somente depois de dois ciclos mensais conciliados, remover escrita de cada entidade de `records`; exclusao fisica fica fora do plano.

## Regra contra novas duplicidades

Nenhuma funcionalidade nova deve gravar simultaneamente em `records` e tabela legada sem um desenho de outbox/idempotencia, reconciliacao automatizada e rollback testado. A leitura comparativa futura nao autoriza escrita dupla.
