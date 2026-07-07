import React from 'react';
import EntityPage from '../../../components/ui/EntityPage.jsx';

const fields = [
	{ key: 'contract_id', label: 'Contrato', type: 'relation', entity: 'Contract' },
	{ key: 'kitnet_id', label: 'Kitnet', type: 'relation', entity: 'Kitnet' },
	{ key: 'tenant_id', label: 'Locatário', type: 'relation', entity: 'Tenant' },
	{ key: 'competence', label: 'Competência', type: 'text' },
	{ key: 'expected_value', label: 'Valor Esperado', type: 'number' },
	{ key: 'due_date', label: 'Vencimento', type: 'date' },
	{ key: 'status', label: 'Status', type: 'select', options: ['pendente', 'parcial', 'pago', 'vencido'] }
];

export default function Receivables() {
	return <EntityPage entity="Receivable" title="Recebimentos" subtitle="Contas a receber" fields={fields} cardFields={[ 'competence', 'expected_value', 'status' ]} />;
}
