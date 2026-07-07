import { financialService } from '../../../services/financialService';

export function ReceivableSummary({ summary }) {
  const cards = [
    { label: 'A receber hoje', value: financialService.formatCurrency(summary.toReceiveToday) },
    { label: 'Em atraso', value: financialService.formatCurrency(summary.overdueValue) },
    { label: 'Próximos 7 dias', value: financialService.formatCurrency(summary.next7DaysValue) },
    { label: 'Recebido no mês', value: financialService.formatCurrency(summary.receivedThisMonthValue) },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">{card.label}</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
