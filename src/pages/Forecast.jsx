import React, { useEffect, useMemo, useState } from 'react';
import { repository } from '../repository/index.js';
import { buildForecast } from '../services/forecastService.js';
import { MonthChips } from '../components/ui/MonthChips.jsx';

const money = (value = 0) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const currentMonthKey = () => new Date().toISOString().slice(0, 7);

function ForecastList({ title, rows, total, tone }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className={`text-lg font-semibold ${tone}`}>{money(total)}</p>
      </div>
      <div className="mt-4 space-y-2">
        {rows.length ? rows.map((row, index) => (
          <div key={`${row.label}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-900">{row.label}</p>
              <p className="text-xs text-slate-500">{row.source}{row.received ? ' ✓' : ''}</p>
            </div>
            <p className="font-semibold text-slate-900">{money(row.value)}</p>
          </div>
        )) : (
          <p className="text-sm text-slate-500">Nada previsto para este mês.</p>
        )}
      </div>
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Previsão</h1>
        <p className="text-sm text-slate-500">O que deve entrar e sair em qualquer mês — aluguéis, projetos, parcelas e orçamento.</p>
      </div>

      <MonthChips value={month} onChange={setMonth} />

      {loading || !forecast ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">Calculando previsão...</div>
      ) : (
        <>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Saldo previsto do mês</p>
            <p className={`mt-2 text-3xl font-bold ${forecast.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{money(forecast.balance)}</p>
            <p className="mt-1 text-sm text-slate-500">{money(forecast.totalIn)} previstos para entrar − {money(forecast.totalOut)} previstos para sair</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <ForecastList title="Receitas previstas" rows={forecast.incomes} total={forecast.totalIn} tone="text-emerald-600" />
            <ForecastList title="Despesas previstas" rows={forecast.outgoings} total={forecast.totalOut} tone="text-red-600" />
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
