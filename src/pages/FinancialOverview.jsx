import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { repository } from '../repository/index.js';
import { buildCashflow } from '../services/cashflowService.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const money = (value = 0) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const moneyValue = (value) => Number(value || 0);
const outstandingValue = (receivable) => Math.max(moneyValue(receivable.expected_value) - moneyValue(receivable.paid_value), 0);
const paymentValue = (payment) => moneyValue(payment.net_value || payment.paid_value);

function Card({ label, value, icon, sub }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
          {sub ? <p className="mt-1 text-sm text-slate-500">{sub}</p> : null}
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">{icon}</div>
      </div>
    </div>
  );
}

export default function FinancialOverview() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [kitnets, receivables, payments, expenses, contracts, personal] = await Promise.all([
        repository.list('Kitnet'),
        repository.list('Receivable'),
        repository.list('Payment'),
        repository.list('Expense'),
        repository.list('Contract'),
        repository.list('PersonalIncome'),
      ]);

      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const today = now.toISOString().split('T')[0];

      const monthRevenue = payments.filter((item) => item.payment_date?.startsWith(monthKey)).reduce((sum, item) => sum + paymentValue(item), 0);
      const monthExpenses = expenses.filter((item) => item.date?.startsWith(monthKey)).reduce((sum, item) => sum + (item.value || 0), 0);
      const overdueReceivables = receivables.filter((item) => item.status === 'vencido' || (item.status === 'pendente' && item.due_date && item.due_date < today));
      const upcomingReceivables = receivables.filter((item) => item.status === 'pendente' && item.due_date && item.due_date >= today);
      const pendingValue = receivables.filter((item) => ['pendente', 'vencido', 'parcial'].includes(item.status)).reduce((sum, item) => sum + outstandingValue(item), 0);
      const overdueValue = overdueReceivables.reduce((sum, item) => sum + outstandingValue(item), 0);

      const months = [];
      for (let i = 5; i >= 0; i -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const receipts = payments.filter((item) => item.payment_date?.startsWith(key)).reduce((sum, item) => sum + paymentValue(item), 0);
        const expenseValue = expenses.filter((item) => item.date?.startsWith(key)).reduce((sum, item) => sum + (item.value || 0), 0);
        months.push({ month: date.toLocaleString('pt-BR', { month: 'short' }), receipts, expenses: expenseValue });
      }

      const cashflow = buildCashflow({ payments, expenses, personal, monthKey });

      setData({
        cashflow,
        kitnets: kitnets.length,
        occupied: kitnets.filter((item) => item.status === 'ocupada').length,
        vacant: kitnets.filter((item) => item.status === 'vaga').length,
        contracts: contracts.length,
        monthRevenue,
        monthExpenses,
        pendingValue,
        overdueValue,
        overdueCount: overdueReceivables.length,
        upcomingCount: upcomingReceivables.length,
        months,
      });
    };

    load();
  }, []);

  if (!data) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-500">Carregando visão geral...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Visão Geral Financeira</h1>
        <p className="text-sm text-slate-500">Consolidação de kitnets, contratos, recebíveis e despesas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card label="Receita do mês" value={money(data.monthRevenue)} icon="R$" />
        <Card label="Despesas do mês" value={money(data.monthExpenses)} icon="—" />
        <Card label="Receita prevista" value={money(data.pendingValue)} icon="⏳" />
        <Card label="Aluguéis vencidos" value={data.overdueCount} icon="⚠️" sub={money(data.overdueValue)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card label="Kitnets" value={data.kitnets} icon="🏠" sub={`${data.occupied} ocupadas • ${data.vacant} vagas`} />
        <Card label="Contratos" value={data.contracts} icon="📄" sub={`${data.upcomingCount} a vencer`} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Caixa geral do mês</h2>
          <p className="text-xs text-slate-500">Regime de caixa: só entra o que foi efetivamente pago ou recebido</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card label="Resultado das kitnets" value={money(data.cashflow.kitnetsResult)} icon="🏠" sub={`${money(data.cashflow.kitnetsIn)} recebidos − ${money(data.cashflow.kitnetsOut)} pagos`} />
          <Card label="Resultado pessoal" value={money(data.cashflow.personalResult)} icon="👤" sub={`${money(data.cashflow.personalIn)} − ${money(data.cashflow.personalOut)}`} />
          <Card label="Resultado final" value={money(data.cashflow.finalResult)} icon="🧮" sub="kitnets + pessoal" />
          <Card label="Investido na obra/kitnets" value={money(data.cashflow.investedInBusiness)} icon="🔨" sub="pago pelas contas pessoais (acumulado)" />
        </div>
        {data.cashflow.pendingCardReview > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {data.cashflow.pendingCardReview} transação(ões) de cartão importadas aguardam revisão e ainda não contam no caixa.{' '}
            <Link to="/financas-pessoais" className="font-semibold underline">Revisar agora</Link>
          </div>
        ) : null}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Receitas x Despesas (últimos 6 meses)</h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.months}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => money(value)} />
              <Bar dataKey="receipts" fill="#10b981" name="Receitas" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" fill="#ef4444" name="Despesas" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
