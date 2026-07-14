import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
	TrendingUp,
	TrendingDown,
	DollarSign,
	AlertTriangle,
	Building2,
	FileText,
	CalendarClock,
	HandCoins,
	Wallet,
	BarChart3,
	ChevronDown,
	CalendarRange,
} from 'lucide-react';
import { useDashboard } from '../../../hooks/useDashboard';
import { MetricCard } from '../../../components/dashboard/MetricCard';
import { ActionCenter } from '../../../components/dashboard/ActionCenter.jsx';
import { RevenueChart } from '../../../components/dashboard/RevenueChart';
import { ProfitChart } from '../../../components/dashboard/ProfitChart';
import { ExpenseChart } from '../../../components/dashboard/ExpenseChart';
import { OccupancyChart } from '../../../components/dashboard/OccupancyChart';
import { financialService } from '../../../services/financialService';

export default function Dashboard() {
	const { loading, data } = useDashboard();
	// Gráficos abertos por padrão só em telas grandes; no celular ficam atrás de um toque.
	const [showCharts, setShowCharts] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

	if (loading) {
		return (
			<div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
				Carregando dashboard...
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
				<p className="mt-1 text-sm text-slate-500">Visão geral financeira e operacional das suas kitnets</p>
			</div>

			<div className="flex flex-wrap gap-2">
				<Link to="/recebimentos" className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
					<HandCoins className="h-4 w-4" /> Receber aluguel
				</Link>
				<Link to="/despesas" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
					<Wallet className="h-4 w-4" /> Lançar despesa
				</Link>
				<Link to="/previsao" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
					<CalendarRange className="h-4 w-4" /> Previsão
				</Link>
			</div>

			<ActionCenter items={data.actionItems} />

			<div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
				<MetricCard icon={TrendingUp} label="Receita do mês" value={financialService.formatCurrency(data.revenue)} color="bg-emerald-50 text-emerald-600" href="/extrato" />
				<MetricCard icon={TrendingDown} label="Despesas do mês" value={financialService.formatCurrency(data.expenseTotal)} color="bg-red-50 text-red-600" href="/despesas" />
				<MetricCard icon={DollarSign} label="Lucro do mês" value={financialService.formatCurrency(data.profit)} color="bg-blue-50 text-blue-600" href="/visao-geral" />
				<MetricCard icon={AlertTriangle} label="Aluguéis vencidos" value={data.overdue} color="bg-amber-50 text-amber-600" sub={financialService.formatCurrency(data.overdueValue)} href="/recebimentos" />
				<MetricCard icon={CalendarClock} label="A vencer" value={data.upcoming} color="bg-violet-50 text-violet-600" sub="neste mês" href="/recebimentos" />
			</div>

			<div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
				<MetricCard icon={Building2} label="Ocupadas" value={data.occupied} color="bg-emerald-50 text-emerald-600" sub={`de ${data.totalKitnets} kitnets`} href="/kitnets" />
				<MetricCard icon={Building2} label="Vagas" value={data.vacant} color="bg-orange-50 text-orange-600" href="/kitnets" />
				<MetricCard icon={FileText} label="Contratos vencendo" value={data.expiringContracts} color="bg-red-50 text-red-600" sub="próximos 30 dias" href="/locacoes" />
				<MetricCard icon={HandCoins} label="Receita prevista" value={financialService.formatCurrency(data.receitaPrevista)} color="bg-blue-50 text-blue-600" sub="a receber neste mês" href="/previsao" />
				<MetricCard icon={DollarSign} label="Saldo previsto" value={financialService.formatCurrency(data.revenue - data.expenseTotal + data.overdueValue)} color="bg-cyan-50 text-cyan-600" href="/visao-geral" />
			</div>

			<button
				type="button"
				onClick={() => setShowCharts((state) => !state)}
				className="inline-flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 lg:hidden"
			>
				<span className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4" /> {showCharts ? 'Ocultar gráficos' : 'Ver gráficos'}</span>
				<ChevronDown className={`h-4 w-4 transition-transform ${showCharts ? 'rotate-180' : ''}`} />
			</button>

			{showCharts ? (
				<div className="grid gap-6 lg:grid-cols-2">
					<RevenueChart data={data.monthlyData} />
					<ProfitChart data={data.monthlyData} />
					<ExpenseChart data={data.categoryData} />
					<OccupancyChart occupied={data.occupied} vacant={data.vacant} totalKitnets={data.totalKitnets} />
				</div>
			) : null}
		</div>
	);
}
