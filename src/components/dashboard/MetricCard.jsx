export function MetricCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md md:p-5">
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
    </div>
  );
}
