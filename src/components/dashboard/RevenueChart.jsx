import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { financialService } from '../../services/financialService';

export function RevenueChart({ data }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-slate-900">Receitas x Despesas</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data || []}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(value) => financialService.formatCurrency(value)} />
          <Bar dataKey="receitas" fill="#10b981" radius={[6, 6, 0, 0]} name="Receitas" />
          <Bar dataKey="despesas" fill="#ef4444" radius={[6, 6, 0, 0]} name="Despesas" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
