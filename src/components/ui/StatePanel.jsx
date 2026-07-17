import { AlertCircle, Inbox } from 'lucide-react';

export default function StatePanel({ type = 'empty', title, description }) {
  if (type === 'loading') {
    return (
      <div className="ds-state items-stretch" role="status" aria-label={title || 'Carregando'}>
        <div className="mx-auto w-full max-w-xl space-y-3">
          <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  const Icon = type === 'error' ? AlertCircle : Inbox;
  const iconTone = type === 'error' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500';

  return (
    <div className="ds-state" role={type === 'error' ? 'alert' : undefined}>
      <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] ${iconTone}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-semibold text-[var(--color-text)]">{title || (type === 'error' ? 'Algo deu errado' : 'Nenhum registro encontrado')}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-[var(--color-text-muted)]">{description}</p> : null}
    </div>
  );
}
