import React from 'react';
import { useParams } from 'react-router-dom';
import EntityPage from '../../../components/ui/EntityPage.jsx';
import { NOTIFICATION_ENTITY } from '../../notifications/types/notification.types.js';

const fields = [
	{ key: 'kitnet_id', label: 'Kitnet', type: 'relation', entity: 'Kitnet' },
	{ key: 'tenant_id', label: 'Locatário', type: 'relation', entity: 'Tenant' },
	{ key: 'start_date', label: 'Início', type: 'date' },
	{ key: 'end_date', label: 'Término', type: 'date' },
	{ key: 'rent_value', label: 'Valor do Aluguel', type: 'number' },
	{ key: 'due_day', label: 'Dia do Vencimento', type: 'number' }
];

export default function Contracts() {
	const { id } = useParams();

	return (
		<EntityPage
			entity="Contract"
			title="Contratos"
			subtitle="Gerencie contratos"
			fields={fields}
			cardFields={[ 'kitnet_id', 'tenant_id', 'rent_value' ]}
			relations={[
				{ key: 'Kitnet', entity: 'Kitnet' },
				{ key: 'Tenant', entity: 'Tenant' }
			]}
			selectedId={id}
			deepLinkEntity={NOTIFICATION_ENTITY.CONTRACT}
			deepLinkBasePath="/contratos"
			getDeepLinkLabel={(item) => `Contrato ${item.id} - vencimento ${item.end_date || '-'}`}
		/>
	);
}
