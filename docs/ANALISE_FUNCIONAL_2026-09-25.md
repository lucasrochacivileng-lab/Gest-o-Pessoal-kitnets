# Análise funcional do KitManager Pro

Data: 25/09/2026. Escopo: código disponível neste checkout, com foco nos fluxos de uso e na consistência dos dados.

O app cobre boa parte da rotina de locação e finanças, mas ainda contém caminhos que permitem perder dados, manter cobranças incompatíveis com os pagamentos e apresentar totais diferentes para a mesma movimentação. A prioridade deve ser corrigir essas relações antes de ampliar funcionalidades.

## Método e limites

- Leitura das rotas, formulários, serviços, persistência, testes existentes e migrations SQL relacionadas aos achados.
- Execução de cenários sintéticos em Node, usando funções extraídas dos arquivos do projeto e dependências controladas em memória. Isso valida regras específicas, não substitui testes de integração.
- No cenário de rescisão, o repositório simulado reproduziu a restrição de unicidade definida na migration. Não foi executado contra PostgreSQL.
- Não foram alterados dados reais, acessadas contas bancárias ou executadas mutações no Supabase.
- Não houve validação visual no navegador nem confirmação de quais migrations estão aplicadas em produção. Os achados de banco dependem de o ambiente seguir o esquema versionado.
- A análise não é uma certificação de segurança, contabilidade ou conformidade fiscal.

Prioridades: **P1** = corrigir antes de confiar no fluxo afetado; **P2** = corrigir na próxima rodada funcional. A prioridade considera impacto e cenário de uso, não afirma que o problema já ocorreu com seus dados.

## Achados prioritários

### 1. P1 — “Resetar base local” pode apagar registros remotos

**Cenário:** com Supabase ativo, o usuário abre Configurações e confirma o botão acreditando que limpará apenas o navegador.

**Comportamento:** o texto da confirmação fala em “dados salvos neste navegador”, mas chama o repositório selecionado. No cliente remoto, `resetData()` executa `DELETE` em `records` para todos os registros acessíveis ao usuário. Para um administrador, isso pode abranger toda a tabela. Não há cópia de segurança nesse caminho.

**Evidência:** `src/pages/Settings.jsx:91`; `src/repository/index.js:9`; `src/services/supabaseDataClient.js:74` e `:228`.

**Correção:** separar explicitamente limpeza local de exclusão remota; retirar esse comando remoto do botão atual e oferecer recuperação/backup no fluxo destrutivo apropriado.

### 2. P1 — Pagamentos podem ser editados ou excluídos sem atualizar a cobrança

**Cenário:** receber um aluguel pela tela Recebimentos e depois corrigir ou excluir o registro pela tela Pagamentos.

**Comportamento:** Pagamentos usa o formulário genérico, que chama `repository.create/update/removeSoft`. Esses caminhos não passam pela operação de baixa de recebível. Editar `paid_value` também preserva o `net_value` antigo, porque o cliente mescla os campos e esse formulário não recalcula o líquido.

**Reprodução em memória:** após mudar um pagamento de R$ 1.000 para R$ 700, seu `net_value` continuou em R$ 900. Após excluí-lo, a cobrança permaneceu `pago`, com `paid_value: 1000`.

**Impacto:** o histórico, o extrato e o saldo da cobrança podem divergir. Criar pagamento manual vinculado também não baixa automaticamente o recebível.

**Evidência:** `src/pages/Payments.jsx:5` e `:55`; `src/components/ui/EntityPage.jsx:226` e `:275`; `src/services/supabaseDataClient.js:106`. As migrations examinadas possuem auditoria, mas não recalculam o recebível em alterações genéricas de Payment.

**Correção:** usar operações específicas de correção/estorno com atualização conjunta do pagamento e da cobrança; preservar a trilha de auditoria.

### 3. P1 — Encerramento com multa conflita com o aluguel do mês

**Cenário:** contrato com carnê completo, saída antecipada em setembro e opção “Lançar a multa” habilitada.

**Comportamento:** a multa é um novo Receivable do mesmo contrato e da competência de setembro. O índice único considera apenas contrato e competência, sem distinguir aluguel de multa. Se o aluguel do mês continua ativo e não cancelado, o banco rejeita a multa, inclusive quando aquele aluguel já foi pago.

