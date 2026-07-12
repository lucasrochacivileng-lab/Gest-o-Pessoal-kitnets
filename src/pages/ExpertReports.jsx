import React from 'react';
import { useParams } from 'react-router-dom';
import EntityPage from '../components/ui/EntityPage.jsx';
import { NOTIFICATION_ENTITY } from '../modules/notifications/types/notification.types.js';

const fields = [
  { name: 'process_number', label: 'Número do processo', placeholder: '0000000-00.0000.0.00.0000' },
  { name: 'client', label: 'Cliente / Parte', placeholder: 'Nome' },
  { name: 'court', label: 'Vara / Comarca', placeholder: 'Ex: 1ª Vara Cível de Goiatuba' },
  { name: 'report_type', label: 'Tipo de perícia', placeholder: 'Avaliação de imóvel, insalubridade...' },
  { name: 'fee_value', label: 'Honorários (R$)', type: 'number', placeholder: '5000' },
  { name: 'due_date', label: 'Prazo do laudo', type: 'date' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'em andamento', label: 'Em andamento' },
    { value: 'entregue', label: 'Entregue (aguardando pagamento)' },
    { value: 'recebido', label: 'Recebido' },
  ] },
  { name: 'expected_payment_date', label: 'Previsão de recebimento', type: 'date', help: 'No dia previsto o app pergunta se o valor caiu na conta' },
  { name: 'received_date', label: 'Data em que recebeu', type: 'date', help: 'Use a data real em que o dinheiro caiu na conta' },
  { name: 'notes', label: 'Observações', type: 'textarea' },
];

const STATUS_BADGE_COLORS = {
  'em andamento': 'ds-badge-info',
  entregue: 'ds-badge-warning',
  recebido: 'ds-badge-success',
};

const columns = [
  { field: 'client', label: 'Cliente' },
  { field: 'process_number', label: 'Processo' },
  { field: 'report_type', label: 'Tipo' },
  { field: 'fee_value', label: 'Honorários', format: 'currency', align: 'right' },
  { field: 'due_date', label: 'Prazo', format: 'date' },
  { field: 'received_date', label: 'Recebido em', format: 'date' },
  { field: 'status', label: 'Status', format: 'badge' },
];

export default function ExpertReports() {
  const { id } = useParams();

  return (
    <EntityPage
      title="Perícias Judiciais"
      subtitle="Laudos e perícias — com previsão de recebimento integrada ao caixa"
      entity="ExpertReport"
      fields={fields}
      cardFields={['client', 'report_type', 'fee_value', 'status']}
      columns={columns}
      badgeColors={STATUS_BADGE_COLORS}
      selectedId={id}
      deepLinkEntity={NOTIFICATION_ENTITY.EXPERT_REPORT}
      deepLinkBasePath="/pericias"
      getDeepLinkLabel={(item) => [item.client, item.process_number].filter(Boolean).join(' — ') || item.id}
    />
  );
}
