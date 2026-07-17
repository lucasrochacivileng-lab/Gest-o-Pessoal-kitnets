import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export function OccupancyChart({ occupied, vacant, totalKitnets }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-slate-900">Ocupação das Kitnets</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={[
              { name: 'Ocupadas', value: occupied || 0 },
              { name: 'Vagas', value: vacant || 0 },
              { name: 'Manutenção', value: Math.max(0, (totalKitnets || 0) - (occupied || 0) - (vacant || 0)) },
            ].filter((item) => item.value > 0)}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
          >
            <Cell fill="#10b981" />
            <Cell fill="#f97316" />
            <Cell fill="#94a3b8" />
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-6 text-xs text-slate-600">
        <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-emerald-500" />Ocupadas ({occupied})</div>
        <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-orange-500" />Vagas ({vacant})</div>
      </div>
    </div>
  );
}
