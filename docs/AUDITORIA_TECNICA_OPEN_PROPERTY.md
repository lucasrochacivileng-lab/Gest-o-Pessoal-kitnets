# Auditoria tecnica: Gestao Residencial Rocha x Open Property

Data da analise: 12/07/2026

## Resumo executivo

O aplicativo atual e funcionalmente mais completo para a operacao real de Lucas: possui gestao de kitnets, contratos, recebimentos, pagamentos parciais, receitas profissionais, despesas, cartoes, extrato, caixa e conciliacao, previsao, documentos, notificacoes e PWA. O Open Property e uma boa referencia visual e de modelagem para manutencao, fornecedores, detalhe do locatario e ledger, mas nao e uma base mais madura: o repositorio analisado tem um unico commit, nenhum teste automatizado e exclusoes destrutivas em cascata.

A principal divida tecnica do aplicativo atual e a coexistencia de dois modelos de dados no Supabase. Existem tabelas relacionais legadas normalizadas, mas a interface em producao le e grava na tabela generica `records`, com o objeto em JSONB. Essa decisao acelerou a evolucao do produto, porem deslocou validacao, relacionamentos, unicidade e transacoes para JavaScript. A recomendacao e fortalecer `records` gradualmente e planejar uma migracao controlada, sem trocar React, Supabase ou Vercel e sem reescrever o produto.

## Escopo e evidencias

- Projeto atual: 76 commits, 130 arquivos em `src`, 29 arquivos de teste antes desta entrega.
- Open Property: commit `ad2f7d7`, 56 arquivos no total, sem suite de testes.
- Banco de producao: PostgreSQL 17, RLS ativo, 10 propriedades, 10 locatarios, 10 contratos e 60 recebiveis nas tabelas relacionais legadas; a interface atual usa `records`.
- Validacao executada contra codigo, migrations, RLS, dados reais, Supabase Advisors e implementacao do Open Property.

## O que o projeto atual faz melhor

1. Fluxo financeiro adaptado ao Brasil: Pix, boleto, cartoes, competencias, multa, juros, desconto, recibos e contas de destino.
2. Receitas alem de aluguel: projetos complementares, pericias e financas pessoais integradas ao extrato.
3. Conciliação de caixa, previsao, consolidado por segmento e resultado por kitnet.
4. Lembretes, notificacoes e mensagens de WhatsApp para cobranca.
5. Exclusao logica e backup/importacao com tentativa de restauracao, preservando melhor o historico.
6. Cobertura automatizada significativa para regras financeiras e regressões recentes.
7. Autenticacao Supabase e RLS por papel, ausentes no projeto de referencia.

## O que vale aproveitar do Open Property

1. Ordens de manutencao com prioridade, status, unidade, prestador, agenda e custo.
2. Cadastro de fornecedores por especialidade e contato.
3. Pagina detalhada do locatario com contrato ativo e historico.
4. Dashboard orientado a acoes: manutencoes abertas e contratos proximos do vencimento.
5. Validacao de entrada com schema e estados vazios consistentes.
6. Unicidade de cobranca por contrato e periodo garantida pelo banco.

## O que nao deve ser copiado

1. Cloudflare Workers, D1, Hono e roteamento manual: nao trazem beneficio que justifique trocar Supabase e React Router.
2. Colunas `REAL` para valores financeiros: mantem risco de ponto flutuante.
3. Exclusoes fisicas em cascata de imovel, unidade, contrato, cobranca e pagamento: inadequadas para auditoria financeira.
4. Pagamento dividido em INSERT, SUM e UPDATE sem transacao explicita.
5. Tratamento que converte falhas de consultas do dashboard em zero/lista vazia, escondendo indisponibilidade como se fosse ausencia de dados.
6. Adocao direta de um projeto com um commit e sem testes como fundamento arquitetural.

## Riscos encontrados no projeto atual

### Criticos

- Antes desta entrega, criar `Payment` e atualizar `Receivable` eram duas requisicoes independentes. Uma falha intermediaria podia deixar pagamento sem baixa ou baixa sem resposta coerente.
- A regra de uma cobranca por contrato/competencia existia apenas em memoria. Duplo clique, duas abas ou concorrencia podiam gerar duplicidade.
- O numero de recibo era calculado contando linhas no cliente, sujeito a colisao concorrente.

