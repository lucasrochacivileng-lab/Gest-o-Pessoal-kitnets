Você está trabalhando no projeto KitManager Pro, um app React + Vite + Tailwind para gestão de kitnets, finanças pessoais, perícias judiciais e projetos complementares.

Objetivo: recriar fora da Base44 um sistema equivalente ao protótipo KitManager.

Regras:
- Não usar SDK da Base44.
- Manter React Router.
- Manter Tailwind.
- Usar componentes limpos e responsivos.
- Não exibir IDs técnicos ao usuário.
- Usar nomes amigáveis em português.
- Manter exclusão lógica com `active`.
- Preparar a troca futura do mock local por Supabase.

Entidades:
1. Kitnet: name, address, status, rent_value, description, notes, active.
2. Tenant: name, cpf, phone, whatsapp, email, kitnet_id, status, notes, active.
3. Contract: kitnet_id, tenant_id, start_date, end_date, rent_value, due_day, deposit, status, adjustment, document_url, notes, active.
4. Receivable: kitnet_id, tenant_id, contract_id, competence, expected_value, due_date, status, notes, active.
5. Payment: receivable_id, kitnet_id, tenant_id, competence, paid_value, payment_date, payment_method, destination_account, receipt_url, notes, active.
6. Expense: date, category, type, kitnet_id, description, value, payment_method, account, status, receipt_url, notes, active.
7. Construction: date, kitnet_id, is_general, service, supplier, category, value, status, receipt_url, notes, active.
8. CreditCard: card_name, bank, purchase_date, description, category, value, total_installments, current_installment, due_date, status, active.
9. Document: title, type, file_url, kitnet_id, tenant_id, contract_id, notes, active.
10. PersonalIncome: date, description, category, source, value, status, notes, active.
11. ExpertReport: process_number, client, description, fee_value, received_value, receive_date, status, notes, active.
12. ComplementaryProject: client, project_type, description, contracted_value, received_value, receive_date, status, notes, active.

Implementar:
- CRUD completo para cada entidade.
- Dashboard com cards: receita prevista, despesas, lucro, ocupação, vencidos, pendentes.
- Visão Geral Financeira consolidando kitnets + pessoal + perícias + projetos.
- Tela de Kitnets em cards.
- Tela de Recebimentos com filtros: vencidos, a vencer, pagos, por mês.
- Formulário Receber Aluguel com campos de leitura: Kitnet, Locatário, Competência, Valor previsto, Vencimento; campos editáveis: Valor pago, Data, Forma, Conta destino, Observação, Comprovante.
- Ao receber aluguel, criar Payment e atualizar Receivable.
- Ao criar contrato ativo, gerar recebíveis mensais sem duplicar competência.
- Tela de auditoria dos recebíveis gerados.
- Upload de documentos inicialmente como campo URL; depois preparar para Supabase Storage.

Visual:
- Sidebar escura.
- Cards modernos.
- Status coloridos: pago verde, pendente amarelo, vencido vermelho, vaga laranja, ocupada verde, manutenção azul/cinza.
- Layout bom para desktop e celular.

Primeira tarefa:
Substituir `localClient` por um pequeno repositório local com persistência em localStorage, mantendo a mesma interface: list, create, update, removeSoft.
Depois implementar CRUD real das páginas principais: Kitnets, Locatários, Contratos e Recebimentos.
