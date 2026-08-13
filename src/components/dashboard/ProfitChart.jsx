import { useNavigate } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { financialService } from '../../services/financialService';

const LUCRO = '#3b82f6';

const money = (value) => financialService.formatCurrency(value);

function ProfitTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <p className={`text-sm font-semibold ${value >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{money(value)}</p>
      <p className="mt-1 text-xs text-blue-600">Toque para ver o extrato do mês</p>
    </div>
  );
}

export function ProfitChart({ data }) {
  const navigate = useNavigate();
  const rows = data || [];
  const last = rows[rows.length - 1];

  // Recharts v3: o onClick do gráfico entrega `activeIndex`, não mais o
  // `activePayload` — o índice busca a linha na nossa própria lista.
  const openMonth = (state) => {
    const index = Number(state?.activeIndex);
    const monthKey = Number.isInteger(index) ? rows[index]?.monthKey : '';
    if (monthKey) navigate(`/extrato?mes=${monthKey}`);
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-slate-900">Evolução do lucro</h3>
        <span className="text-xs text-slate-500">toque num mês</span>
      </div>
      {/* Rótulo direto no mês mais recente: o número que mais importa não fica
          escondido atrás do toque. */}
      <p className="mb-4 text-xs text-slate-500">
        Últimos 6 meses
        {last ? <> · {last.month}: <strong className={last.lucro >= 0 ? 'text-slate-700' : 'text-red-600'}>{money(last.lucro)}</strong></> : null}
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={rows} onClick={openMonth} className="cursor-pointer" margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="0" vertical={false} stroke="#e1e0d9" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#52514e' }} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} />
          <YAxis
            tick={{ fontSize: 12, fill: '#898781' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
          />
          {/* O zero é a linha que separa mês de lucro de mês de prejuízo. */}
          <ReferenceLine y={0} stroke="#c3c2b7" />
          <Tooltip content={<ProfitTooltip />} cursor={{ stroke: '#c3c2b7' }} />
          <Line
            type="monotone"
            dataKey="lucro"
            stroke={LUCRO}
            strokeWidth={2}
            dot={{ fill: LUCRO, r: 4, strokeWidth: 2, stroke: '#ffffff' }}
            activeDot={{ r: 6 }}
            name="Lucro"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ProfitChart;
