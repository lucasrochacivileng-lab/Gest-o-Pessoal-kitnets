import React, { useCallback, useState } from 'react';
import EntityPage from '../components/ui/EntityPage.jsx';
import { findPersonalDuplicateOf } from '../services/duplicateCheckService.js';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import { recurringIncomeService } from '../services/recurringIncomeService.js';

const fields = [
  { name: 'date', label: 'Data', type: 'date' },
  { name: 'type', label: 'Tipo', type: 'select', options: [
    { value: 'income', label: 'Receita' },
    { value: 'expense', label: 'Despesa' },
    { value: 'card_transaction', label: 'Transação de cartão (importada)' },
  ] },
  { name: 'description', label: 'Descrição', type: 'text', placeholder: 'Ex: Salário servidor, parcela sistema solar, mercado' },
  { name: 'value', label: 'Valor', type: 'number', placeholder: '9000' },
  { name: 'context', label: 'Contexto', type: 'select', options: [
    { value: 'pessoal', label: 'Pessoal (casa, família)' },
    { value: 'trabalho', label: 'Trabalho / Servidor (salário)' },
    { value: 'kitnets', label: 'Kitnets (custo do negócio)' },
    { value: 'obra', label: 'Obra / investimento nas kitnets' },
  ] },
  { name: 'category', label: 'Categoria', placeholder: 'Ex: salário, energia solar, alimentação' },
  { name: 'card_name', label: 'Cartão / Conta', placeholder: 'Nubank, Santander, Pix Mercado Pago' },
  { name: 'installment', label: 'Parcela', placeholder: 'Ex: 12/24' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'previsto', label: 'Previsto' },
    { value: 'pendente', label: 'Pendente' },
    { value: 'pago', label: 'Pago' },
    { value: 'recebido', label: 'Recebido' },
    { value: 'revisar', label: 'Revisar (importado)' },
    { value: 'ignorar', label: 'Ignorar (não conta no caixa)' },
  ] },
  { name: 'recurring', label: 'Recorrente', type: 'checkbox', help: 'Repete todo mês (salário, parcelas, assinaturas...)' },
];

// "Revisar" (importado do cartão) precisa de atenção; os demais são informativos.
const STATUS_BADGE_COLORS = {
  pago: 'ds-badge-success',
  recebido: 'ds-badge-success',
  pendente: 'ds-badge-warning',
  revisar: 'ds-badge-warning',
  previsto: 'ds-badge-info',
  ignorar: 'ds-badge-info',
};

const columns = [
  { field: 'date', label: 'Data', format: 'date' },
  { field: 'description', label: 'Descrição' },
  { field: 'type', label: 'Tipo' },
  { field: 'context', label: 'Contexto' },
  { field: 'category', label: 'Categoria' },
  { field: 'value', label: 'Valor', format: 'currency', align: 'right' },
  { field: 'status', label: 'Status', format: 'badge' },
];

export const filterByCompetence = (rows = [], competence = '') => (
  rows.filter((row) => String(row.date || '').startsWith(competence))
);

export default function PersonalFinances() {
  const [competence, setCompetence] = useState(() => new Date().toISOString().slice(0, 7));
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const filterRows = useCallback((rows) => filterByCompetence(rows, competence), [competence]);

  const handleGenerate = async () => {
    setGenerating(true);
    setMessage('');

    try {
      const result = await recurringIncomeService.generateForCompetence(competence);
      setMessage(result.created > 0
        ? `${result.created} renda(s) recorrente(s) lançada(s) para ${competence} como "previsto" — confirme o valor real (mudando para "Recebido") quando cair na conta.`
        : `Nenhuma renda nova: as recorrentes de ${competence} já estão lançadas (ou nenhuma renda está marcada como recorrente).`);
      setReloadKey((key) => key + 1);
    } catch {
      setMessage('Não foi possível gerar as rendas. Tente novamente.');
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
          {generating ? 'Gerando...' : `Gerar rendas de ${competence}`}
        </button>
      </div>

      {message ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{message}</div>
      ) : null}

      <EntityPage
        key={reloadKey}
        title="Finanças Pessoais"
        subtitle="Receitas e despesas pessoais do mês em foco — marque o contexto (ex.: Trabalho/Servidor para o salário) e use 'Recorrente' + 'Gerar rendas' para o que entra todo mês."
        entity="PersonalIncome"
        fields={fields}
        cardFields={['date', 'description', 'value']}
        columns={columns}
        badgeColors={STATUS_BADGE_COLORS}
        checkDuplicate={findPersonalDuplicateOf}
        filterRows={filterRows}
      />
    </div>
  );
}
