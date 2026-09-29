# Análise de usabilidade financeira — 28/09/2026

## Objetivo e alcance

Avaliar o aplicativo para responder: quanto gastei no mês em cada segmento, de onde vieram minhas entradas, quais custos cada atividade gerou e como meu patrimônio evolui.

Avaliação heurística baseada nas telas, rotas, formulários e serviços de cálculo do código atual. Não houve entrevista com usuários nem análise dos valores reais de produção nesta etapa. Os exemplos abaixo são ilustrativos. As recomendações não foram implementadas nesta análise.

Interpretação de “saídas em cada tipo de renda”: custos atribuídos à atividade que gera a receita, como manutenção das kitnets e deslocamento de uma perícia. Rastrear qual recebimento específico financiou uma compra é uma necessidade diferente, que exige uma regra explícita de alocação.

## Diagnóstico

O aplicativo tem uma base útil para controlar lançamentos e locações. Já existem consolidado por segmento, categorias, resultado por kitnet, extrato, previsão e conciliação. O principal problema é que essas partes ainda não formam uma jornada única de análise: o usuário precisa navegar entre telas, lembrar o período escolhido e interpretar totais com regras diferentes.

A prioridade é tornar os números coerentes e explicáveis. Gráficos adicionais só serão úteis depois dessa unificação.

## Achados prioritários

### 1. Totais com o mesmo significado aparente usam universos diferentes — crítico

- `src/services/dashboardService.ts:84` seleciona despesas do mês sem filtrar status. A interface em `src/modules/dashboard/pages/index.jsx:60` chama o resultado de “Despesas pagas” e “realizado neste mês”. Uma despesa pendente entra nesse indicador.
- `src/pages/FinancialOverview.jsx:72` também soma todas as despesas do mês no card superior; o bloco de caixa mais abaixo usa apenas despesas pagas.
- `src/services/categoryReportService.js:44` inclui transações de cartão positivas que não estejam ignoradas, inclusive aquelas em revisão. O consolidado inclui apenas confirmadas. A tela de categorias informa parte dessa regra, mas o total ainda não é comparável diretamente ao caixa.
- Dashboard não consulta PersonalIncome, então seus rótulos abrangentes de receita e resultado não representam todas as fontes pessoais, como salário.

Impacto: o usuário pode concluir que uma conta pendente já saiu do banco ou que seu salário não foi lançado. Correção recomendada: definir indicadores compartilhados e mostrar explicitamente “Pago/recebido”, “A pagar/receber” e “Compras no cartão”.

### 2. Atribuição ao segmento muda entre relatórios — crítico

`src/services/cashflowService.js:31` coloca todas as Expense pagas em kitnetsOut, sem consultar segment. Já `src/services/segmentConsolidationService.js` respeita o segmento da despesa.

Exemplo ilustrativo: um deslocamento de R$ 200 classificado como Perícias reduz o resultado das perícias no Consolidado, mas pode reduzir o resultado das kitnets no bloco de Caixa da Visão Geral. O resultado global pode coincidir enquanto a distribuição por atividade está errada.

Recomendação: uma mesma regra de classificação para Dashboard, Visão Geral, Consolidado, Categorias e Extrato. Despesas antigas sem classificação devem ser identificadas como herdadas/a revisar, em vez de parecerem classificadas com certeza.

### 3. O caminho “segmento → categoria → lançamento” está incompleto — alta

Consolidado permite abrir os lançamentos de um segmento, mas não apresenta despesas por categoria dentro dele, comparação mensal ou vínculo clicável com o registro original. Categorias agrega gastos sem filtro de segmento. Seus itens pessoais usam origem “cartão”/“pessoal”, o que não identifica a atividade beneficiada.

Recomendação: clicar em Kitnets → Saídas → Manutenção deve listar exatamente os gastos que compõem o total, permitindo abrir/corrigir cada um e voltar ao mesmo filtro. Cartão e conta são meios de pagamento; segmento informa a finalidade do gasto.

### 4. Período e vocabulário dificultam a navegação — alta

