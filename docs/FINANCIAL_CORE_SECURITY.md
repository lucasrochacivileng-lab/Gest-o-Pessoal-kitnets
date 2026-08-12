# Seguranca, auditoria e dinheiro

## Revisao dos commits 0034946 e 15d8f89

A transacao original era realmente atomica dentro da RPC e usava `SECURITY INVOKER`, `SELECT FOR UPDATE`, advisory lock e RLS. O indice parcial impedia duplicidade ativa por contrato/competencia. Foram encontrados, porem, cinco pontos pendentes:

1. pagamento negativo e acima do saldo eram aceitos;
2. `net_value`, status e identidade ainda chegavam do frontend;
3. recibo nao possuia indice unico proprio;
4. frontend nao validava a estrutura retornada pela RPC;
5. `local-user` ainda podia ser persistido em producao.

A migration `0005_financial_core_hardening.sql` corrige esses itens, preserva a assinatura da RPC e mantem pagamento zero por compatibilidade com o fluxo existente de mes perdoado. Recebivel inativo ou cancelado nao pode ser pago. Recebivel cancelado deixa de ocupar a chave unica; inativado ja era excluido pelo predicado `active`.

### Regras adicionais da revisao do PR

- `contract_id`, `kitnet_id`, `tenant_id`, `competence` e `receivable_id` sao sempre derivados do recebivel bloqueado. Valores homonimos enviados pelo cliente sao descartados.
- A conta de destino enviada continua editavel; quando vazia, herda o padrao do recebivel e, por ultimo, `Mercado Pago`.
- `p_payment_id` e chave de idempotencia. Retry equivalente retorna pagamento e recibo existentes sem nova baixa; reuso incompativel retorna `PAYMENT_IDEMPOTENCY_CONFLICT`.
- Valor liquido segue `pago - desconto + multa + juros` e nao pode ser negativo. Desconto integral, com liquido zero, continua valido.
- `audit_origin` enviado em JSON e ignorado e removido. CRUD comum registra `data_api`; somente a RPC controlada registra `register_receivable_payment`.
- Justificativa de auditoria e aparada, limitada a 500 caracteres e removida do JSON operacional.

## Autorizacao e RLS

- A RPC exige `auth.uid()` e roda como `SECURITY INVOKER`.
- O `SELECT ... FOR UPDATE` so encontra linhas visiveis pela policy de `records`.
- `anon` nao possui `EXECUTE`; `authenticated` possui.
- Usuario autenticado sem perfil ativo nao passa por `is_admin/can_manage_kitnets` e nao enxerga o recebivel.
- O papel `KITNET_MANAGER` pode operar entidades de kitnet, inclusive recebiveis e pagamentos, conforme regra existente.
- A policy atual e por papel e entidade, nao por `owner_id`; isso e adequado aos dois papeis operacionais atuais, mas nao suporta isolamento entre varios proprietarios.

### Perfil e papel

A policy anterior permitia atualizar a propria linha inteira de `profiles`, inclusive `role` e `active`. RLS protege linhas, nao colunas, portanto isso permitia autoelevacao. A migration revoga INSERT/UPDATE/DELETE direto de `authenticated` e concede UPDATE somente para `name` e `avatar_url`. Alteracoes de `role` e `active` passam pela RPC `admin_update_profile_access`, que valida `is_admin()` no servidor. `anon` nao possui grants na tabela.

## SECURITY DEFINER

`current_app_role`, `is_admin` e `can_manage_kitnets` precisam ler `profiles` durante a avaliacao de RLS. Elas continuam `SECURITY DEFINER`, com `search_path` fixado em `pg_catalog, public`, sem argumentos e retornando apenas papel/booleano. A execucao por `anon` permanece revogada. O Advisor ainda pode alertar que autenticados conseguem chama-las diretamente; revogar `authenticated` quebraria as policies atuais. A correcao futura recomendada e mover as funcoes para schema privado nao exposto e atualizar todas as policies em uma migration dedicada.

`write_record_audit` tambem e `SECURITY DEFINER` para inserir numa tabela sem permissao de escrita ao usuario. E uma trigger function sem endpoint de negocio, possui `search_path=''` e `EXECUTE` revogado de `public`, `anon` e `authenticated`.

As policies de leitura e atualizacao de `profiles` passam a usar `(select auth.uid())`, evitando recalculo por linha indicado pelo Performance Advisor sem mudar a autorizacao.

## Trilha de auditoria

`audit_log` registra UUID do ator via `auth.uid()`, horario do servidor, entidade, ID, acao, antes, depois, origem e justificativa. Abrange `Payment`, `Receivable`, `Contract` e `Expense`, incluindo criacao, atualizacao, exclusao logica, cancelamento e estorno. Campos de contato, documentos, anexos e observacoes sao omitidos dos snapshots.

Usuarios comuns nao podem inserir, alterar ou excluir auditoria. Apenas ADMIN pode ler. O trigger de identidade substitui `created_by/updated_by` por `auth.uid()` e remove metadados internos antes da persistencia. `local-user` fica restrito ao `localClient`, onde representa corretamente o modo sem Supabase.

## Convencao monetaria

- Entrada de formulario e JSONB e convertida imediatamente com `toCents`.
- Calculos internos criticos usam centavos inteiros.
- Saida para UI usa `fromCents` e `financialService.formatCurrency`.
- Banco relacional deve usar `numeric`; a RPC converte JSONB para centavos antes de calcular.
- Comparacoes de saldo usam centavos, nunca igualdade direta de `float`.
- Arredondamento e para o centavo mais proximo via `Math.round` no frontend e `round(numeric * 100)` no PostgreSQL.
- Valores negativos so sao permitidos em resultados/saldos; campos de pagamento, desconto, multa e juros sao nao negativos.

Nesta fase foram convertidos pagamento, formulario de recebimento, extrato, caixa e formatacao central. Permanecem usos de `Number` em relatorios, previsao, cartoes, despesas, consolidado e contratos; a conversao deve continuar por service, com testes, sem reescrita massiva.

## Erros

O formulario agora aguarda a operacao, bloqueia duplo envio e mostra erro de validacao, sessao, permissao, rede ou banco sem exibir SQL. Uma resposta RPC incompleta ou inconsistente e tratada como falha, nunca como sucesso. Falha ao carregar contas bancarias e distinta de uma lista legitimamente vazia.

## Protecao contra senhas vazadas

O Advisor indica que a protecao de senhas comprometidas esta desativada. Isso e configuracao de Auth externa a migrations. Procedimento recomendado: Supabase Dashboard > Authentication > Attack Protection > habilitar leaked password protection, revisar impacto no plano e testar login/troca de senha. Nenhuma configuracao externa foi alterada nesta entrega.

## Integracao continua

`.github/workflows/pull-request.yml` executa `npm ci`, `npm test` e `npm run build` em todo Pull Request para `main`, sem secrets do Supabase. Os testes SQL autenticados permanecem separados porque dependem de PostgreSQL com RLS e claims configurados.
