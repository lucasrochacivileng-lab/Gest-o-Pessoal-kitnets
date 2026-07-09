import React from 'react';
import EntityPage from '../../../components/ui/EntityPage.jsx';

const fields = [
	{ key: 'name', label: 'Nome', type: 'text' },
	{ key: 'cpf', label: 'CPF', type: 'text', placeholder: '000.000.000-00' },
	{ key: 'phone', label: 'Telefone', type: 'text', placeholder: '(64) 99999-9999' },
	{ key: 'whatsapp', label: 'WhatsApp', type: 'text', placeholder: 'Se for diferente do telefone' },
	{ key: 'profession', label: 'Profissão', type: 'text', placeholder: 'Ex: Vidraceiro' },
	{ key: 'kitnet_id', label: 'Kitnet', type: 'relation', entity: 'Kitnet' },
	{ key: 'status', label: 'Status', type: 'select', options: ['ativo', 'inativo'] },
	{ key: 'guarantor_name', label: 'Nome do fiador', type: 'text' },
	{ key: 'guarantor_cpf', label: 'CPF do fiador', type: 'text', placeholder: '000.000.000-00' },
	{ key: 'guarantor_phone', label: 'Telefone do fiador', type: 'text' },
];

const detailFields = [
	{ field: 'cpf', label: 'CPF' },
	{ field: 'phone', label: 'Telefone' },
	{ field: 'whatsapp', label: 'WhatsApp' },
	{ field: 'profession', label: 'Profissão' },
	{ field: 'kitnet_id', label: 'Kitnet', format: 'relation', relation: 'Kitnet' },
	{ field: 'guarantor_name', label: 'Fiador' },
	{ field: 'guarantor_cpf', label: 'CPF do fiador' },
	{ field: 'guarantor_phone', label: 'Telefone do fiador' },
];

export default function Tenants() {
	return (
		<EntityPage
			entity="Tenant"
			title="Locatários"
			subtitle="Lista de locatários"
			fields={fields}
			cardFields={['name']}
			badgeField="status"
			badgeColors={{ ativo: 'ds-badge-success', inativo: 'ds-badge-info' }}
			detailFields={detailFields}
			relations={[{ key: 'Kitnet', entity: 'Kitnet' }]}
		/>
	);
}