### Altos

- `records` JSONB nao possui FKs entre contrato, kitnet, locatario, recebivel e pagamento.
- Ainda ha muitos calculos financeiros com `Number`; a conversao completa para centavos deve ser incremental e coberta por testes.
- Auditoria grava `local-user` em varios fluxos em vez do UUID autenticado.
- Tabelas relacionais legadas e `records` coexistem, aumentando confusao operacional e risco de consultas na fonte errada.

### Medios

- Nao ha script de lint nem typecheck para a maior parte JavaScript do frontend.
- Varios `catch` silenciosos dificultam distinguir lista vazia de erro de rede/permissao.
- Formulario generico concentra regras de muitos dominios e torna validacoes especificas menos claras.
- O Supabase Advisor informa protecao contra senhas vazadas desativada.
- Tres funcoes auxiliares de papel usam `SECURITY DEFINER` e permanecem executaveis por autenticados porque as policies dependem delas; a exposicao RPC deve ser removida em uma revisao dedicada das policies.

## Melhorias implementadas nesta entrega

1. RPC `register_receivable_payment` com `SECURITY INVOKER`, RLS preservado e permissao apenas para autenticados.
2. Pagamento, baixa do recebivel, status e recibo agora sao produzidos na mesma transacao PostgreSQL.
3. Bloqueio transacional por ano impede colisao na numeracao sequencial de recibos.
4. Indice unico parcial impede recebiveis ativos duplicados por contrato e competencia, sem bloquear lancamentos manuais incompletos antigos.
5. Calculos criticos de pagamento e saldo passaram a usar centavos inteiros no frontend.
6. No modo local, uma falha na baixa tenta desfazer logicamente o pagamento criado.
7. Testes cobrem precisao monetaria e a chamada do RPC.

## Plano priorizado

| Prioridade | Melhoria | Impacto | Esforco | Risco |
| --- | --- | --- | --- | --- |
| P0 | Transacao de pagamento, recibo concorrente e unicidade de cobranca | Muito alto | Medio | Medio | 
| P1 | Identidade real em `created_by`/`updated_by` e trilha de alteracoes | Alto | Medio | Baixo |
| P1 | Definir `records` como fonte oficial e arquivar/conciliar tabelas legadas | Alto | Medio | Medio |
| P1 | Migrar todos os calculos monetarios para centavos/numeric | Alto | Medio | Medio |
| P1 | Ordens de manutencao e fornecedores integrados a kitnet/despesa | Alto | Medio | Baixo |
| P2 | Detalhe do locatario com contrato, recebimentos, documentos e ocorrencias | Medio | Medio | Baixo |
| P2 | Validacao por schema nos formularios financeiros | Medio | Medio | Baixo |
| P2 | Lint, typecheck gradual e tratamento visivel de erros | Medio | Medio | Baixo |
| P3 | Portal do locatario, anexos de manutencao e automacoes externas | Medio | Alto | Medio |

## Arquitetura alvo incremental

1. Manter React/Vite, Supabase, Vercel, React Router e a identidade visual atual.
2. Continuar usando `records` no curto prazo, adicionando indices, RPCs transacionais e validacoes para fluxos criticos.
3. Criar novas tabelas relacionais apenas para modulos que realmente se beneficiem de integridade forte, como manutencao e trilha de auditoria.
4. Migrar entidades financeiras de JSONB para tabelas tipadas em fases, com leitura dupla temporaria, conciliacao, corte controlado e rollback documentado.
5. Nunca excluir historico financeiro fisicamente; usar inativacao, estorno e eventos de auditoria.

## Criterios para a proxima fase

- Nenhuma divergencia entre pagamento, recebivel, extrato e caixa.
- Todo valor financeiro testado em centavos e persistido como `numeric` ou inteiro.
- Toda alteracao relevante identifica usuario e horario.
- Manutencao permite abrir, priorizar, atribuir, concluir e vincular custo a uma despesa.
- Build, testes, verificacao mobile/desktop e Supabase Advisors sem novos alertas causados pela entrega.
