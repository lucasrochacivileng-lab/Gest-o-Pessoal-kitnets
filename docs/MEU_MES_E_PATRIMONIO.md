# Meu mês e patrimônio

Implementação local validada em 29/09/2026. Não publicada em produção.

## O que mudou

- A página inicial agora é **Meu mês**. O painel das locações continua em **Operação das locações**.
- Entradas, gastos e resultado usam uma base comum de movimentos confirmados. A mesma base alimenta o consolidado, categorias, resultado por kitnet e exportação anual.
- O mês é preservado na navegação. Meu mês, categorias e exportação permitem selecionar o segmento: kitnets, projetos, perícias, trabalho ou pessoal.
- Os totais e categorias abrem sua composição; cada linha permite acessar o registro de origem para conferência ou edição.
- Gráficos mostram entradas e gastos, resultado e composição das entradas nos últimos 12 meses. Há tabelas com os valores dos gráficos.
- Comparações exibem diferença monetária e percentual. Mês em andamento é comparado até o mesmo dia do mês anterior; base anterior zero não gera percentual infinito.
- Patrimônio permite cadastrar bens, contas, investimentos e dívidas, além de registrar avaliações datadas, participação, fonte e motivo.

## Regras dos totais

Pagamentos de aluguel usam o valor líquido e a data do pagamento. Despesas diretas exigem status pago; lançamentos pessoais e de cartão exigem pago/recebido. Projetos e perícias entram quando recebidos. Registros inativos e pagamentos estornados ficam fora.

Transferências e pagamento da fatura não são novos gastos. Compras de cartão confirmadas entram na data da parcela cadastrada. Por isso resultado mensal e saldo bancário são indicadores diferentes.

Despesas usam paid_date quando informado, senão date. O timestamp técnico paid_at não redefine o mês. O segmento explícito prevalece; dados antigos usam o contexto e, na ausência dele, despesa direta vai para kitnets e lançamento pessoal vai para pessoal. A composição sinaliza segmento herdado.

No resultado por kitnet, a unidade pode vir do próprio pagamento, do recebível ou do contrato. Valores sem unidade identificada permanecem em Geral, sem rateio automático.

## Patrimônio e histórico

O patrimônio líquido é a soma dos ativos proporcional à participação, menos as dívidas proporcionais à responsabilidade informada. Cada mês usa a última avaliação conhecida até aquela data. Sem avaliação de algum cadastro, o líquido fica não apurado; não se inventa histórico anterior. Avaliações antigas mantidas são identificadas como estimativa.

Para corrigir uma posição, registre outra na mesma data. A posição mais recente prevalece e a anterior permanece no histórico. Para venda ou quitação, registre posição zero. Nenhuma avaliação cria automaticamente receita ou despesa.

O cadastro é manual: imóveis, contas e investimentos não são importados automaticamente. Evite cadastrar duas vezes o mesmo ativo ou saldo. No ambiente remoto, patrimônio é restrito a administradores por política de acesso no banco.

## Publicação pendente

Aplicar as migrações pendentes, na ordem, antes de publicar a interface:

1. `20260929132748_financial_operations_and_recovery.sql` — operações financeiras e recuperação do trabalho anterior.
2. `20260929132757_wealth_positions_security.sql` — acesso e validação de patrimônio.

A tela de patrimônio remoto verifica a função wealth_access e fica indisponível se a migração não estiver aplicada. Nenhuma migração foi aplicada em produção nesta etapa.

## Validação

- Suíte Vitest e compilação Vite executadas em cópia temporária com dependências isoladas do Google Drive.
- Cinco suítes SQL locais passaram em PostgreSQL embarcado/PGlite, incluindo proteção de posições patrimoniais e acesso administrativo. Isso não substitui a conferência após publicação no Supabase.
- Navegador local com dados sintéticos: inserção refletida imediatamente nos totais; filtro de segmento; troca de mês; abertura do registro de origem; cadastro e avaliação patrimonial pela interface.
- Exemplo verificado: entrada de R$ 5.000, gasto de R$ 300 e resultado de R$ 4.700; imóvel de R$ 200.000 com participação de 50% apurado como R$ 100.000.
- Inspeção visual em desktop e celular de 390 px, sem transbordamento da página. Sessão nova sem erros de execução; permanecem avisos de futura versão do React Router.


## Publicação de 29/09/2026
Migrações aplicadas no Supabase de produção e funções verificadas. Código encaminhado para publicação automática pela branch main. As referências anteriores a migrações pendentes descrevem o estado antes desta publicação.
