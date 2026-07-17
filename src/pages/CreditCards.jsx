import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Save, Upload } from 'lucide-react';
import EntityPage from '../components/ui/EntityPage.jsx';
import { repository } from '../repository/index.js';
import {
  buildInstallmentPreview,
  parseStatementFile,
  summarizeByCategory,
} from '../services/cardStatementImportService.js';
import { CLASSIFICATION_RULE_ENTITY } from '../services/classificationRuleService.js';
import { CARD_CATEGORY_OPTIONS } from '../services/categoryCatalog.js';
import { SEGMENTS } from '../services/segmentConsolidationService.js';
import { findSiblingTransactions } from '../services/cardInvoiceService.js';
import { buildCardBalances } from '../services/cardBalanceService.js';

const segmentOptions = SEGMENTS.map((segment) => ({ value: segment.key, label: segment.label }));
const expertReportLabel = (report) => [report.client, report.process_number].filter(Boolean).join(' — ') || report.report_type || report.id;
const projectLabel = (project) => [project.client, project.project_type].filter(Boolean).join(' — ') || project.address || project.id;
// Ao salvar, o `context` (usado pela divisão Pessoal/Kitnets das faturas)
// segue o segmento: só o segmento Kitnets é custo do imóvel — mantém 'obra'
// quando a classificação marcou investimento, para o card de investimento
// continuar somando certo; os demais segmentos entram como pessoal.
const contextForSegment = (row) => {
  if (row.segment === 'kitnets') return row.context === 'obra' ? 'obra' : 'kitnets';
  return 'pessoal';
};

// Ao salvar, mantém só o vínculo do segmento escolhido — se o usuário trocou
// de segmento na prévia depois do auto-preenchimento, os outros vínculos não
// vão como "órfãos" no registro.
const linksForSegment = (row) => ({
  kitnet_id: row.segment === 'kitnets' ? (row.kitnet_id || '') : '',
  expert_report_id: row.segment === 'pericias' ? (row.expert_report_id || '') : '',
  project_id: row.segment === 'projetos' ? (row.project_id || '') : '',
});

const STATUS_BADGE_COLORS = {
  pago: 'ds-badge-success',
  pendente: 'ds-badge-warning',
};

const cardOptions = ['Nubank', 'Santander', 'Itaú', 'Amazon Brasil', 'Mercado Pago Pai'];
// Categorias do catálogo único (categoryCatalog.js) — mesma lista das Regras
// de classificação e do seletor inline de Despesas.
const categoryOptions = CARD_CATEGORY_OPTIONS;

// Mesmo formato que uma linha importada de fatura (cardStatementImportService
// buildInstallmentPreview): "date" é o vencimento usado por cardInvoiceService
// para agrupar por mês, e "type: card_transaction" (via defaultValues abaixo)
// é o que faz o lançamento entrar nas faturas de Despesas e nos relatórios.
const fields = [
  { name: 'date', label: 'Vencimento', type: 'date' },
  { name: 'card_name', label: 'Nome do cartão', placeholder: 'Nubank, Santander...' },
  { name: 'description', label: 'Descrição', placeholder: 'Compra de material' },
  { name: 'category', label: 'Categoria', type: 'select', options: categoryOptions },
  { name: 'segment', label: 'Segmento', type: 'select', options: segmentOptions },
  // Vínculo condicional ao segmento (mesma lógica da tela de Despesas).
  { name: 'kitnet_id', label: 'Kitnet', type: 'select', optionsEntity: 'Kitnet', extraOptions: [
    { value: 'geral', label: 'Geral (rateado entre as unidades)' },
    // `!form.segment` mantém o campo visível ao editar um lançamento antigo
    // (sem segmento) que já tinha kitnet — senão o EntityPage limparia o
    // kitnet_id ao salvar, apagando o vínculo existente.
  ], visibleWhen: (form) => !form.segment || form.segment === 'kitnets' },
  { name: 'expert_report_id', label: 'Perícia', type: 'select', optionsEntity: 'ExpertReport', optionLabel: expertReportLabel, visibleWhen: (form) => form.segment === 'pericias' },
  { name: 'project_id', label: 'Projeto', type: 'select', optionsEntity: 'ComplementaryProject', optionLabel: projectLabel, visibleWhen: (form) => form.segment === 'projetos' },
  { name: 'value', label: 'Valor', type: 'number', placeholder: '1200' },
  { name: 'installment', label: 'Parcela', placeholder: '1/1' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'pendente', label: 'Pendente' },
    { value: 'pago', label: 'Pago' },
  ] },
  { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Detalhes da compra' },
];

const segmentLabelMap = Object.fromEntries(segmentOptions.map((segment) => [segment.value, segment.label]));
const cardSegmentLabel = (value) => segmentLabelMap[value] || '';