**Agravante:** antes de tentar criar a multa, o serviço já encerrou o contrato, removeu cobranças futuras e liberou a kitnet. A operação é composta por várias gravações independentes.

**Reprodução com restrição simulada:** a inclusão da multa falhou por duplicidade; o contrato ficou encerrado, a kitnet vaga e o inquilino inativo, sem multa criada.

**Evidência:** `src/modules/contracts/services/contractService.js:163` e `:206`; `supabase/migrations/20260713024420_financial_core_hardening.sql:66`.

**Correção:** definir uma identidade que permita tipos diferentes de cobrança na competência e executar todo o encerramento em uma transação. A criação da locação também merece atomicidade: atualmente pode deixar contrato salvo e carnê incompleto se uma gravação intermediária falhar.

### 4. P1 — Listagens e backups não paginam os registros

**Cenário:** a base cresce além do limite de linhas por resposta da API.

**Comportamento:** `list()`, `exportBackup()` e o snapshot de segurança da importação fazem uma consulta sem paginação. A configuração versionada limita respostas a 1.000 linhas. O limite efetivo remoto não foi inspecionado.

**Impacto:** uma entidade grande pode parecer ter menos registros; o backup pode ser parcial mesmo quando cada entidade isolada tem menos de 1.000 linhas, porque a exportação reúne toda a tabela. Ao importar esse arquivo, o app apaga os registros existentes antes de inserir o conteúdo parcial. O snapshot usado na restauração tem a mesma limitação.

**Evidência:** `src/services/supabaseDataClient.js:80`, `:157`, `:190` e `:204`; `supabase/config.toml:18`.

**Correção:** paginação com ordenação estável e conferência de contagem; importação com validação e substituição transacional. Não basta aumentar o limite da API.

### 5. P1 — Pix de aluguel confirmado na Caixa de Entrada não quita o aluguel

**Cenário:** chega um Pix de aluguel, o usuário seleciona centro de custo Kitnets e confirma.

**Comportamento:** a RPC gera `PersonalIncome`, tipo `income`, status `recebido`. O fluxo não permite selecionar nem quitar o recebível correspondente. O consolidado ainda classifica rendas dessa entidade como Trabalho ou Pessoal, ignorando `segment: kitnets` para receitas.

**Reprodução da classificação:** uma renda de R$ 1.000 com `context` e `segment` iguais a `kitnets` foi integralmente para Pessoal.

**Impacto:** o aluguel continua em aberto. Se o usuário também fizer a baixa em Recebimentos, a mesma entrada bancária poderá ser contabilizada duas vezes: uma como renda pessoal e outra como pagamento de aluguel.

**Evidência:** `src/pages/FinancialInbox.jsx:94`; `src/services/financialInboxService.js:68`; `supabase/migrations/20260717010849_confirm_uses_card_display_name.sql:59` e `:116`; `src/services/segmentConsolidationService.js:85`.

**Correção:** oferecer conciliação com recebível/pagamento existente e identificação única da movimentação bancária. Respeitar o segmento escolhido para receitas que legitimamente não correspondem a um recebível.

### 6. P2 — “Recebido no mês” não representa o dinheiro recebido

**Cenários reproduzidos:**

- Cobrança de R$ 1.000, pagamento parcial de R$ 400: resumo exibiu R$ 0.
- Cobrança quitada de R$ 1.000 com R$ 100 de desconto: resumo exibiu R$ 1.000, embora o pagamento líquido fosse R$ 900.

**Causa:** o resumo soma apenas recebíveis com status `pago`, usa a competência da cobrança e lê seus campos de valor. Já os pagamentos reais carregam data de pagamento e valor líquido próprios. O histórico anexado ao recebível não é utilizado nesse cálculo.

**Impacto adicional:** aluguel de agosto recebido em setembro pode aparecer no mês de agosto nesse card, enquanto o extrato registra setembro.

**Evidência:** `src/modules/receivables/services/receivableService.js:185` e `:195`; `src/modules/receivables/hooks/useReceivables.js:62`.

**Correção:** se o indicador significa entrada de caixa, somar Payment por data e líquido, incluindo parciais. Se significa quitação por competência, mudar o nome e apresentar separadamente o caixa recebido.

### 7. P2 — A previsão funde recorrências distintas e pode apagar meses anteriores

