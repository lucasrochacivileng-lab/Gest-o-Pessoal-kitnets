import { buildFinancialLedger, ledgerTotals } from '../services/financialLedger.js';
import { normalizeCategory, categoryLabel } from '../services/categoryReportService.js';
import { useReportFilters } from '../hooks/useReportFilters.js';
import { useEntitySync } from '../hooks/useEntitySync.js';
import { SEGMENTS } from '../services/financialClassification.js';
import { addMoney } from '../services/money.js';
import { useEffect, useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { repository } from '../repository/index.js';
import { financialService } from '../services/financialService';
import PageHeader from '../components/ui/PageHeader.jsx';

const entities = ['Receivable', 'Payment', 'Expense', 'PersonalIncome', 'ComplementaryProject', 'ExpertReport'];

function downloadCsv(filename, rows) {
  const headers = Object.keys(rows[0] || { info: 'Sem dados' });
  const csv = [
    headers.join(';'),
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replaceAll('"', '""')}"`).join(';')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}


function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function openPrintableHtml(html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const reportWindow = window.open(url, '_blank');

  if (reportWindow) {
    reportWindow.focus();
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const { month, segment, setMonth, setSegment } = useReportFilters();
  const year = month.slice(0,4);
  const load = async () => {
    try {
      const results = await Promise.all(entities.map(entity=>repository.list(entity)));
      setData(Object.fromEntries(entities.map((entity,i)=>[entity,results[i]]))); setError('');
    } catch(e) { setError(e.message); }
  };
  useEffect(()=>{load();},[]);
  useEntitySync(entities,load);
  const reportData = useMemo(()=>{
    if(!data) return null;
    const items = buildFinancialLedger({payments:data.Payment,expenses:data.Expense,personal:data.PersonalIncome,projects:data.ComplementaryProject,expertReports:data.ExpertReport})
      .filter(row=>row.date.startsWith(year)&&(!segment||row.segment===segment));
    const totals = ledgerTotals(items);
    const categories = items.filter(r=>r.kind==='saida').reduce((acc,row)=>{
      const key=categoryLabel(normalizeCategory(row)); acc[key]=addMoney(acc[key]||0,row.value); return acc;
    },{});
    return {...totals,revenue:totals.income,expenseTotal:totals.expense,profit:totals.result,items,categories,
      receivables:data.Receivable.filter(r=>r.competence?.startsWith(year))};
  },[data,year,segment]);
  const cashflowRows = (reportData?.items||[]).map(row=>({data:row.date,tipo:row.kind,segmento:row.segment,categoria:categoryLabel(normalizeCategory(row)),descricao:row.description,valor:row.kind==='entrada'?row.value:-row.value}));
  const expenseCategoryRows = Object.entries(reportData?.categories||{}).map(([category,value])=>({categoria:category,valor:value}));

  const printAnnualStatement = () => {
    const safeYear = escapeHtml(year);
    const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Demonstrativo anual ${safeYear}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 40px; }
      h1 { margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th, td { border-bottom: 1px solid #cbd5e1; padding: 10px; text-align: left; }
      .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 24px; }
      .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
      @media print { button { display: none; } body { margin: 20px; } }
    </style>
  </head>
  <body>
    <button onclick="window.print()">Imprimir / salvar em PDF</button>
    <h1>Demonstrativo anual de movimentações</h1>
    <p>Ano ${safeYear} · ${escapeHtml(SEGMENTS.find(s=>s.key===segment)?.label || "Todos os segmentos")} · Lançamentos confirmados</p>
    <div class="cards">
      <div class="card">Receitas<br /><strong>${financialService.formatCurrency(reportData.revenue)}</strong></div>
      <div class="card">Despesas<br /><strong>${financialService.formatCurrency(reportData.expenseTotal)}</strong></div>
      <div class="card">Resultado<br /><strong>${financialService.formatCurrency(reportData.profit)}</strong></div>
    </div>
    <table>
      <thead><tr><th>Categoria</th><th>Valor</th></tr></thead>
      <tbody>
        ${expenseCategoryRows.map((row) => `<tr><td>${escapeHtml(row.categoria)}</td><td>${financialService.formatCurrency(row.valor)}</td></tr>`).join('')}
      </tbody>
    </table>
  </body>
</html>`;

    openPrintableHtml(html);
  };

  if (!reportData) return <div role="status" className="ds-card">{error || "Carregando relatórios..."}{error && <button onClick={load}>Tentar novamente</button>}</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Todas as fontes confirmadas do ano e segmento selecionados, com as mesmas regras da análise mensal." actions={(
        <label className="text-sm text-slate-600">
          Ano
          <input type="number" min="1900" max="2200" value={year} onChange={(event) => { if (/^\d{4}$/.test(event.target.value)) setMonth(`${event.target.value}-${month.slice(5)}`); }} className="ds-input mt-2 w-32" />
        </label>
      )} />

      {error && <p role="alert">{error}</p>}
      <label className="block text-sm">Segmento<select className="ds-input mt-1 max-w-sm" value={segment} onChange={e=>setSegment(e.target.value)}><option value="">Todos os segmentos</option>{SEGMENTS.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Receitas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{financialService.formatCurrency(reportData.revenue)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Despesas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{financialService.formatCurrency(reportData.expenseTotal)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Resultado</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{financialService.formatCurrency(reportData.profit)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button type="button" onClick={() => downloadCsv(`fluxo-caixa-${year}.csv`, cashflowRows)} className="ds-btn ds-btn-secondary py-3">
          <Download className="h-4 w-4" /> Fluxo de caixa
        </button>
        <button type="button" onClick={() => downloadCsv(`recebiveis-${year}.csv`, reportData.receivables)} className="ds-btn ds-btn-secondary py-3">
          <Download className="h-4 w-4" /> Aluguéis previstos no ano (todos)
        </button>
        <button type="button" onClick={() => downloadCsv(`despesas-categoria-${year}.csv`, expenseCategoryRows)} className="ds-btn ds-btn-secondary py-3">
          <Download className="h-4 w-4" /> Despesas por categoria
        </button>
        <button type="button" onClick={printAnnualStatement} className="ds-btn ds-btn-secondary py-3">
          <Printer className="h-4 w-4" /> Demonstrativo anual PDF
        </button>
      </div>
    </div>
  );
}
