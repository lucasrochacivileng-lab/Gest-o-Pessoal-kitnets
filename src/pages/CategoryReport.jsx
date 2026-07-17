import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { repository } from '../repository/index.js';
import { buildCategoryReport, buildCategoryTrend, categoryLabel } from '../services/categoryReportService.js';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';

const money = (value = 0) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonthKey = () => new Date().toISOString().slice(0, 7);
const shortMonth = (key) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('pt-BR', { month: 'short' });
};

const lastMonths = (count, endKey) => {
  const [year, month] = endKey.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - 1 - (count - 1 - index), 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
};

export default function CategoryReport() {
  const [month, setMonth] = useState(currentMonthKey);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([repository.list('Expense'), repository.list('PersonalIncome')]).then(([expenses, personal]) => {
      setData({ expenses, personal });
    });
  }, []);

  const report = useMemo(() => {
    if (!data) return null;
    return buildCategoryReport({ ...data, month });
  }, [data, month]);

  const trend = useMemo(() => {
    if (!data) return [];
    return buildCategoryTrend({ ...data, months: lastMonths(6, month), category: selectedCategory })
      .map((row) => ({ ...row, label: shortMonth(row.month) }));
  }, [data, month, selectedCategory]);

  if (!report) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">Carregando gastos...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Gastos por categoria" description="Gastos pagos e parcelas de cartão no mês de vencimento, separados por classificação." />

      <MonthChips value={month} onChange={(value) => { setMonth(value); setSelectedCategory(null); }} />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Total do mês</h2>
          <p className="text-xl font-bold text-slate-900">{money(report.grandTotal)}</p>
        </div>

        {report.cardCount ? (
          <p className="mt-2 text-sm text-slate-600">
            Inclui {money(report.cardTotal)} de cartão em {report.cardCount} lançamento(s)
            {report.cardReviewCount ? `; ${report.cardReviewCount} ainda com categoria a revisar` : ''}.
          </p>
        ) : null}

        {report.rows.length ? (
          <div className="mt-4 space-y-3">
            {report.rows.map((row) => {
              const active = selectedCategory === row.category;
              return (
                <button
                  key={row.category}
                  type="button"
                  onClick={() => setSelectedCategory(active ? null : row.category)}
                  className={`w-full rounded-[var(--radius-lg)] border p-3 text-left transition ${active ? 'border-blue-300 bg-blue-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-900">{row.label}</span>
                    <span className="font-semibold text-slate-900">{money(row.total)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round(row.share * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {Math.round(row.share * 100)}% · {row.count} lançamento(s) · {row.origins.join(' + ')}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Nenhum gasto lançado neste mês.</p>
        )}
      </div>

      {report.excluded.length ? (
        <details className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-amber-900">
            Não contabilizados neste mês ({report.excluded.length})
          </summary>
          <p className="mt-1 text-xs text-amber-700">Pendências, itens ignorados, transferências e lançamentos sem valor ficam fora do total.</p>
          <div className="mt-3 divide-y divide-amber-200">
            {report.excluded.map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-4 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{row.description}</p>
                  <p className="text-xs text-amber-700">{row.reason}</p>
                </div>
                <span className="flex-shrink-0 font-semibold text-slate-700">{money(row.value)}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {selectedCategory ? <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Evolução — {categoryLabel(selectedCategory)} (6 meses)
        </h2>
        <p className="text-xs text-slate-500">Toque na categoria de novo para fechar a evolução.</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => money(value)} />
              <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div> : null}
    </div>
  );
}
