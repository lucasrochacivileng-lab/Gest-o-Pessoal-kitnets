# Correções financeiras, notificações e recuperação

Implementação local concluída em 28/09/2026. A migração e o frontend ainda precisam ser publicados; não foram alterados dados de produção.

## Comportamento implementado

- Listagem Supabase percorre páginas por ID até esgotar os registros, inclusive quando o servidor limita a página abaixo do tamanho solicitado.
- Reset local fica indisponível em modo Supabase, também na camada de persistência. Exclusão física de registros pelo app é bloqueada; pagamentos usam estorno.
- Exportação administrativa usa um snapshot do banco, incluindo registros ativos/inativos, caixa de entrada financeira e PDFs referenciados por Document.file_path.
- Importação exige cópia de segurança atual. O banco recusa a operação se os dados mudaram desde essa cópia. A restauração é transacional: erro em uma tabela desfaz a substituição inteira.
- PDFs são validados antes dos uploads e recebem caminhos novos. Arquivos anteriores nunca são sobrescritos. Se a resposta de rede for ambígua, os novos arquivos são preservados, pois a transação pode ter sido confirmada.
- Criação, correção e estorno ajustam o saldo do recebível. Correções usam o estado anterior para detectar edição concorrente. Repetir a mesma baixa ou estorno não duplica o efeito.
- O valor baixado é o principal do aluguel; o líquido recebido desconta desconto e soma multa e juros. O recibo conserva sua numeração ao corrigir.
- Rescisão remota cancela cobranças futuras não pagas, lança a multa proporcional e atualiza contrato, imóvel e locatário na mesma transação. Multa e aluguel podem coexistir na mesma competência. Multa configurada como zero permanece zero.
- Quitação encerra alertas de aluguel, inclusive aqueles em erro. Correção/estorno que devolve saldo reabre o alerta. Uma gravação atrasada de notificação não consegue reabrir aluguel já quitado.
- Central e caixa diária recebem avisos das operações locais e do Realtime. A central também atualiza ao retornar à aba, reconectar e a cada minuto. O filtro inicial mostra avisos em aberto.
- Atualizações automáticas não limpam um formulário de pagamento em preenchimento.

## Publicação

1. Aplicar `supabase/migrations/20260929132748_financial_operations_and_recovery.sql` pelo fluxo de migrações do projeto, antes de publicar o frontend. As RPCs de correção, estorno, rescisão e backup dependem dessa migração.
2. Publicar o frontend e verificar a versão carregada pelos clientes/PWA.
3. Em ambiente de homologação autenticado, repetir quitação → correção → estorno, rescisão com multa e exportação/restauração. Os testes locais não substituem a validação de autenticação, Storage e Realtime hospedados.

## Validação executada

- Suíte Vitest completa: 311 testes aprovados, incluindo novas verificações de saldo, estorno, repetição, notificações e PDFs de backup.
- Build Vite/PWA aprovado.
- PostgreSQL local via PGlite: todas as migrações e seed, depois `reproducible_baseline.sql`, `financial_core_authenticated.sql`, `0015_anon_records_privileges.sql` e `financial_operations.sql`, todos aprovados. Cenários incluem rollback de rescisão e restauração, edição desatualizada, backup com mais de 1.200 registros e restrição administrativa.
- Navegador em modo local: Dashboard, Pagamentos e Configurações carregaram sem erros; aviso de teste desapareceu após quitação e retornou após estorno sem reload; reset seguido de recuperação devolveu os registros originais.
- Dependências e testes executados em cópia temporária fora do Google Drive, pois a pasta sincronizada causava lentidão. Nenhuma dependência do projeto foi alterada.

## Escopo e limites

O backup não inclui usuários/senhas do Supabase Auth, preferências do navegador nem cópia do histórico de auditoria. A auditoria existente é preservada no banco. URLs de comprovantes externos não copiam o conteúdo do site externo. Backups antigos de registros continuam aceitos; não contêm os PDFs nem a caixa financeira e preservam as tabelas financeiras existentes, exigindo conferência dos vínculos legados após importar.

A recuperação rápida da cópia anterior dura apenas enquanto a tela permanece aberta; o arquivo baixado permite recuperação posterior. O modo local grava cada operação financeira de uma vez no localStorage, mas não oferece bloqueio transacional entre abas como o PostgreSQL.

A verificação de segurança remota encontrou avisos já existentes sobre quatro funções SECURITY DEFINER de autorização/administração e proteção contra senhas vazadas desativada. As novas funções usam SECURITY INVOKER; o relatório remoto não avaliou a migração ainda não publicada.

### Avisos de aluguel com resumo antigo (29/09/2026)
A geração e a resolução dos avisos agora também conferem os pagamentos ativos vinculados ao ID exato do recebível. Pagamentos estornados ou inativos são desconsiderados. O mês/ano aparece no título para distinguir setembro de outubro. Uma confirmação de aviso antigo de aluguel integralmente pago não cria outro pagamento. Divergência parcial exige conferir o histórico antes de confirmar novo recebimento. Testes de regressão cobrem quitação com resumo antigo, não duplicação, competências distintas e estornos. Alteração local; publicação ainda pendente.


## Publicação de 29/09/2026
Migrações aplicadas no Supabase de produção e funções verificadas. Código encaminhado para publicação automática pela branch main. As referências anteriores a migrações pendentes descrevem o estado antes desta publicação.
