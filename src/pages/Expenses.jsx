import React from 'react';
import EntityPage from '../components/ui/EntityPage.jsx';

const fields = [
  { name: 'date', label: 'Data', type: 'date' },
  { name: 'category', label: 'Categoria', type: 'select', options: [
    { value: 'manutencao', label: 'Manutenção' },
    { value: 'agua', label: 'Água' },
    { value: 'luz', label: 'Luz' },
    { value: 'internet', label: 'Internet' },
    { value: 'iptu', label: 'IPTU' },
    { value: 'seguro', label: 'Seguro' },
    { value: 'limpeza', label: 'Limpeza' },
    { value: 'material', label: 'Material' },
    { value: 'pessoal', label: 'Pessoal' },
    { value: 'obra', label: 'Obra' },
    { value: 'outro', label: 'Outro' },
  ] },
  { name: 'type', label: 'Tipo', type: 'select', options: [
    { value: 'fixa', label: 'Fixa' },
    { value: 'variavel', label: 'Variável' },
  ] },
  { name: 'kitnet_id', label: 'Kitnet', type: 'select', optionsEntity: 'Kitnet' },
  { name: 'description', label: 'Descrição', type: 'textarea', placeholder: 'Descrição da despesa' },
  { name: 'value', label: 'Valor', type: 'number', placeholder: '1200' },
  { name: 'payment_method', label: 'Forma de pagamento', placeholder: 'Pix, dinheiro, transferência' },
  { name: 'account', label: 'Conta', placeholder: 'Itaú, Nubank' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'pendente', label: 'Pendente' },
    { value: 'pago', label: 'Pago' },
  ] },
  { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Ex: comprovante anexo' },
];

export default function Expenses() {
  return (
    <EntityPage
      title="Despesas"
      subtitle="Registro de despesas por kitnet, categoria e conta"
      entity="Expense"
      fields={fields}
      cardFields={['date', 'description']}
      relations={[{ key: 'Kitnet', entity: 'Kitnet' }]}
    />
  );
}
