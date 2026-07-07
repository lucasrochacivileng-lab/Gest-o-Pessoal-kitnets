import React from 'react';
import EntityPage from '../../../components/ui/EntityPage.jsx';

const fields = [
	{ key: 'name', label: 'Nome', type: 'text' },
	{ key: 'address', label: 'Endereço', type: 'text' },
	{ key: 'rent_value', label: 'Valor do Aluguel', type: 'number' },
	{ key: 'status', label: 'Status', type: 'select', options: ['vaga', 'ocupada', 'manutencao'] },
	{ key: 'description', label: 'Descrição', type: 'textarea' }
];

export default function Kitnets() {
	return <EntityPage entity="Kitnet" title="Kitnets" subtitle="Gerencie suas unidades" fields={fields} cardFields={[ 'name', 'status', 'rent_value' ]} />;
}
