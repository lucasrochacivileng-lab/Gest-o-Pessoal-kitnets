import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { financialService } from '../../services/financialService';

// Verde/vermelho passam nos testes de daltonismo sobre o branco (ΔE 9,6) e o
// contraste mínimo — o verde anterior (#10b981) ficava em 2,54:1, abaixo do
// piso de 3:1. Ainda assim a legenda é obrigatória: quem não distingue as duas
// cores precisa de outro caminho para saber qual barra é qual.
const RECEITAS = '#059669';
const DESPESAS = '#ef4444';

const money = (value) => financialService.formatCurrency(value);

function MonthTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span className="inline-block h-0.5 w-3 rounded" style={{ backgroundColor: entry.color }} />
          <span className="font-semibold text-slate-900">{money(entry.value)}</span>
          <span className="text-xs text-slate-500">{entry.name}</span>
        </p>
      ))}
      <p className="mt-1 text-xs text-blue-600">Toque para ver o extrato do mês</p>
    </div>
  );
}

export function RevenueChart({ data }) {
  const navigate = useNavigate();
  const rows = data || [];

  // O clique é no mês inteiro (qualquer uma das duas barras ou o espaço delas),
  // não numa barra específica — alvo maior e o destino é o mesmo nos dois casos.
  //
  // No Recharts v3 o onClick do gráfico recebe só `activeIndex`/`activeLabel`:
  // o `activePayload` das versões anteriores não existe mais. Por isso o índice
  // é usado para buscar a linha na nossa própria lista.
  const openMonth = (state) => {
    const index = Number(state?.activeIndex);
    const monthKey = Number.isInteger(index) ? rows[index]?.monthKey : '';
    if (monthKey) navigate(`/extrato?mes=${monthKey}`);
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-slate-900">Receitas x Despesas</h3>
        <span className="text-xs text-slate-500">toque num mês</span>
      </div>
      <p className="mb-4 text-xs text-slate-500">Últimos 6 meses, somente o realizado.</p>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows} onClick={openMonth} className="cursor-pointer" margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="0" vertical={false} stroke="#e1e0d9" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#52514e' }} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} />
          <YAxis
            tick={{ fontSize: 12, fill: '#898781' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<MonthTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
          <Legend iconType="rect" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="receitas" fill={RECEITAS} radius={[4, 4, 0, 0]} name="Receitas" isAnimationActive={false} />
          <Bar dataKey="despesas" fill={DESPESAS} radius={[4, 4, 0, 0]} name="Despesas" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RevenueChart;
