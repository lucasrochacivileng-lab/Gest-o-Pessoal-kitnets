import { useEffect, useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { repository } from '../repository/index.js';
import { financialService } from '../services/financialService';

const entities = ['Receivable', 'Payment', 'Expense', 'Contract'];

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

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

const paymentValue = financialService.netPaymentValue;

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
  const [data, setData] = useState({ Receivable: [], Payment: [], Expense: [], Contract: [] });
  const [year, setYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    Promise.all(entities.map((entity) => repository.list(entity))).then((results) => {
      setData(entities.reduce((acc, entity, index) => ({ ...acc, [entity]: results[index] }), {}));
    });
  }, []);

  const reportData = useMemo(() => {
    const payments = data.Payment.filter((row) => row.payment_date?.startsWith(year));
    // Demonstrativo de IR do aluguel (carnê-leão) é regime de CAIXA: a receita
    // já usa só pagamentos recebidos, então a despesa também tem que ser só a
    // efetivamente paga (status 'pago'), como no cashflowService/Extrato/Caixa
    // geral. Antes somava toda despesa lançada (paga ou não), misturando caixa
    // (receita) com competência (despesa) e podendo deduzir conta não paga.
    const expenses = data.Expense.filter((row) => row.date?.startsWith(year) && row.status === 'pago');
    const receivables = data.Receivable.filter((row) => row.competence?.startsWith(year));
    const revenue = payments.reduce((total, payment) => total + paymentValue(payment), 0);
    const expenseTotal = sum(expenses, 'value');
    const categories = expenses.reduce((acc, row) => {
      const category = row.category || 'outro';
      acc[category] = (acc[category] || 0) + Number(row.value || 0);
      return acc;
    }, {});

    return { payments, expenses, receivables, revenue, expenseTotal, profit: revenue - expenseTotal, categories };
  }, [data, year]);

  const cashflowRows = [
    ...reportData.payments.map((row) => ({
      data: row.payment_date,
      tipo: 'receita',
      descricao: row.notes || row.receipt_number || row.id,
      valor: paymentValue(row),
    })),
    ...reportData.expenses.map((row) => ({
      data: row.date,
      tipo: 'despesa',
      descricao: row.description || row.category || row.id,
      valor: -Number(row.value || 0),
    })),
  ].sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')));

  const expenseCategoryRows = Object.entries(reportData.categories).map(([category, value]) => ({ categoria: category, valor: value }));

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
    <h1>Demonstrativo anual para imposto de renda</h1>
    <p>Ano-base ${safeYear}</p>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios</h1>
          <p className="text-sm text-slate-500">Exportações financeiras em CSV e demonstrativo anual imprimível.</p>
        </div>
        <label className="text-sm text-slate-600">
          Ano
          <input value={year} onChange={(event) => setYear(event.target.value)} className="mt-2 w-32 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Receitas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{financialService.formatCurrency(reportData.revenue)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Despesas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{financialService.formatCurrency(reportData.expenseTotal)}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Resultado</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{financialService.formatCurrency(reportData.profit)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button type="button" onClick={() => downloadCsv(`fluxo-caixa-${year}.csv`, cashflowRows)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          <Download className="h-4 w-4" /> Fluxo de caixa
        </button>
        <button type="button" onClick={() => downloadCsv(`recebiveis-${year}.csv`, reportData.receivables)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          <Download className="h-4 w-4" /> Recebíveis por período
        </button>
        <button type="button" onClick={() => downloadCsv(`despesas-categoria-${year}.csv`, expenseCategoryRows)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          <Download className="h-4 w-4" /> Despesas por categoria
        </button>
        <button type="button" onClick={printAnnualStatement} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          <Printer className="h-4 w-4" /> Demonstrativo anual PDF
        </button>
      </div>
    </div>
  );
}
