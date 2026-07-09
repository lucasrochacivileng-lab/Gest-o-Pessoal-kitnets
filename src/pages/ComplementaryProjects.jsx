import React from 'react';
import { useParams } from 'react-router-dom';
import EntityPage from '../components/ui/EntityPage.jsx';
import { NOTIFICATION_ENTITY } from '../modules/notifications/types/notification.types.js';

const fields = [
  { name: 'client', label: 'Cliente', placeholder: 'Nome do cliente' },
  { name: 'project_type', label: 'Tipo de projeto', placeholder: 'Estrutural, elétrico, hidrossanitário...' },
  { name: 'address', label: 'Endereço da obra', placeholder: 'Rua, número, cidade' },
  { name: 'value', label: 'Valor (R$)', type: 'number', placeholder: '100000' },
  { name: 'due_date', label: 'Prazo de entrega', type: 'date' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'em andamento', label: 'Em andamento' },
    { value: 'entregue', label: 'Entregue (aguardando pagamento)' },
    { value: 'recebido', label: 'Recebido' },
  ] },
  { name: 'expected_payment_date', label: 'Previsão de recebimento', type: 'date', help: 'No dia previsto o app pergunta se o valor caiu na conta' },
  { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Detalhes do projeto, condições de pagamento...' },
];

const STATUS_BADGE_COLORS = {
  'em andamento': 'ds-badge-info',
  entregue: 'ds-badge-warning',
  recebido: 'ds-badge-success',
};

const columns = [
  { field: 'client', label: 'Cliente' },
  { field: 'project_type', label: 'Tipo' },
  { field: 'value', label: 'Valor', format: 'currency', align: 'right' },
  { field: 'due_date', label: 'Prazo', format: 'date' },
  { field: 'status', label: 'Status', format: 'badge' },
];

export default function ComplementaryProjects() {
  const { id } = useParams();

  return (
    <EntityPage
      title="Projetos Complementares"
      subtitle="Projetos de engenharia — com previsão de recebimento integrada ao caixa"
      entity="ComplementaryProject"
      fields={fields}
      cardFields={['client', 'project_type', 'value', 'status']}
      columns={columns}
      badgeColors={STATUS_BADGE_COLORS}
      selectedId={id}
      deepLinkEntity={NOTIFICATION_ENTITY.PROJECT}
      deepLinkBasePath="/projetos"
      getDeepLinkLabel={(item) => [item.client, item.project_type].filter(Boolean).join(' — ') || item.id}
    />
  );
}
