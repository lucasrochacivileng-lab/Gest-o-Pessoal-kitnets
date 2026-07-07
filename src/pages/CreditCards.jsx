import React from 'react';
import EntityPage from '../components/ui/EntityPage.jsx';

const fields = [
  { name: 'card_name', label: 'Nome do cartão', placeholder: 'Visa Platinum' },
  { name: 'bank', label: 'Banco', placeholder: 'Itaú, Nubank' },
  { name: 'purchase_date', label: 'Data da compra', type: 'date' },
  { name: 'description', label: 'Descrição', placeholder: 'Compra de material' },
  { name: 'category', label: 'Categoria', type: 'select', options: [
    { value: 'aluguel', label: 'Aluguel' },
    { value: 'obra', label: 'Obra' },
    { value: 'pessoal', label: 'Pessoal' },
    { value: 'outro', label: 'Outro' },
  ] },
  { name: 'value', label: 'Valor', type: 'number', placeholder: '1200' },
  { name: 'total_installments', label: 'Parcelas totais', type: 'number', placeholder: '6' },
  { name: 'current_installment', label: 'Parcela atual', type: 'number', placeholder: '1' },
  { name: 'due_date', label: 'Vencimento', type: 'date' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'pendente', label: 'Pendente' },
    { value: 'pago', label: 'Pago' },
  ] },
  { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Detalhes do cartão' },
];

export default function CreditCards() {
  return (
    <EntityPage
      title="Cartões"
      subtitle="Controle de despesas no cartão de crédito"
      entity="CreditCard"
      fields={fields}
      cardFields={['card_name', 'bank']}
    />
  );
}
