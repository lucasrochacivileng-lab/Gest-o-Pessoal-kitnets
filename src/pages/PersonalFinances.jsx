import React from 'react';
import EntityPage from '../components/ui/EntityPage.jsx';

const fields = [
  { name: 'date', label: 'Data', type: 'date' },
  { name: 'type', label: 'Tipo', type: 'select', options: [
    { value: 'income', label: 'Receita' },
    { value: 'expense', label: 'Despesa' },
    { value: 'card_transaction', label: 'Transação de cartão (importada)' },
  ] },
  { name: 'description', label: 'Descrição', type: 'text', placeholder: 'Ex: Parcela sistema solar, mercado, projeto estrutural' },
  { name: 'value', label: 'Valor', type: 'number', placeholder: '1100' },
  { name: 'context', label: 'Contexto', type: 'select', options: [
    { value: 'pessoal', label: 'Pessoal (casa, família)' },
    { value: 'kitnets', label: 'Kitnets (custo do negócio)' },
    { value: 'obra', label: 'Obra / investimento nas kitnets' },
  ] },
  { name: 'category', label: 'Categoria', placeholder: 'Ex: energia solar, alimentação, projetos' },
  { name: 'card_name', label: 'Cartão / Conta', placeholder: 'Nubank, Santander, Pix Mercado Pago' },
  { name: 'installment', label: 'Parcela', placeholder: 'Ex: 12/24' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'previsto', label: 'Previsto' },
    { value: 'pendente', label: 'Pendente' },
    { value: 'pago', label: 'Pago' },
    { value: 'recebido', label: 'Recebido' },
    { value: 'revisar', label: 'Revisar (importado)' },
    { value: 'ignorar', label: 'Ignorar (não conta no caixa)' },
  ] },
  { name: 'recurring', label: 'Recorrente', type: 'checkbox', help: 'Repete todo mês (parcelas, assinaturas...)' },
];

export default function PersonalFinances() {
  return (
    <EntityPage
      title="Finanças Pessoais"
      subtitle="Receitas e despesas pessoais — marque o contexto para separar casa × kitnets × obra"
      entity="PersonalIncome"
      fields={fields}
      cardFields={['date', 'description', 'value']}
    />
  );
}
