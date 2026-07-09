import { Link } from 'react-router-dom';

// Traço de cor da borda esquerda, derivado da mesma cor do ícone (ex.: "text-emerald-600"
// -> "border-l-emerald-500"). Classes escritas por extenso para o Tailwind JIT encontrá-las.
const BORDER_ACCENT = {
  emerald: 'border-l-emerald-500',
  red: 'border-l-red-500',
  blue: 'border-l-blue-500',
  amber: 'border-l-amber-500',
  violet: 'border-l-violet-500',
  orange: 'border-l-orange-500',
  cyan: 'border-l-cyan-500',
};

function getAccentClass(color) {
  const hue = String(color || '').match(/text-(\w+)-\d+/)?.[1];
  return BORDER_ACCENT[hue] || 'border-l-slate-300';
}

export function MetricCard({ icon: Icon, label, value, color, sub, href }) {
  const Wrapper = href ? Link : 'div';
  const wrapperProps = href ? { to: href, 'aria-label': `Ver ${label.toLowerCase()}` } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`block rounded-2xl border border-slate-200 border-l-4 ${getAccentClass(color)} bg-white p-4 shadow-sm transition-all md:p-5 ${href ? 'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0' : 'hover:shadow-md'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 md:text-[11px] md:tracking-[0.2em]">{label}</p>
          <p className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">{value}</p>
          {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
        </div>
        <div className={`hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl sm:flex md:h-11 md:w-11 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Wrapper>
  );
}
