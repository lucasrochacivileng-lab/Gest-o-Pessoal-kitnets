import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Save, Upload } from 'lucide-react';
import EntityPage from '../components/ui/EntityPage.jsx';
import { repository } from '../repository/index.js';
import {
  buildInstallmentPreview,
  parseStatementFile,
  summarizeByCategory,
} from '../services/cardStatementImportService.js';

const fields = [
  { name: 'card_name', label: 'Nome do cartão', placeholder: 'Visa Platinum' },
  { name: 'bank', label: 'Banco', placeholder: 'Itaú, Nubank' },
  { name: 'purchase_date', label: 'Data da compra', type: 'date' },
  { name: 'description', label: 'Descrição', placeholder: 'Compra de material' },
  { name: 'category', label: 'Categoria', type: 'select', options: [
    { value: 'aluguel', label: 'Aluguel' },
    { value: 'obra', label: 'Obra' },
    { value: 'pessoal', label: 'Pessoal' },
    { value: 'outro', label: 'Outro' },
  ] },
  { name: 'value', label: 'Valor', type: 'number', placeholder: '1200' },
  { name: 'total_installments', label: 'Parcelas totais', type: 'number', placeholder: '6' },
  { name: 'current_installment', label: 'Parcela atual', type: 'number', placeholder: '1' },
  { name: 'due_date', label: 'Vencimento', type: 'date' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'pendente', label: 'Pendente' },
    { value: 'pago', label: 'Pago' },
  ] },
  { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Detalhes do cartão' },
];

const cardOptions = ['Nubank', 'Santander', 'Itaú', 'Amazon Brasil', 'Mercado Pago Pai'];
const categoryOptions = [
  'alimentacao',
  'mercado',
  'combustivel',
  'transporte',
  'farmacia',
  'lazer',
  'assinatura',
  'material de construcao',
  'investimento kitnets',
  'familia',
  'impostos',
  'emprestimos',
  'outros',
];
const contextOptions = [
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'kitnets', label: 'Kitnets' },
  { value: 'obra', label: 'Obra / investimento' },
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

export default function CreditCards() {
  const [defaultCardName, setDefaultCardName] = useState('Nubank');
  const [statementMonth, setStatementMonth] = useState(currentMonth());
  const [dueDay, setDueDay] = useState(10);
  const [previewRows, setPreviewRows] = useState([]);
  const [kitnets, setKitnets] = useState([]);
  const [existingTransactions, setExistingTransactions] = useState([]);
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const loadReferenceData = async () => {
    const [kitnetRows, personalRows] = await Promise.all([
      repository.list('Kitnet'),
      repository.list('PersonalIncome'),
    ]);

    setKitnets(kitnetRows);
    setExistingTransactions(personalRows.filter((row) => row.type === 'card_transaction'));
  };

  useEffect(() => {
    loadReferenceData();
  }, []);

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
                  <th className="px-2 py-2">Contexto</th>
                  <th className="px-2 py-2">Kitnet</th>
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
                        {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select value={row.context || 'pessoal'} onChange={(event) => updatePreviewRow(row.preview_id, { context: event.target.value })} className="ds-input min-w-44">
                        {contextOptions.map((context) => <option key={context.value} value={context.value}>{context.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select value={row.kitnet_id || ''} onChange={(event) => updatePreviewRow(row.preview_id, { kitnet_id: event.target.value })} className="ds-input min-w-40">
                        <option value="">Sem vínculo</option>
                        {kitnets.map((kitnet) => <option key={kitnet.id} value={kitnet.id}>{kitnet.name}</option>)}
                      </select>
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
        subtitle="Use esta área para cadastrar ou editar uma compra avulsa sem importar fatura."
        entity="CreditCard"
        fields={fields}
        cardFields={['card_name', 'bank']}
      />
    </div>
  );
}
