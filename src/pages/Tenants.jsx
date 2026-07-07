import React from 'react';
import EntityPage from '../components/ui/EntityPage.jsx';

const fields = [
  { name: 'name', label: 'Nome', placeholder: 'Maria Silva' },
  { name: 'cpf', label: 'CPF', placeholder: '000.000.000-00' },
  { name: 'phone', label: 'Telefone', placeholder: '(62) 99999-9999' },
  { name: 'whatsapp', label: 'WhatsApp', placeholder: '(62) 99999-9999' },
  { name: 'email', label: 'E-mail', type: 'email', placeholder: 'maria@email.com' },
  { name: 'kitnet_id', label: 'Kitnet', type: 'select', optionsEntity: 'Kitnet' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'ativo', label: 'Ativo' },
    { value: 'inativo', label: 'Inativo' },
  ] },
  { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Ex: contrato assinado' },
];

export default function Tenants() {
  return (
    <EntityPage
      title="Locatários"
      subtitle="Gestão de locatários vinculados às kitnets"
      entity="Tenant"
      fields={fields}
      cardFields={['name', 'cpf']}
      relations={[{ key: 'Kitnet', entity: 'Kitnet' }]}
    />
  );
}
