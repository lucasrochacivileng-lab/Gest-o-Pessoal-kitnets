import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PageHeader from '../components/ui/PageHeader.jsx';
import ReportFilters from '../components/financial/ReportFilters.jsx';
import MovementDetails from '../components/financial/MovementDetails.jsx';
import { useReportFilters } from '../hooks/useReportFilters.js';
import { useFinancialData } from '../hooks/useFinancialData.js';
import { buildMonthlyAnalysis } from '../services/monthlyAnalysisService.js';
import { financialService } from '../services/financialService';
import { normalizeCategory } from '../services/categoryReportService.js';
import { SEGMENTS } from '../services/financialClassification.js';

const money = financialService.formatCurrency;
const colors = ['#059669', '#2563eb', '#7c3aed', '#b45309', '#64748b'];
function Chart({ title, children }) {
  return <section className="ds-card min-w-0"><h2 className="mb-4 font-semibold">{title}</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></section>;
}
export default function MonthlyAnalysis() {
  const filters = useReportFilters();
  const { data, error, reload, updatedAt } = useFinancialData();
  const [kind, setKind] = useState('');
  const [category, setCategory] = useState('');
  const result = useMemo(() => data && buildMonthlyAnalysis(data, filters), [data, filters.month, filters.segment]);
  const details = result?.items.filter((r) => (!kind || r.kind === kind) && (!category || normalizeCategory(r) === category)) || [];
  return <div className="space-y-6">
    <PageHeader title="Meu mês" description="Entradas, gastos confirmados e resultado de cada atividade." actions={<>
      <Link className="ds-btn ds-btn-primary" to={`/receitas?month=${filters.month}&novo=1`}>Adicionar entrada</Link>
      <Link className="ds-btn ds-btn-secondary" to={`/despesas?month=${filters.month}&novo=1`}>Adicionar despesa</Link>
    </>} />
    <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 -mx-2 rounded-xl bg-[var(--color-bg)] px-2 py-2 shadow-sm lg:top-0">
      <ReportFilters {...filters} setMonth={(v) => { filters.setMonth(v); setCategory(''); }} setSegment={(v) => { filters.setSegment(v); setCategory(''); }} />
    </div>
    {error && <div role="alert" className="ds-alert ds-alert-warning">{error} <button className="underline" onClick={reload}>Tentar novamente</button></div>}
    {!result ? <p role="status">{error ? 'Os totais não estão disponíveis.' : 'Carregando análise mensal...'}</p> : <>
      <p className="text-sm text-slate-600">{result.partial ? 'Mês em andamento. Comparação até o mesmo dia do mês anterior.' : `Comparação com ${result.previousMonth}.`}
        {' '}Somente confirmados. Gastos usam a data cadastrada; parcelas de cartão usam o mês da parcela. Transferências e quitação da fatura não são um novo gasto.</p>
      <div className="grid gap-4 md:grid-cols-3">{[['income', 'Entradas recebidas', 'entrada'], ['expense', 'Gastos confirmados', 'saida'], ['result', 'Resultado do mês', '']].map(([key, label, selection]) => {
        const change = result.comparison[key];
        return <button key={key} className="ds-card text-left hover:border-blue-500" onClick={() => { setKind(selection); setCategory(''); document.getElementById('monthly-details')?.scrollIntoView({ behavior: 'smooth' }); }}>
          <p className="text-sm text-slate-500">{label}</p><p className={`my-2 text-2xl font-bold ${key === 'expense' ? 'text-red-700' : key === 'income' ? 'text-emerald-700' : 'text-slate-900'}`}>{money(result.totals[key])}</p>
          <p className="text-xs text-slate-600">Variação: {money(change.difference)}{change.percent === null ? ' · sem base percentual' : ` (${change.percent.toFixed(1)}%)`}</p><p className="mt-2 text-xs text-blue-700">Ver composição</p>
        </button>;
      })}</div>
      <div className="flex flex-wrap gap-4 text-sm"><Link className="text-blue-700 underline" to="/caixa">Consultar disponível nas contas</Link><Link className="text-blue-700 underline" to={`/previsao?month=${filters.month}`}>Consultar a pagar e a receber</Link><Link className="text-blue-700 underline" to="/operacao">Operação das locações</Link><Link className="text-blue-700 underline" to={`/patrimonio?month=${filters.month}`}>Evolução do patrimônio</Link></div>
      {!!result.reviewCount && <p className="ds-alert ds-alert-warning">{result.reviewCount} lançamento(s) em revisão neste mês não entram nos totais. <Link className="underline" to={`/despesas?month=${filters.month}`}>Revisar lançamentos</Link></p>}
      <section className="ds-card overflow-x-auto"><h2 className="font-semibold">Resultado por segmento</h2><table className="mt-4 w-full text-left text-sm"><thead><tr><th className="p-2">Atividade</th><th className="p-2 text-right">Entradas</th><th className="p-2 text-right">Gastos</th><th className="p-2 text-right">Resultado</th></tr></thead><tbody>
        {result.segments.filter((r) => !filters.segment || r.key === filters.segment).map((row) => <tr key={row.key} className="border-t"><td className="p-2"><button className="text-blue-700 underline" onClick={() => { filters.setSegment(row.key); setCategory(''); }}>{row.label}</button></td><td className="p-2 text-right">{money(row.income)}</td><td className="p-2 text-right">{money(row.expense)}</td><td className={`p-2 text-right font-semibold ${row.result < 0 ? 'text-red-700' : ''}`}>{money(row.result)}</td></tr>)}
      </tbody></table></section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Chart title="Entradas e gastos · últimos 12 meses"><BarChart data={result.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" fontSize={11} /><YAxis width={65} fontSize={11} /><Tooltip formatter={money} /><Legend /><Bar name="Entradas" dataKey="income" fill="#059669" /><Bar name="Gastos" dataKey="expense" fill="#dc2626" /></BarChart></Chart>
        <Chart title="Resultado mensal"><LineChart data={result.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" fontSize={11} /><YAxis width={65} fontSize={11} /><Tooltip formatter={money} /><Line name="Resultado" dataKey="result" stroke="#2563eb" strokeWidth={3} /></LineChart></Chart>
        <Chart title="De onde vieram as entradas"><BarChart data={result.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" fontSize={11} /><YAxis width={65} fontSize={11} /><Tooltip formatter={money} /><Legend />{SEGMENTS.map((s, i) => <Bar key={s.key} name={s.label} dataKey={s.key} stackId="income" fill={colors[i]} />)}</BarChart></Chart>
        <section className="ds-card"><h2 className="font-semibold">Onde gastei no mês</h2><div className="mt-4 space-y-3">{result.categories.map((row) => <button className="block w-full rounded-lg p-2 text-left hover:bg-slate-50" key={row.key} onClick={() => { setCategory(row.key); setKind('saida'); document.getElementById('monthly-details')?.scrollIntoView({ behavior: 'smooth' }); }}>
          <span className="flex justify-between gap-3 text-sm"><span>{row.name}</span><strong>{money(row.value)}</strong></span><span className="mt-2 block h-2 rounded bg-blue-100"><span className="block h-2 rounded bg-blue-600" style={{ width: `${result.totals.expense ? row.value / result.totals.expense * 100 : 0}%` }} /></span>
        </button>)}{!result.categories.length && <p className="text-slate-500">Nenhum gasto confirmado no recorte.</p>}</div></section>
      </div>
      <details className="ds-card"><summary className="cursor-pointer font-semibold">Ver números dos gráficos</summary><div className="overflow-x-auto"><table className="mt-3 w-full text-left text-sm"><thead><tr><th>Mês</th><th>Entradas</th><th>Gastos</th><th>Resultado</th></tr></thead><tbody>{result.trend.map((r) => <tr key={r.month}><td className="py-2"><button className="text-blue-700 underline" onClick={() => filters.setMonth(r.month)}>{r.label}</button></td><td>{money(r.income)}</td><td>{money(r.expense)}</td><td>{money(r.result)}</td></tr>)}</tbody></table></div></details>
      <section id="monthly-details" className="ds-card scroll-mt-[calc(22rem+env(safe-area-inset-top))] lg:scroll-mt-52"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Composição do mês{category ? ` · ${result.categories.find((r) => r.key === category)?.name || category}` : ''}</h2><div className="flex gap-2"><select aria-label="Tipo de movimento" className="ds-input" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Entradas e saídas</option><option value="entrada">Entradas</option><option value="saida">Saídas</option></select>{category && <button className="text-blue-700 underline" onClick={() => setCategory('')}>Todas as categorias</button>}</div></div><MovementDetails items={details} month={filters.month} segment={filters.segment} /></section>
      <p className="text-xs text-slate-500">Atualizado às {updatedAt?.toLocaleTimeString('pt-BR')}. Resultado do mês não é saldo bancário nem valorização patrimonial.</p>
    </>}
  </div>;
}