**Cenário A:** Água de R$ 100 na kitnet 1 e Água de R$ 150 na kitnet 2, ambas recorrentes.

**Resultado reproduzido:** a previsão trouxe somente R$ 150; deveria preservar as duas obrigações, totalizando R$ 250.

**Cenário B:** Internet recorrente de R$ 100 em setembro e R$ 120 em outubro; consultar setembro.

**Resultado reproduzido:** nenhuma dessas despesas apareceu em setembro. A função escolhe o registro mais recente globalmente e depois o descarta por ser futuro.

**Causa:** a chave das despesas na previsão é apenas descrição/categoria. O gerador de despesas usa outra regra, que também considera a kitnet. A escolha do modelo não é limitada ao mês consultado.

**Evidência:** `src/services/forecastService.js:16`, `:143` e `:145`; comparação com `src/services/recurringExpenseService.js:8`.

**Correção:** identificação estável de recorrência com segmento e vínculo; escolher o modelo vigente até o mês analisado e conciliar com as ocorrências já lançadas.

### 8. P2 — Demonstrativo de aluguel mistura despesas de outros segmentos

**Cenário:** cadastrar uma despesa paga de perícia ou projeto e abrir o demonstrativo anual.

**Comportamento:** as receitas são filtradas como pagamentos de aluguel, mas as despesas incluem todos os registros Expense pagos do ano, sem filtro de segmento. Despesas de cartão vinculadas às kitnets, armazenadas em PersonalIncome, ficam fora desse mesmo conjunto.

**Impacto:** o resultado apresentado não usa um recorte uniforme do negócio. O problema aqui é a seleção dos dados; esta análise não determinou quais despesas seriam dedutíveis tributariamente.

**Evidência:** `src/pages/Reports.jsx:63` e `:69`; `src/services/segmentConsolidationService.js:32`. A Visão Geral também agrupa todas as despesas diretas no campo `kitnetsOut` de `src/services/cashflowService.js:29`.

**Correção:** reutilizar uma definição única de segmento e origem dos lançamentos em relatórios, com rótulos claros para caixa, competência e finalidade do demonstrativo.

### 9. P2 — Trocar a conta padrão do contrato não atualiza o carnê já criado

**Cenário:** contrato criado com conta A; depois o usuário muda a conta padrão para B. A tela informa que os próximos recebimentos usarão a nova conta.

**Comportamento:** o carnê completo já copiou a conta A para cada cobrança. O formulário prioriza a conta da cobrança e só recorre ao contrato se ela estiver vazia. Assim, recebimentos futuros continuam pré-selecionando A.

**Evidência:** `src/modules/contracts/pages/index.jsx:262`; `src/modules/receivables/services/receivableService.js:76` e `:264`; `src/modules/receivables/components/ReceivableForm.jsx:103`.

**Correção:** propagar a alteração para cobranças futuras em aberto, preservando histórico, ou distinguir explicitamente conta fixa da cobrança e conta padrão dinâmica.

### 10. P2 — Multa configurada como zero volta a três aluguéis

**Cenário:** informar zero no campo que aceita mínimo zero.

**Comportamento:** o serviço usa `Number(valor) || 3` na gravação e no cálculo. Zero é tratado como ausência.

**Reprodução:** `calculateBreakFine` com `fine_months: 0` retornou `fineMonths: 3`.

**Impacto:** o app pode sugerir multa onde o cadastro pretendia estabelecer nenhuma. O usuário ainda pode desmarcar a cobrança, mas o valor apresentado está errado.

**Evidência:** `src/modules/contracts/services/contractService.js:51` e `:131`; `src/modules/contracts/pages/index.jsx:449`.

**Correção:** diferenciar campo vazio de zero explícito e preservar esse valor no cálculo.

### 11. P2 — Recorrências perdem a conta bancária

**Cenário:** gerar o próximo mês de uma despesa ou renda que já tem conta bancária definida e depois confirmá-la como paga/recebida.

**Comportamento:** os geradores não copiam `bank_account_id`. A despesa copia um campo antigo `account`, que não é a chave usada pela conciliação.

**Reprodução:** Internet com conta `b1` gerou a próxima ocorrência sem `bank_account_id`.

**Impacto:** a movimentação aparece nos totais, mas não compõe o saldo calculado da conta até ser vinculada manualmente. O aviso de lançamentos sem conta ajuda a localizar o problema, mas não evita o retrabalho.

