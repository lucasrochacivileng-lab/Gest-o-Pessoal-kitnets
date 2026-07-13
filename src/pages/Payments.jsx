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
  { name: 'bank_account_id', label: 'Conta que recebeu', type: 'relation', entity: 'BankAccount' },
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

// Pagamentos lançados antes da correção de receivableService.registerPayment
// não têm kitnet_id/tenant_id/competence próprios (só receivable_id) — sem
// isso, a linha aparece com "—" em tudo mesmo tendo um recebível vinculado.
// Só roda na exibição; some assim que o registro é editado e salvo de novo.
export const enrichPaymentRow = (row = {}, relationOptions = {}) => {
  if (row.kitnet_id && row.tenant_id && row.competence) return row;

  const receivable = (relationOptions.Receivable || []).find((item) => item.id === row.receivable_id);
  if (!receivable) return row;

  return {
    ...row,
    kitnet_id: row.kitnet_id || receivable.kitnet_id,
    tenant_id: row.tenant_id || receivable.tenant_id,
    competence: row.competence || receivable.competence,
  };
};

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
        { key: 'BankAccount', entity: 'BankAccount' },
      ]}
      enrichRow={enrichPaymentRow}
    />
  );
}
