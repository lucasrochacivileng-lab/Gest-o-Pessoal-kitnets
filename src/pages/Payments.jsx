import React from 'react';
import EntityPage from '../components/ui/EntityPage.jsx';
import { repository } from '../repository/index.js';
import receivableService from '../modules/receivables/services/receivableService.js';
import { addMoney, subtractMoney } from '../services/money.js';

const fields = [
  { name: 'receivable_id', label: 'Recebível', type: 'select', optionsEntity: 'Receivable', optionLabel: (row, relations) => [
    relations.Kitnet?.find((item) => item.id === row.kitnet_id)?.name,
    relations.Tenant?.find((item) => item.id === row.tenant_id)?.name,
    row.competence, row.type === 'multa_quebra' ? 'Multa de rescisão' : 'Aluguel',
  ].filter(Boolean).join(' · ') },
  { name: 'paid_value', label: 'Valor do aluguel baixado (antes dos ajustes)', type: 'number', placeholder: '800', allowNegative: true },
  { name: 'discount', label: 'Desconto', type: 'number', default: 0, allowNegative: true },
  { name: 'fine', label: 'Multa', type: 'number', default: 0, allowNegative: true },
  { name: 'interest', label: 'Juros', type: 'number', default: 0, allowNegative: true },
  { name: 'payment_date', label: 'Data do pagamento', type: 'date', default: 'today' },
  { name: 'payment_method', label: 'Forma de pagamento', placeholder: 'Pix, Transferência' },
  { name: 'destination_account', label: 'Conta destino', placeholder: 'Itaú' },
  { name: 'bank_account_id', label: 'Conta que recebeu', type: 'relation', entity: 'BankAccount' },
  { name: 'receipt_url', label: 'Comprovante URL', placeholder: 'https://...' },
  { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Ex: devolução de caução' },
  { name: 'justification', label: 'Motivo da correção (ao editar)', type: 'textarea' },
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
  { field: 'net_value', label: 'Valor líquido recebido', format: 'currency', align: 'right' },
];

// Pagamentos lançados antes da correção de receivableService.registerPayment
// não têm kitnet_id/tenant_id/competence próprios (só receivable_id) — sem
// isso, a linha aparece com "—" em tudo mesmo tendo um recebível vinculado.
// Só roda na exibição; some assim que o registro é editado e salvo de novo.
export const enrichPaymentRow = (row = {}, relationOptions = {}) => {
  if (row.net_value == null && row.paid_value != null) {
    row = { ...row, net_value: addMoney(subtractMoney(row.paid_value, row.discount), row.fine, row.interest) };
  }
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
  const savePayment = async (values, original, paymentId) => {
    if (original) {
      if ((values.receivable_id || '') !== (original.receivable_id || '')) throw new Error('Para mudar o recebível, estorne e registre um novo pagamento.');
      if (!values.justification?.trim()) throw new Error('Informe o motivo da correção.');
      return repository.correctPayment(original, values);
    }
    const rows = await repository.list('Receivable');
    const receivable = rows.find((row) => row.id === values.receivable_id);
    if (!receivable) throw new Error('Selecione o recebível.');
    return receivableService.registerPayment(receivable, { ...values, payment_id: paymentId });
  };
  const reversePayment = async (row) => {
    const reason = window.prompt('Motivo do estorno:');
    if (!reason?.trim()) throw new Error('O estorno exige um motivo e não foi realizado.');
    return repository.reversePayment(row, reason.trim());
  };
  return (
    <EntityPage
      title="Pagamentos"
      subtitle="Recebimentos de aluguel. Correções e estornos atualizam a cobrança e preservam o histórico."
      saveRecord={savePayment}
      removeRecord={reversePayment}
      removeLabel="Estornar pagamento"
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