Dashboard e Visão Geral usam o mês atual. Consolidado, Categorias e Pessoal mantêm seus próprios estados de mês. Trocar de relatório pode perder o contexto escolhido. O hub financeiro contém Receitas, Recebimentos e Pagamentos; “Pagamentos” atualmente representa aluguéis recebidos, embora o nome costume sugerir dinheiro saindo.

Recomendação: filtro compartilhado de período e segmento, preservado na URL. Oferecer mês, trimestre, ano e últimos 12 meses. Usar nomes como Entradas, Saídas, Aluguéis a receber e Histórico de recebimentos. Separar a visão de análise da operação diária de cobranças.

### 5. O cadastro não oferece a mesma classificação em todos os caminhos — alta

Despesas permite Kitnets, Projetos, Perícias, Trabalho e Pessoal. Finanças Pessoais oferece contexto Pessoal, Trabalho, Kitnets e Obra, sem Projetos/Perícias no mesmo seletor. Sua categoria é texto livre. Isso aumenta a chance de custos equivalentes terminarem em grupos diferentes.

Recomendação: catálogo único de segmentos e categorias, com campos distintos para atividade, categoria, conta/cartão e vínculo opcional com imóvel/projeto/perícia. Permitir dividir uma despesa entre segmentos sem duplicar seu valor.

### 6. Há uma promessa de rateio que o relatório não cumpre — alta

Em `src/pages/Expenses.jsx`, a opção Geral diz “rateado entre as unidades”. Porém `src/pages/KitnetResult.jsx` e seu serviço deixam custos gerais separados, sem rateio.

Recomendação imediata: corrigir o texto para “Custo geral, sem rateio”. Para implementar rateio, oferecer critério visível e conferir se a soma distribuída coincide com o custo original. Mostrar resultado antes e depois do rateio.

### 7. Patrimônio ainda não tem suporte suficiente nos dados — alta

O cadastro de Kitnets tem valor de aluguel e características do imóvel, mas não avaliação patrimonial com data/histórico. Existem saldos bancários e marcadores de investimento/financiamento, porém não foi encontrado módulo que consolide bens, investimentos, dívidas e posições históricas.

O indicador “Investido na obra/kitnets” soma despesas pessoais confirmadas com contexto kitnets/obra. Ele não representa, sozinho, custo total de construção, valor atual dos imóveis ou patrimônio líquido.

Recomendação: criar cadastro patrimonial e histórico de posições antes de desenhar a curva de patrimônio. Não reconstruir avaliações passadas a partir de gastos de obra.

### 8. Confiabilidade e atualização precisam ficar visíveis — média

Visão Geral, Categorias e Exportar carregam dados na montagem, sem a assinatura de atualização existente em Consolidado. Algumas cargas não apresentam tratamento de erro, podendo deixar “Carregando...” sem orientação.

Recomendação: atualização consistente, botão de tentar novamente e indicação de última atualização. Diferenciar “nenhum lançamento”, “dados incompletos” e “falha de carregamento”. Mostrar quantidade e valor de lançamentos não classificados ou em revisão.

## Proposta de experiência

### Tela principal: Meu mês

Topo: período, segmento (Todos por padrão), modo Realizado ou Previsto, comparação com período anterior.

Primeira linha: Entrou no mês; Saiu no mês; Resultado do mês; Disponível nas contas. O disponível exige saldos conciliados e não deve ser calculado apenas como entradas menos saídas do período.

Segunda linha: tabela comparativa de Kitnets, Projetos, Perícias, Trabalho e Pessoal. Colunas: entradas, custos operacionais, aportes/investimentos em ativos, fluxo líquido e variação. Para Pessoal, preferir “saldo” a “lucro”. Definir a variação de cada coluna; se o período anterior for zero, mostrar diferença em reais, sem percentual infinito.

Cada número deve abrir sua composição. Manter ações de receber aluguel e lançar despesa acessíveis, mas colocar as pendências operacionais em um bloco próprio.

### Entradas por fonte

