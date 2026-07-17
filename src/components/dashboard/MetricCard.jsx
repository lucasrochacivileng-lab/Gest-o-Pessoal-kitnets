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

export function MetricCard({ icon: Icon, label, value, color, sub, href, size = 'default' }) {
  const Wrapper = href ? Link : 'div';
  const wrapperProps = href ? { to: href, 'aria-label': `Ver ${label.toLowerCase()}` } : {};
  const isPrimary = size === 'primary';
  const isCompact = size === 'compact';

  return (
    <Wrapper
      {...wrapperProps}
      className={`block rounded-[var(--radius-xl)] border border-slate-200 border-l-4 ${getAccentClass(color)} bg-white shadow-sm transition-all ${isPrimary ? 'min-h-32 p-5 md:p-6' : isCompact ? 'p-3.5 md:p-4' : 'p-4 md:p-5'} ${href ? 'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0' : 'hover:shadow-md'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <p className={`${isCompact ? 'text-xs' : 'text-[11px]'} truncate font-semibold text-slate-500`}>{label}</p>
          <p className={`${isPrimary ? 'text-2xl md:text-3xl' : isCompact ? 'text-lg md:text-xl' : 'text-xl md:text-2xl'} font-bold tracking-tight text-slate-900`}>{value}</p>
          {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
        </div>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-lg)] md:h-10 md:w-10 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Wrapper>
  );
}
