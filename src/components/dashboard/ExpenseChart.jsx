import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { financialService } from '../../services/financialService';

// Era uma pizza com uma cor por categoria, tiradas de uma lista de 11 que se
// repetia quando acabava. Três problemas somados: cor repetida = duas
// categorias com a mesma tinta; sem legenda, a cor não dizia nada; e o valor
// só existia no tooltip — no celular, onde não há mouse, o gráfico não
// informava nada.
//
// Barra deitada resolve os três: o nome fica escrito ao lado, o valor também,
// e comparar comprimento é mais preciso que comparar fatia. Categoria de gasto
// não tem ordem natural, então é UMA cor só para todas — a cor não carrega
// informação aqui, o comprimento carrega.
const BAR_COLOR = '#3b82f6';
const HIGHLIGHT_COLOR = '#1d4ed8';

// Acima disso a lista vira uma parede de nomes. O resto soma em "Outros", que
// continua clicável e leva à tela completa.
const MAX_BARS = 6;

const money = (value) => financialService.formatCurrency(value);

export const buildChartRows = (data = []) => {
  const sorted = [...data]
    .filter((row) => Number(row.value) > 0)
    .sort((a, b) => Number(b.value) - Number(a.value));

  if (sorted.length <= MAX_BARS) return sorted;

  const visible = sorted.slice(0, MAX_BARS - 1);
  const rest = sorted.slice(MAX_BARS - 1);

  return [
    ...visible,
    {
      name: `Outros (${rest.length})`,
      category: '',
      value: rest.reduce((sum, row) => sum + Number(row.value || 0), 0),
    },
  ];
};

function CategoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      {/* Valor primeiro e em destaque: quem passa o dedo já sabe a categoria,
          quer o número. */}
      <p className="text-sm font-semibold text-slate-900">{money(row.value)}</p>
      <p className="text-xs text-slate-500">{row.name}</p>
      {row.category ? <p className="mt-1 text-xs text-blue-600">Toque para ver os lançamentos</p> : null}
    </div>
  );
}

export function ExpenseChart({ data, month }) {
  const navigate = useNavigate();
  const rows = buildChartRows(data);

  // O Recharts v3 chama onClick do <Bar> com (data, index, event), onde `data`
  // é a barra desenhada e a linha original fica em `payload`. O fallback cobre
  // as duas formas para o clique não depender desse detalhe interno.
  const openCategory = (bar) => {
    const row = bar?.payload || bar || {};
    const params = new URLSearchParams();
    // "Outros" não tem categoria única: abre o mês inteiro, sem filtro de tag.
    if (row.category) params.set('tag', row.category);
    if (month) params.set('mes', month);
    navigate(`/despesas${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-slate-900">Despesas por categoria</h3>
        <span className="text-xs text-slate-500">toque para abrir</span>
      </div>
      <p className="mb-4 text-xs text-slate-500">Do mês atual, da maior para a menor.</p>

      {rows.length > 0 ? (
        <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 46 + 40)}>
          <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 76, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="#e1e0d9" />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={116}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: '#52514e' }}
            />
            <Tooltip content={<CategoryTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              barSize={18}
              onClick={openCategory}
              className="cursor-pointer"
              isAnimationActive={false}
            >
              {rows.map((row, index) => (
                <Cell key={row.name} fill={index === 0 ? HIGHLIGHT_COLOR : BAR_COLOR} />
              ))}
              {/* Valor escrito na ponta da barra: o número nunca depende de
                  passar o mouse, que no celular nem existe. */}
              <LabelList
                dataKey="value"
                position="right"
                formatter={money}
                className="fill-slate-600"
                style={{ fontSize: 12 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[200px] items-center justify-center text-sm text-slate-500">
          Nenhuma despesa registrada neste mês
        </div>
      )}
    </div>
  );
}

export default ExpenseChart;
