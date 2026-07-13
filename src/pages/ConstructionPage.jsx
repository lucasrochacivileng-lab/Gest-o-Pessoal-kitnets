import React from 'react';
import EntityPage from '../components/ui/EntityPage.jsx';

const fields = [
  { name: 'date', label: 'Data', type: 'date', default: 'today' },
  { name: 'kitnet_id', label: 'Kitnet', type: 'select', optionsEntity: 'Kitnet' },
  { name: 'is_general', label: 'Geral', type: 'checkbox', help: 'Serviço geral sem kitnet específico' },
  { name: 'service', label: 'Serviço', placeholder: 'Reforma, Pintura, Hidráulica' },
  { name: 'supplier', label: 'Fornecedor', placeholder: 'Nome do fornecedor' },
  { name: 'category', label: 'Categoria', type: 'select', options: [
    { value: 'obra', label: 'Obra' },
    { value: 'material', label: 'Material' },
    { value: 'manutencao', label: 'Manutenção' },
    { value: 'outro', label: 'Outro' },
  ] },
  { name: 'value', label: 'Valor', type: 'number', placeholder: '1200' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'pendente', label: 'Pendente' },
    { value: 'em andamento', label: 'Em andamento' },
    { value: 'concluida', label: 'Concluída' },
  ] },
  { name: 'receipt_url', label: 'Comprovante URL', placeholder: 'https://...' },
  { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Detalhes do serviço' },
];

export default function ConstructionPage() {
  return (
    <EntityPage
      title="Obra/Reforma"
      subtitle="Controle de serviços, materiais e despesas de obra"
      entity="Construction"
      fields={fields}
      cardFields={['service', 'supplier']}
      relations={[{ key: 'Kitnet', entity: 'Kitnet' }]}
    />
  );
}