const manualColumnDefinitions = [
  { field: 'date', label: 'Vencimento', format: 'date' },
  { field: 'description', label: 'Descrição' },
  { field: 'card_name', label: 'Cartão' },
  { field: 'category', label: 'Categoria' },
  { field: 'segment', label: 'Segmento', formatValue: cardSegmentLabel },
  { field: 'value', label: 'Valor', format: 'currency', align: 'right' },
  { field: 'status', label: 'Status', format: 'badge' },
];

const money = (value = 0) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

function pickRow(row) {
  const { preview_id, duplicate, selected, ...payload } = row;
  return payload;
}

// PersonalIncome também guarda receita/despesa pessoal comum (Finanças
// Pessoais) — sem esse filtro, o formulário desta página listaria e deixaria
// editar registros que não são de cartão nenhum.
export const filterCardTransactions = (rows = []) => rows.filter((row) => row.type === 'card_transaction');

export default function CreditCards() {
  const [defaultCardName, setDefaultCardName] = useState('Nubank');
  const [statementMonth, setStatementMonth] = useState(currentMonth());
  const [dueDay, setDueDay] = useState(10);
  const [previewRows, setPreviewRows] = useState([]);
  const [kitnets, setKitnets] = useState([]);
  const [expertReports, setExpertReports] = useState([]);
  const [projects, setProjects] = useState([]);
  const [existingTransactions, setExistingTransactions] = useState([]);
  // Guardado inteiro (e não só as compras) porque o saldo do cartão precisa
  // também dos pagamentos de fatura ('card_payment'), que abatem a dívida.
  const [allPersonal, setAllPersonal] = useState([]);
  const [rules, setRules] = useState([]);
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingCategoryId, setSavingCategoryId] = useState('');

  const loadReferenceData = useCallback(async () => {
    const [kitnetRows, personalRows, expertReportRows, projectRows, ruleRows] = await Promise.all([
      repository.list('Kitnet'),
      repository.list('PersonalIncome'),
      repository.list('ExpertReport'),
      repository.list('ComplementaryProject'),
      repository.list(CLASSIFICATION_RULE_ENTITY),
    ]);

    setKitnets(kitnetRows);
    setExpertReports(expertReportRows);
    setProjects(projectRows);
    setExistingTransactions(personalRows.filter((row) => row.type === 'card_transaction'));
    setAllPersonal(personalRows);
    setRules(ruleRows);
  }, []);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  const handleCategoryChange = useCallback(async (item, category, reload) => {
    if (!item?.id || category === item.category) return;

    const siblings = findSiblingTransactions(existingTransactions, item)
      .filter((row) => row.category !== category);
    const propagate = siblings.length > 0 && window.confirm(
      `Esta compra tem mais ${siblings.length} parcela(s). Aplicar a categoria `
      + `"${categoryOptions.find((option) => option.value === category)?.label || category}" a todas?`,
    );
    const targets = propagate ? [item, ...siblings] : [item];

    setSavingCategoryId(item.id);
    setMessage('');
    try {
      for (const target of targets) {
        // Mantém as parcelas sincronizadas sem disparar uma rajada de escritas.
        // eslint-disable-next-line no-await-in-loop
        await repository.update('PersonalIncome', target.id, { category });
      }
      await Promise.all([loadReferenceData(), reload?.()]);
      setMessage(
        `Categoria atualizada em ${targets.length} lançamento(s). `
        + 'Despesas, faturas e relatórios já usam essa mesma classificação.',
      );
    } catch (error) {
      setMessage(`Não foi possível atualizar a categoria: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
      await Promise.all([loadReferenceData(), reload?.()]);
    } finally {
      setSavingCategoryId('');
    }
  }, [existingTransactions, loadReferenceData]);

  const manualColumns = useMemo(() => manualColumnDefinitions.map((column) => (
    column.field !== 'category' ? column : {
      ...column,
      renderCell: ({ row, reload }) => {
        const knownCategory = categoryOptions.some((option) => option.value === row.category);
        return (
          <select
            value={row.category || 'outros'}
            disabled={savingCategoryId === row.id}
            onChange={(event) => handleCategoryChange(row, event.target.value, reload)}
            aria-label={`Categoria de ${row.description || 'lançamento de cartão'}`}
            className="min-w-44 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          >
            {!knownCategory && row.category ? <option value={row.category}>{row.category}</option> : null}
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        );
      },
    }
  )), [handleCategoryChange, savingCategoryId]);

  const cardBalances = useMemo(() => buildCardBalances({ personal: allPersonal }), [allPersonal]);

  const selectedRows = previewRows.filter((row) => row.selected && !row.duplicate);
  const duplicateCount = previewRows.filter((row) => row.duplicate).length;
  const categorySummary = useMemo(() => summarizeByCategory(selectedRows), [selectedRows]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage('');
    setFileName(file.name);

    try {
      const transactions = await parseStatementFile(file, { defaultCardName });
      const preview = buildInstallmentPreview({
        transactions,
        statementMonth,
        dueDay,
        defaultCardName,
        existingTransactions,
        kitnets,
        rules,
      }).map((row, index) => ({
        ...row,
        preview_id: `${row.origin_hash}-${index}`,
        selected: !row.duplicate,
      }));

      setPreviewRows(preview);
      setMessage(preview.length
        ? `${transactions.length} compra(s) lida(s), gerando ${preview.length} parcela(s) para revisão.`
        : 'Não encontrei lançamentos válidos na fatura. Confira se há colunas de data, descrição e valor.');
    } catch (error) {
      setPreviewRows([]);
      setMessage(`Não consegui ler a fatura: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  };

  const updatePreviewRow = (previewId, payload) => {
    setPreviewRows((rows) => rows.map((row) => (
      row.preview_id === previewId ? { ...row, ...payload } : row
    )));
  };

  const saveImport = async () => {
    if (!selectedRows.length) {
      setMessage('Nenhuma parcela selecionada para salvar.');
      return;
    }

    setSaving(true);
    try {
      const batch = await repository.create('ImportBatch', {
        file_name: fileName || 'fatura-cartao',
        file_type: 'card_statement',
        source: defaultCardName,
        status: 'importado',
        rows_total: previewRows.length,
        rows_imported: selectedRows.length,
        metadata: {
          statementMonth,
          dueDay,
          duplicateCount,
        },
        active: true,
      });

      await Promise.all(selectedRows.map((row) => repository.create('PersonalIncome', {
        ...pickRow(row),
        context: contextForSegment(row),
        ...linksForSegment(row),
        imported_batch_id: batch.id,
      })));

      setMessage(`${selectedRows.length} parcela(s) importada(s). Elas ficaram em Finanças Pessoais como "Revisar".`);
      setPreviewRows([]);
      await loadReferenceData();
    } catch (error) {
      setMessage(`Falha ao salvar importação: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {cardBalances.cards.length > 0 ? (
        <div className="ds-card">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Quanto você deve</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Saldo dos cartões</h2>
            </div>
            <p className="text-right">
              <span className="block text-xs text-slate-500">Total em aberto</span>
              <span className="text-xl font-semibold text-slate-900">{money(cardBalances.totalBalance)}</span>
            </p>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Compras lançadas menos faturas já pagas. Pagar a fatura não é gasto novo — o gasto foi contado na compra.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cardBalances.cards.map((card) => (
              <div key={card.key} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-900">{card.cardName}</p>
                <p className={`mt-1 text-lg font-semibold ${card.balance > 0 ? 'text-slate-900' : 'text-emerald-600'}`}>
                  {money(card.balance)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {money(card.charged)} em compras − {money(card.paid)} pagos
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="ds-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Importação de fatura</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Cartões</h1>
            <p className="mt-1 text-sm text-slate-500">
              Suba CSV ou Excel, revise categoria/contexto e gere parcelas futuras automaticamente.
            </p>
          </div>
          <label className="ds-btn ds-btn-primary cursor-pointer">
            <Upload className="h-4 w-4" /> Subir fatura
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
          </label>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <label className="ds-form-field">
            Cartão padrão
            <select value={defaultCardName} onChange={(event) => setDefaultCardName(event.target.value)} className="ds-input">
              {cardOptions.map((card) => <option key={card} value={card}>{card}</option>)}
            </select>
          </label>
          <label className="ds-form-field">
            Mês da fatura
            <input type="month" value={statementMonth} onChange={(event) => setStatementMonth(event.target.value)} className="ds-input" />
          </label>
          <label className="ds-form-field">
            Dia de vencimento
            <input type="number" min="1" max="28" value={dueDay} onChange={(event) => setDueDay(Number(event.target.value || 10))} className="ds-input" />
          </label>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Regra</p>
            <p>Parcela importada entra como previsão e fica em revisão antes de contar no caixa.</p>
          </div>
        </div>

        {message ? <div className="mt-4 ds-alert ds-alert-info">{message}</div> : null}
      </div>

      {previewRows.length ? (
        <div className="ds-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Prévia da importação</h2>
              <p className="text-sm text-slate-500">
                {selectedRows.length} selecionada(s), {duplicateCount} duplicada(s) ignorada(s).
              </p>
            </div>
            <button type="button" onClick={saveImport} disabled={saving} className="ds-btn ds-btn-primary disabled:opacity-60">
              <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar parcelas'}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {Object.entries(categorySummary).map(([category, total]) => (
              <div key={category} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{category}</p>
                <p className="mt-1 font-semibold text-slate-900">{money(total)}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[1120px] w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-2 py-2">Usar</th>
                  <th className="px-2 py-2">Vencimento</th>
                  <th className="px-2 py-2">Descrição</th>
                  <th className="px-2 py-2">Valor</th>
                  <th className="px-2 py-2">Cartão</th>
                  <th className="px-2 py-2">Parcela</th>
                  <th className="px-2 py-2">Categoria</th>
                  <th className="px-2 py-2">Segmento</th>
                  <th className="px-2 py-2">Vínculo</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.preview_id} className={row.duplicate ? 'bg-amber-50 text-amber-900' : 'border-t border-slate-100'}>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        disabled={row.duplicate}
                        onChange={(event) => updatePreviewRow(row.preview_id, { selected: event.target.checked })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input type="date" value={row.date || ''} onChange={(event) => updatePreviewRow(row.preview_id, { date: event.target.value })} className="ds-input min-w-36" />
                    </td>
                    <td className="px-2 py-2">
                      <input value={row.description || ''} onChange={(event) => updatePreviewRow(row.preview_id, { description: event.target.value })} className="ds-input min-w-64" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" value={row.value || 0} onChange={(event) => updatePreviewRow(row.preview_id, { value: Number(event.target.value || 0) })} className="ds-input min-w-28" />
                    </td>
                    <td className="px-2 py-2">
                      <input value={row.card_name || ''} onChange={(event) => updatePreviewRow(row.preview_id, { card_name: event.target.value })} className="ds-input min-w-40" />
                    </td>
                    <td className="px-2 py-2">
                      <input value={row.installment || ''} onChange={(event) => updatePreviewRow(row.preview_id, { installment: event.target.value })} className="ds-input min-w-24" />
                    </td>
                    <td className="px-2 py-2">
                      <select value={row.category || 'outros'} onChange={(event) => updatePreviewRow(row.preview_id, { category: event.target.value })} className="ds-input min-w-48">
                        {categoryOptions.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select value={row.segment || 'pessoal'} onChange={(event) => updatePreviewRow(row.preview_id, { segment: event.target.value })} className="ds-input min-w-44">
                        {segmentOptions.map((segment) => <option key={segment.value} value={segment.value}>{segment.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      {row.segment === 'kitnets' ? (
                        <select value={row.kitnet_id || ''} onChange={(event) => updatePreviewRow(row.preview_id, { kitnet_id: event.target.value })} className="ds-input min-w-40">
                          <option value="">Sem vínculo</option>
                          <option value="geral">Geral (rateado)</option>
                          {kitnets.map((kitnet) => <option key={kitnet.id} value={kitnet.id}>{kitnet.name}</option>)}
                        </select>
                      ) : row.segment === 'pericias' ? (
                        <select value={row.expert_report_id || ''} onChange={(event) => updatePreviewRow(row.preview_id, { expert_report_id: event.target.value })} className="ds-input min-w-40">
                          <option value="">Sem vínculo</option>
                          {expertReports.map((report) => <option key={report.id} value={report.id}>{expertReportLabel(report)}</option>)}
                        </select>
                      ) : row.segment === 'projetos' ? (
                        <select value={row.project_id || ''} onChange={(event) => updatePreviewRow(row.preview_id, { project_id: event.target.value })} className="ds-input min-w-40">
                          <option value="">Sem vínculo</option>
                          {projects.map((project) => <option key={project.id} value={project.id}>{projectLabel(project)}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="ds-card text-sm text-slate-500">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <FileSpreadsheet className="h-4 w-4" /> Formatos aceitos
          </div>
          <p className="mt-2">
            CSV/Excel com colunas como Data, Descrição, Valor, Cartão e Parcela. Se a linha vier como 5/21,
            o app gera 5/21 até 21/21 nos meses seguintes.
          </p>
        </div>
      )}

      <EntityPage
        title="Lançamentos manuais de cartão"
        subtitle="Use esta área para cadastrar ou editar uma compra avulsa sem importar fatura. Aparece nas faturas de Despesas junto com o que vem de importação."
        entity="PersonalIncome"
        defaultValues={{ type: 'card_transaction' }}
        filterRows={filterCardTransactions}
        fields={fields}
        cardFields={['card_name', 'description']}
        columns={manualColumns}
        onRowsChange={(rows) => setExistingTransactions(filterCardTransactions(rows))}
        badgeColors={STATUS_BADGE_COLORS}
        relations={[
          { key: 'Kitnet', entity: 'Kitnet' },
          { key: 'ExpertReport', entity: 'ExpertReport' },
          { key: 'ComplementaryProject', entity: 'ComplementaryProject' },
        ]}
      />
    </div>
  );
}
