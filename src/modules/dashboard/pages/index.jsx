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
import PageHeader from '../../../components/ui/PageHeader.jsx';
import StatePanel from '../../../components/ui/StatePanel.jsx';

export default function Dashboard() {
	const { loading, data } = useDashboard();
	// Gráficos abertos por padrão só em telas grandes; no celular ficam atrás de um toque.
	const [showCharts, setShowCharts] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);

	if (loading) {
		return <StatePanel type="loading" title="Carregando dashboard" />;
	}

	return (
		<div className="space-y-6">
			<PageHeader
				title="Dashboard"
				description="Visão financeira e operacional do Residencial Rocha neste mês."
				actions={<>
				<Link to="/recebimentos" className="ds-btn bg-emerald-600 text-white hover:bg-emerald-700">
					<HandCoins className="h-4 w-4" /> Receber aluguel
				</Link>
				<Link to="/despesas" className="ds-btn ds-btn-secondary">
					<Wallet className="h-4 w-4" /> Lançar despesa
				</Link>
				<Link to="/previsao" className="ds-btn ds-btn-secondary">
					<CalendarRange className="h-4 w-4" /> Previsão
				</Link>
			</>}
			/>

			<ActionCenter items={data.actionItems} />

			<div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
				<MetricCard size="primary" icon={DollarSign} label="Saldo do mês" value={financialService.formatCurrency(data.profit)} color="bg-blue-50 text-blue-600" sub="receitas menos despesas" href="/visao-geral" />
				<MetricCard size="primary" icon={TrendingUp} label="Receita recebida" value={financialService.formatCurrency(data.revenue)} color="bg-emerald-50 text-emerald-600" sub="realizado neste mês" href="/extrato" />
				<MetricCard size="primary" icon={TrendingDown} label="Despesas pagas" value={financialService.formatCurrency(data.expenseTotal)} color="bg-red-50 text-red-600" sub="realizado neste mês" href="/despesas" />
				<MetricCard size="primary" icon={AlertTriangle} label="Aluguéis vencidos" value={data.overdue} color="bg-amber-50 text-amber-600" sub={financialService.formatCurrency(data.overdueValue)} href="/recebimentos" />
			</div>

			<div>
				<h2 className="mb-3 text-sm font-semibold text-slate-900">Operação das locações</h2>
				<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
					<MetricCard size="compact" icon={CalendarClock} label="A vencer" value={data.upcoming} color="bg-violet-50 text-violet-600" sub="neste mês" href="/recebimentos" />
					<MetricCard size="compact" icon={Building2} label="Ocupadas" value={data.occupied} color="bg-emerald-50 text-emerald-600" sub={`de ${data.totalKitnets}`} href="/kitnets" />
					<MetricCard size="compact" icon={Building2} label="Vagas" value={data.vacant} color="bg-orange-50 text-orange-600" href="/kitnets" />
					<MetricCard size="compact" icon={FileText} label="Contratos vencendo" value={data.expiringContracts} color="bg-red-50 text-red-600" sub="em 30 dias" href="/locacoes" />
					<MetricCard size="compact" icon={HandCoins} label="Receita prevista" value={financialService.formatCurrency(data.receitaPrevista)} color="bg-blue-50 text-blue-600" href="/previsao" />
					<MetricCard size="compact" icon={Building2} label="Total de unidades" value={data.totalKitnets} color="bg-cyan-50 text-cyan-600" href="/kitnets" />
				</div>
			</div>

			<button
				type="button"
				onClick={() => setShowCharts((state) => !state)}
				className="inline-flex w-full items-center justify-between rounded-[var(--radius-lg)] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 lg:hidden"
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
