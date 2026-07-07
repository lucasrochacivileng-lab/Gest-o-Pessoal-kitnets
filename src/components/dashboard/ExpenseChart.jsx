import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { financialService } from '../../services/financialService';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6', '#e11d48'];

export function ExpenseChart({ data }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-slate-900">Despesas por Categoria</h3>
      {data?.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
              {data.map((_, index) => (
                <Cell key={`${_.name}-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => financialService.formatCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[280px] items-center justify-center text-sm text-slate-500">Nenhuma despesa registrada</div>
      )}
    </div>
  );
}
