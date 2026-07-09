import React from 'react';
import EntityPage from '../components/ui/EntityPage.jsx';

const fields = [
  { name: 'receivable_id', label: 'Recebível', type: 'select', optionsEntity: 'Receivable' },
  { name: 'kitnet_id', label: 'Kitnet', type: 'select', optionsEntity: 'Kitnet' },
  { name: 'tenant_id', label: 'Locatário', type: 'select', optionsEntity: 'Tenant' },
  { name: 'competence', label: 'Competência', placeholder: '07/2026' },
  { name: 'paid_value', label: 'Valor pago', type: 'number', placeholder: '800' },
  { name: 'payment_date', label: 'Data do pagamento', type: 'date' },
  { name: 'payment_method', label: 'Forma de pagamento', placeholder: 'Pix, Transferência' },
  { name: 'destination_account', label: 'Conta destino', placeholder: 'Itaú' },
  { name: 'receipt_url', label: 'Comprovante URL', placeholder: 'https://...' },
  { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Ex: devolução de caução' },
];

const cardFields = [
  { field: 'kitnet_id', format: 'relation', relation: 'Kitnet' },
  { field: 'tenant_id', format: 'relation', relation: 'Tenant' },
];

const columns = [
  { field: 'kitnet_id', label: 'Kitnet', format: 'relation', relation: 'Kitnet' },
  { field: 'tenant_id', label: 'Locatário', format: 'relation', relation: 'Tenant' },
  { field: 'competence', label: 'Competência', format: 'competence' },
  { field: 'payment_date', label: 'Data', format: 'date' },
  { field: 'payment_method', label: 'Forma de pagamento' },
  { field: 'paid_value', label: 'Valor', format: 'currency', align: 'right' },
];

export default function Payments() {
  return (
    <EntityPage
      title="Pagamentos"
      subtitle="Registro de pagamentos realizados"
      entity="Payment"
      fields={fields}
      cardFields={cardFields}
      columns={columns}
      relations={[
        { key: 'Receivable', entity: 'Receivable' },
        { key: 'Kitnet', entity: 'Kitnet' },
        { key: 'Tenant', entity: 'Tenant' },
      ]}
    />
  );
}
