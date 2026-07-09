import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Seletor de competência em um clique: ano com setas + meses como botões.
export function MonthChips({ value, onChange }) {
  const fallback = new Date().toISOString().slice(0, 7);
  const [year, month] = String(value || fallback).split('-').map(Number);
  const currentKey = new Date().toISOString().slice(0, 7);

  const set = (nextYear, nextMonth) => onChange(`${nextYear}-${String(nextMonth).padStart(2, '0')}`);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => set(year - 1, month)}
          aria-label="Ano anterior"
          className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold tracking-wide text-slate-900">{year}</p>
        <button
          type="button"
          onClick={() => set(year + 1, month)}
          aria-label="Próximo ano"
          className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {MONTHS.map((label, index) => {
          const key = `${year}-${String(index + 1).padStart(2, '0')}`;
          const isActive = index + 1 === month;
          const isCurrent = key === currentKey;

          return (
            <button
              key={label}
              type="button"
              onClick={() => set(year, index + 1)}
              className={`rounded-xl px-1 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow'
                  : isCurrent
                    ? 'border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MonthChips;
