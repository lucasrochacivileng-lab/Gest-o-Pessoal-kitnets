import React from 'react';
import EntityPage from '../../../components/ui/EntityPage.jsx';

const fields = [
	{ key: 'name', label: 'Nome', type: 'text' },
	{ key: 'phone', label: 'Telefone', type: 'text' },
	{ key: 'whatsapp', label: 'WhatsApp', type: 'text' },
	{ key: 'kitnet_id', label: 'Kitnet', type: 'relation', entity: 'Kitnet' },
	{ key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] }
];

export default function Tenants() {
	return <EntityPage entity="Tenant" title="Locatários" subtitle="Lista de locatários" fields={fields} cardFields={[ 'name', 'phone', 'status' ]} />;
}
