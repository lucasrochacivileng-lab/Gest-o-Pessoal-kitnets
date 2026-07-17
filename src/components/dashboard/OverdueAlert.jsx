import { AlertTriangle } from 'lucide-react';
import { financialService } from '../../services/financialService';

export function OverdueAlert({ count, value }) {
  if (!count) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-red-200 bg-red-50 p-4 text-red-700">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-100">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold">{count} aluguéis vencidos</p>
        <p className="text-xs text-red-600">Total em atraso: {financialService.formatCurrency(value)}</p>
      </div>
    </div>
  );
}
