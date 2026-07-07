import React from 'react';
import EntityPage from '../../../components/ui/EntityPage.jsx';

const fields = [
	{ key: 'kitnet_id', label: 'Kitnet', type: 'relation', entity: 'Kitnet' },
	{ key: 'tenant_id', label: 'Locatário', type: 'relation', entity: 'Tenant' },
	{ key: 'start_date', label: 'Início', type: 'date' },
	{ key: 'end_date', label: 'Término', type: 'date' },
	{ key: 'rent_value', label: 'Valor do Aluguel', type: 'number' },
	{ key: 'due_day', label: 'Dia do Vencimento', type: 'number' }
];

export default function Contracts() {
	return <EntityPage entity="Contract" title="Contratos" subtitle="Gerencie contratos" fields={fields} cardFields={[ 'kitnet_id', 'tenant_id', 'rent_value' ]} />;
}
