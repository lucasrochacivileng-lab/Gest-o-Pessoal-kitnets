import React, { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import EntityPage from '../components/ui/EntityPage.jsx';
import { NOTIFICATION_ENTITY } from '../modules/notifications/types/notification.types.js';
import { recurringExpenseService } from '../services/recurringExpenseService.js';
import { findExpenseDuplicateOf } from '../services/duplicateCheckService.js';
import { MonthChips } from '../components/ui/MonthChips.jsx';

const fields = [
  { name: 'date', label: 'Data', type: 'date' },
  { name: 'category', label: 'Categoria', type: 'select', options: [
    { value: 'manutencao', label: 'Manutenção' },
    { value: 'agua', label: 'Água' },
    { value: 'luz', label: 'Luz' },
    { value: 'energia_solar', label: 'Energia solar (parcela)' },
    { value: 'moveis', label: 'Móveis/eletrodomésticos (parcela)' },
    { value: 'internet', label: 'Internet' },
    { value: 'iptu', label: 'IPTU' },
    { value: 'seguro', label: 'Seguro' },
    { value: 'limpeza', label: 'Limpeza' },
    { value: 'material', label: 'Material' },
    { value: 'pessoal', label: 'Pessoal' },
    { value: 'obra', label: 'Obra' },
    { value: 'outro', label: 'Outro' },
  ] },
  { name: 'type', label: 'Tipo', type: 'select', options: [
    { value: 'fixa', label: 'Fixa' },
    { value: 'variavel', label: 'Variável' },
  ] },
  { name: 'kitnet_id', label: 'Kitnet', type: 'select', optionsEntity: 'Kitnet' },
  { name: 'description', label: 'Descrição', type: 'textarea', placeholder: 'Descrição da despesa' },
  { name: 'value', label: 'Valor', type: 'number', placeholder: '1200' },
  { name: 'payment_method', label: 'Forma de pagamento', placeholder: 'Pix, dinheiro, transferência' },
  { name: 'account', label: 'Conta', placeholder: 'Mercado Pago, Itaú, Nubank' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'pendente', label: 'Pendente' },
    { value: 'pago', label: 'Pago' },
  ] },
  { name: 'recurring', label: 'Despesa recorrente', type: 'checkbox', help: 'Repete todo mês (água, parcelas de cartão...)' },
  { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Ex: comprovante anexo' },
];

const columns = [
  { field: 'date', label: 'Data', format: 'date' },
  { field: 'description', label: 'Descrição' },
  { field: 'kitnet_id', label: 'Kitnet', format: 'relation', relation: 'Kitnet' },
  { field: 'category', label: 'Categoria' },
  { field: 'value', label: 'Valor', format: 'currency', align: 'right' },
  { field: 'status', label: 'Status', format: 'badge' },
];

const STATUS_BADGE_COLORS = {
  pago: 'ds-badge-success',
  pendente: 'ds-badge-warning',
};

export const filterExpensesByCompetence = (rows = [], competence = '') => (
  rows.filter((row) => String(row.date || '').startsWith(competence))
);

export default function Expenses() {
  const { id } = useParams();
  const [competence, setCompetence] = useState(() => new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const filterBySelectedMonth = useCallback(
    (rows) => filterExpensesByCompetence(rows, competence),
    [competence],
  );

  const handleGenerate = async () => {
    setGenerating(true);
    setMessage('');

    try {
      const result = await recurringExpenseService.generateForCompetence(competence);
      setMessage(result.created > 0
        ? `${result.created} despesa(s) recorrente(s) lançada(s) para ${competence}.`
        : `Nenhuma despesa nova: as recorrentes de ${competence} já estão lançadas (ou nenhuma despesa está marcada como recorrente).`);
      setReloadKey((key) => key + 1);
    } catch {
      setMessage('Não foi possível gerar as despesas. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <MonthChips value={competence} onChange={setCompetence} />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !competence}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {generating ? 'Gerando...' : `Gerar despesas de ${competence}`}
        </button>
      </div>

      {message ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</div>
      ) : null}

      <EntityPage
        key={reloadKey}
        title="Despesas"
        subtitle="Registro de despesas por kitnet, categoria e conta"
        entity="Expense"
        fields={fields}
        cardFields={['date', 'description']}
        columns={columns}
        badgeColors={STATUS_BADGE_COLORS}
        relations={[{ key: 'Kitnet', entity: 'Kitnet' }]}
        selectedId={id}
        deepLinkEntity={NOTIFICATION_ENTITY.EXPENSE}
        deepLinkBasePath="/despesas"
        getDeepLinkLabel={(item) => item.description || item.category || item.id}
        checkDuplicate={findExpenseDuplicateOf}
        filterRows={filterBySelectedMonth}
      />
    </div>
  );
}