**Evidência:** `src/services/recurringExpenseService.js:47`; `src/services/recurringIncomeService.js:58`; `src/services/cashReconciliationService.js:32`.

**Correção:** preservar a conta no modelo de recorrência e permitir atualização explícita do padrão.

### 12. P2 — A edição do locatário ficou sem rota acessível

**Cenário:** inquilino muda de telefone ou o usuário precisa corrigir um CPF digitado no cadastro.

**Comportamento:** existem componentes de cadastro/edição de Tenant, mas `/locatarios` redireciona para Locações. A tela de Locações oferece criação, anexos, conta de recebimento e encerramento, sem edição dos dados do inquilino existente.

**Impacto:** a pessoa consegue cadastrar, mas não encontra um fluxo acessível para manter o cadastro atualizado; cobranças por WhatsApp podem continuar apontando para o número antigo.

**Evidência:** `src/app/routes/AppRoutes.jsx:95`; `src/pages/Tenants.jsx`; `src/modules/tenants/pages/index.jsx`; ações em `src/modules/contracts/pages/index.jsx`.

**Correção:** expor “Editar locatário” nos detalhes da locação ou reativar uma rota de cadastro própria, sem duplicar o inquilino.

## Outros pontos de uso a planejar

- **Renovação e reajuste:** não foi localizado um fluxo dedicado na tela de Locações para renovar, reajustar valores futuros e manter histórico. Tratar como evolução funcional, não como prova de defeito em regra já implementada.
- **Falha de conexão:** páginas como Locações e Kitnets não finalizam o estado de carregamento quando a busca inicial rejeita. Acrescentar mensagem, recuperação e botão de nova tentativa.
- **Backup completo:** o JSON atual cobre `records`. Não inclui o conteúdo dos PDFs no Storage remoto nem tabelas separadas como `transactions`, `notifications` e `audit_log`. Explicitar esse escopo na interface ou ampliar a estratégia de recuperação.
- **Uso sem internet:** a instalação PWA existe, mas não foi identificada uma fila de gravações remotas offline. Diferenciar “app instalado” de “dados disponíveis sem conexão” na experiência.
- **Cadastros monetários:** evitar transformar entrada negativa silenciosamente em zero; mostrar uma validação explícita ao usuário.

## Aspectos positivos observados

- Separação de serviços e repositório facilita centralizar regras sem reescrever todas as telas.
- A baixa normal de recebível tem RPC transacional, identificador para repetição segura e validação da resposta.
- Há cálculo monetário em centavos nos fluxos centrais e testes específicos para vários serviços.
- Há tratamento explícito de recebíveis cancelados e de pagamentos parciais vencidos.
- A conciliação bancária distingue compra no cartão de pagamento da fatura e identifica lançamentos sem conta.
- Documentos têm validação de tamanho e abertura por URL assinada quando estão no Storage.
- O código SQL prevê controle de acesso por papel e auditoria. A configuração efetiva em produção não foi verificada nesta análise.

## Ordem sugerida de trabalho

1. Proteger reset e recuperação de dados; completar paginação e backup.
2. Unificar criação, correção e estorno de pagamentos; corrigir rescisão transacional.
3. Conciliar Pix importado com recebíveis existentes, evitando dupla contabilização.
4. Alinhar resumos, previsões e relatórios com definições compartilhadas.
5. Corrigir conta padrão, multa zero, recorrências e edição do locatário.
6. Depois, desenvolver renovação/reajuste e melhorar estados de erro e uso no celular.

## Situação da validação automatizada

- `pnpm test` não iniciou a suíte: o gerenciador tentou reinstalar dependências e abortou por ausência de TTY (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`).
- `npm run test -- --reporter=dot` e `npm run build`: iniciaram, mas não concluíram após vários minutos neste ambiente. Foram interrompidos. O build chegou a anunciar `vite v5.4.21 building for production...`; a suíte não apresentou resultados. Não há aprovação nem reprovação funcional atribuível a essas execuções. A causa da lentidão não foi determinada.
- Os cenários isolados descritos acima foram executados com dados sintéticos. Não alteraram arquivos de código ou dados reais.
- Os testes atuais usam ambiente Node e selecionam `src/**/*.test.js`; essa configuração não executa automaticamente os testes SQL e o teste TypeScript da Edge Function.