Agrupar aluguel, salário, projetos, perícias e outras receitas. Dentro de cada grupo, mostrar fontes individuais, recebidos, previstos e atrasados. Saldo inicial, empréstimos, transferências próprias, estornos e venda de ativos não devem ser confundidos com renda recorrente.

### Saídas por atividade

Combinar segmento e categoria. Exemplos: Kitnets → Manutenção; Perícias → Deslocamento; Projetos → Software; Pessoal → Alimentação.

Separar custos operacionais, aquisição/melhoria de ativos, juros e amortização de dívidas. Todos podem afetar o caixa, mas não representam a mesma coisa na análise da atividade e do patrimônio.

No cartão, oferecer a visão de compras/parcelas e a visão do dinheiro efetivamente pago. Vincular a quitação da fatura às compras para não contabilizar a mesma despesa duas vezes no mesmo indicador.

## Gráficos recomendados

| Pergunta | Visual | Interação |
|---|---|---|
| Onde gastei mais? | Barras horizontais por categoria | Filtrar segmento; abrir lançamentos |
| Qual atividade trouxe mais dinheiro? | Barras de entradas, saídas e resultado por segmento | Ordenar e abrir atividade |
| Minhas fontes de renda mudaram? | Colunas empilhadas por fonte, últimos 12 meses | Alternar reais e participação percentual |
| Estou gastando mais? | Série mensal de entradas e saídas | Comparar mês fechado com mês fechado |
| O que explica a diferença do mês? | Comparação das maiores altas/quedas por categoria | Mostrar diferença em reais e percentuais |
| Meu patrimônio cresceu? | Linha de patrimônio líquido e composição de ativos/dívidas | Ver posição, data e motivo da variação |

No celular: ranking curto, valores legíveis, detalhes por toque e tabela acessível como alternativa aos gráficos. Não depender apenas de cor ou hover. Exibir ano nos eixos quando o período atravessar anos. Mês em andamento deve ser identificado; para comparação justa, oferecer mesmo número de dias ou meses completos.

## Estrutura mínima para patrimônio

- Bens: nome, tipo, propriedade/percentual, custo de aquisição, data de aquisição, valor estimado e data/fonte da avaliação.
- Contas e investimentos: posição em uma data, com origem manual ou conciliada.
- Dívidas: saldo devedor na data, vínculo com bem quando houver e separação entre amortização e juros.
- Histórico: posições mensais e alterações de avaliação, sem substituir silenciosamente o passado.

Patrimônio líquido estimado = ativos registrados − dívidas registradas. Mostrar sempre a data e o grau de atualização. Separar aumento por aportes, reavaliações e redução de dívidas; movimentação entre contas próprias não aumenta o patrimônio total. Gastar R$ 30 mil em uma obra não prova valorização de R$ 30 mil.

## Ordem de implementação e critérios de aceite

1. **Coerência:** centralizar métricas e classificação. O mesmo período/segmento/regime deve resultar no mesmo total em qualquer tela. Um gasto pendente não entra em “pago”; transferência própria não entra em renda/despesa; cartão não duplica gasto.
2. **Jornada mensal:** Meu mês, filtro compartilhado e detalhamento dos totais. O usuário deve conseguir descobrir o gasto de manutenção das kitnets de um mês anterior sem refazer filtros nem somar manualmente.
3. **Comparação e evolução:** histórico de 12 meses, categorias por segmento e comparação entre períodos equivalentes. Todos os gráficos devem oferecer composição verificável.
4. **Patrimônio:** cadastro de bens/dívidas/posições e gráfico histórico. Valores sem avaliação não viram zero; aparecem como dados faltantes. Obra e financiamento não podem ser tratados automaticamente como lucro/prejuízo patrimonial.

Antes de desenvolver, validar o desenho com tarefas reais: “quanto sobrou das kitnets em agosto?”, “quanto custou cada perícia?”, “qual categoria aumentou?”, “quanto tenho disponível?” e “qual era meu patrimônio líquido no fechamento do mês?”. Medir se a pessoa conclui cada tarefa sem orientação e consegue explicar o que o número inclui.
