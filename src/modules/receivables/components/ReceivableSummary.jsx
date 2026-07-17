import { financialService } from '../../../services/financialService';

export function ReceivableSummary({ summary }) {
  // Traço de cor por significado, como no dashboard, para bater o olho e
  // entender: azul = a receber, vermelho = atraso, âmbar = a vencer, verde = recebido.
  const cards = [
    { label: 'A receber hoje', value: summary.toReceiveToday, accent: 'border-l-blue-500' },
    { label: 'Em atraso', value: summary.overdueValue, accent: 'border-l-red-500' },
    { label: 'Próximos 7 dias', value: summary.next7DaysValue, accent: 'border-l-amber-400' },
    { label: 'Recebido no mês', value: summary.receivedThisMonthValue, accent: 'border-l-emerald-500' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-[var(--radius-lg)] border border-slate-200 border-l-4 ${card.accent} bg-white p-4 shadow-sm`}>
          <p className="truncate text-xs text-slate-500 md:text-sm">{card.label}</p>
          <p className="mt-1.5 text-lg font-semibold tabular-nums text-slate-900 md:text-xl">
            {financialService.formatCurrency(card.value)}
          </p>
        </div>
      ))}
    </div>
  );
}
