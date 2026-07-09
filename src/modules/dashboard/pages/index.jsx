import {
	TrendingUp,
	TrendingDown,
	DollarSign,
	AlertTriangle,
	Building2,
	FileText,
	CalendarClock,
	HandCoins,
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

			<ActionCenter items={data.actionItems} />

			<div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
				<MetricCard icon={TrendingUp} label="Receita do mês" value={financialService.formatCurrency(data.revenue)} color="bg-emerald-50 text-emerald-600" />
				<MetricCard icon={TrendingDown} label="Despesas do mês" value={financialService.formatCurrency(data.expenseTotal)} color="bg-red-50 text-red-600" />
				<MetricCard icon={DollarSign} label="Lucro do mês" value={financialService.formatCurrency(data.profit)} color="bg-blue-50 text-blue-600" />
				<MetricCard icon={AlertTriangle} label="Aluguéis vencidos" value={data.overdue} color="bg-amber-50 text-amber-600" sub={financialService.formatCurrency(data.overdueValue)} />
				<MetricCard icon={CalendarClock} label="A vencer" value={data.upcoming} color="bg-violet-50 text-violet-600" />
			</div>

			<div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
				<MetricCard icon={Building2} label="Ocupadas" value={data.occupied} color="bg-emerald-50 text-emerald-600" sub={`de ${data.totalKitnets} kitnets`} />
				<MetricCard icon={Building2} label="Vagas" value={data.vacant} color="bg-orange-50 text-orange-600" />
				<MetricCard icon={FileText} label="Contratos vencendo" value={data.expiringContracts} color="bg-red-50 text-red-600" sub="próximos 30 dias" />
				<MetricCard icon={HandCoins} label="Receita prevista" value={financialService.formatCurrency(data.receitaPrevista)} color="bg-blue-50 text-blue-600" sub="a receber" />
				<MetricCard icon={DollarSign} label="Saldo previsto" value={financialService.formatCurrency(data.revenue - data.expenseTotal + data.overdueValue)} color="bg-cyan-50 text-cyan-600" />
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<RevenueChart data={data.monthlyData} />
				<ProfitChart data={data.monthlyData} />
				<ExpenseChart data={data.categoryData} />
				<OccupancyChart occupied={data.occupied} vacant={data.vacant} totalKitnets={data.totalKitnets} />
			</div>
		</div>
	);
}
