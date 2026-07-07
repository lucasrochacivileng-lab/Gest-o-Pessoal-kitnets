import React from 'react';
import EntityPage from '../components/ui/EntityPage.jsx';

const fields = [
  { name: 'title', label: 'Título', placeholder: 'Contrato de locação' },
  { name: 'type', label: 'Tipo', placeholder: 'Contrato, Laudo, Recibo' },
  { name: 'file_url', label: 'URL do arquivo', placeholder: 'https://...' },
  { name: 'kitnet_id', label: 'Kitnet', type: 'select', optionsEntity: 'Kitnet' },
  { name: 'tenant_id', label: 'Locatário', type: 'select', optionsEntity: 'Tenant' },
  { name: 'contract_id', label: 'Contrato', type: 'select', optionsEntity: 'Contract' },
  { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Detalhes do documento' },
];

export default function Documents() {
  return (
    <EntityPage
      title="Documentos"
      subtitle="Cadastro de documentos relacionados ao patrimônio"
      entity="Document"
      fields={fields}
      cardFields={['title', 'type']}
      relations={[
        { key: 'Kitnet', entity: 'Kitnet' },
        { key: 'Tenant', entity: 'Tenant' },
        { key: 'Contract', entity: 'Contract' },
      ]}
    />
  );
}
