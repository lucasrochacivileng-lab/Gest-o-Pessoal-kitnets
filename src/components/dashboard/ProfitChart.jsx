import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { financialService } from '../../services/financialService';

export function ProfitChart({ data }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-slate-900">Evolução do Lucro</h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data || []}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(value) => financialService.formatCurrency(value)} />
          <Line type="monotone" dataKey="lucro" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} name="Lucro" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
