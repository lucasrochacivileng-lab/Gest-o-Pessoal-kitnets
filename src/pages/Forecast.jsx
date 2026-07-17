import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { repository } from '../repository/index.js';
import { buildForecast } from '../services/forecastService.js';
import { MonthChips } from '../components/ui/MonthChips.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';

const money = (value = 0) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonthKey = () => new Date().toISOString().slice(0, 7);

const dayOf = (date) => {
  const day = String(date || '').slice(8, 10);
  return day ? `dia ${Number(day)}` : '—';
};

function ForecastTable({ title, rows, total, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className={`text-lg font-semibold ${tone}`}>{money(total)}</p>
      </div>
      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3">Quando</th>
                <th className="py-2 pr-3">Item</th>
                <th className="hidden py-2 pr-3 sm:table-cell">Origem</th>
                <th className="py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.label}-${index}`} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap py-2.5 pr-3 font-medium text-slate-500">{dayOf(row.date)}</td>
                  <td className="py-2.5 pr-3 font-medium text-slate-900">
                    {row.label}
                    <span className="flex items-center gap-1 text-xs font-normal text-slate-400 sm:hidden">
                      {row.source}
                      {row.received ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : null}
                    </span>
                  </td>
                  <td className="hidden py-2.5 pr-3 text-xs text-slate-500 sm:table-cell">
                    <span className="flex items-center gap-1">
                      {row.source}
                      {row.received ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : null}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-right font-semibold text-slate-900">{money(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Nada previsto para este mês.</p>
      )}
    </div>
  );
}

export default function Forecast() {
  const [month, setMonth] = useState(currentMonthKey);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [contracts, receivables, kitnets, expenses, personal, projects, expertReports] = await Promise.all([
        repository.list('Contract'),
        repository.list('Receivable'),
        repository.list('Kitnet'),
        repository.list('Expense'),
        repository.list('PersonalIncome'),
        repository.list('ComplementaryProject'),
        repository.list('ExpertReport'),
      ]);
      setData({ contracts, receivables, kitnets, expenses, personal, projects, expertReports });
      setLoading(false);
    };

    load();
  }, []);

  const forecast = useMemo(() => {
    if (!data) return null;
    return buildForecast({ ...data, month, currentMonth: currentMonthKey() });
  }, [data, month]);

  return (
    <div className="space-y-6">
      <PageHeader title="Previsão" description="Entradas e saídas previstas: aluguéis, projetos, parcelas e orçamento." />

      <MonthChips value={month} onChange={setMonth} />

      {loading || !forecast ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">Calculando previsão...</div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-normal text-slate-500">Saldo previsto do mês</p>
            <p className={`mt-2 text-3xl font-bold ${forecast.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{money(forecast.balance)}</p>
            <p className="mt-1 text-sm text-slate-500">{money(forecast.totalIn)} previstos para entrar − {money(forecast.totalOut)} previstos para sair</p>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <ForecastTable title="Receitas previstas" rows={forecast.incomes} total={forecast.totalIn} tone="text-emerald-600" />
            <ForecastTable title="Despesas previstas" rows={forecast.outgoings} total={forecast.totalOut} tone="text-red-600" />
          </div>

          <p className="text-xs text-slate-500">
            Dica: cadastre em Finanças Pessoais os itens recorrentes (salário, parcelas, orçamento médio de alimentação/combustível)
            marcando "Recorrente" — eles passam a aparecer aqui em todos os meses futuros.
          </p>
        </>
      )}
    </div>
  );
}
