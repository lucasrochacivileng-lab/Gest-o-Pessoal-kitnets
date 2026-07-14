import React, { useCallback, useState } from 'react';
import { Wand2 } from 'lucide-react';
import EntityPage from '../components/ui/EntityPage.jsx';
import { repository } from '../repository/index.js';
import { categoryLabel } from '../services/categoryReportService.js';
import {
  CLASSIFICATION_RULE_ENTITY,
  CLASSIFICATION_OPTIONS,
  RULE_SEGMENT_OPTIONS,
  planRuleUpdates,
} from '../services/classificationRuleService.js';

const SEGMENT_LABELS = Object.fromEntries(RULE_SEGMENT_OPTIONS.map((s) => [s.value, s.label]));
const segmentLabel = (value) => (value ? SEGMENT_LABELS[value] || value : '—');

const fields = [
  { name: 'keyword', label: 'Palavra-chave na descrição', type: 'text', placeholder: 'ex: amazon, leroy, ifood, uber' },
  { name: 'category', label: 'Classificação a aplicar', type: 'select', options: CLASSIFICATION_OPTIONS },
  { name: 'segment', label: 'Origem a aplicar (opcional)', type: 'select', options: RULE_SEGMENT_OPTIONS },
  { name: 'card_name', label: 'Cartão (opcional)', type: 'text', placeholder: 'Vazio = qualquer cartão' },
  { name: 'priority', label: 'Prioridade (menor roda primeiro)', type: 'number', placeholder: '0', default: 0 },
  { name: 'enabled', label: 'Regra ativa', type: 'checkbox', help: 'Desmarque para desligar a regra sem apagá-la', default: true },
];

const columns = [
  { field: 'keyword', label: 'Palavra-chave' },
  { field: 'category', label: 'Classificação', formatValue: categoryLabel },
  { field: 'segment', label: 'Origem', formatValue: segmentLabel },
  { field: 'card_name', label: 'Cartão' },
  { field: 'priority', label: 'Prioridade', align: 'right' },
  { field: 'enabled', label: 'Ativa', format: 'boolean' },
];

export default function ClassificationRules() {
  const [rules, setRules] = useState([]);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');

  // Reaplica as regras aos lançamentos de cartão JÁ existentes (Finanças
  // Pessoais, type card_transaction). Planeja antes, confirma, e só então grava
  // — mostrando quantos mudaram.
  const handleApplyToExisting = useCallback(async () => {
    setApplying(true);
    setMessage('');
    try {
      const personal = await repository.list('PersonalIncome');
      const cardTransactions = personal.filter((row) => row.type === 'card_transaction');
      const updates = planRuleUpdates(rules, cardTransactions);

      if (!updates.length) {
        setMessage('Nenhum lançamento precisou mudar — tudo já bate com as regras (ou não há regras ativas).');
        return;
      }

      const confirmed = window.confirm(
        `${updates.length} lançamento(s) de cartão serão reclassificados pelas regras atuais. Aplicar agora?`,
      );
      if (!confirmed) return;

      let done = 0;
      for (const update of updates) {
        // Sequencial de propósito: são poucas linhas e evita rajada de escrita
        // no Supabase; se uma falhar, as anteriores já ficaram salvas.
        // eslint-disable-next-line no-await-in-loop
        await repository.update('PersonalIncome', update.id, update.changes);
        done += 1;
      }
      setMessage(`${done} lançamento(s) reclassificado(s) pelas regras.`);
    } catch (error) {
      setMessage(`Não foi possível aplicar as regras: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    } finally {
      setApplying(false);
    }
  }, [rules]);

  const topContent = (
    <div className="space-y-3">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Como funciona</p>
        <p className="mt-1">
          Cada regra tem um <strong>gatilho</strong> (uma palavra que aparece na descrição, ex.: "amazon") e uma{' '}
          <strong>ação</strong> (a classificação — e, se quiser, a origem — a aplicar). Ao importar uma fatura, a
          primeira regra que casar manda na classificação; sem regra, vale o classificador automático embutido.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleApplyToExisting}
          disabled={applying}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          <Wand2 className="h-4 w-4" /> {applying ? 'Aplicando...' : 'Aplicar às existentes'}
        </button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </div>
    </div>
  );

  return (
    <EntityPage
      title="Regras de classificação"
      subtitle="Automatize a classificação das compras de cartão por palavra na descrição."
      entity={CLASSIFICATION_RULE_ENTITY}
      fields={fields}
      cardFields={['keyword', 'category']}
      columns={columns}
      onRowsChange={setRules}
      topContent={topContent}
    />
  );
}
