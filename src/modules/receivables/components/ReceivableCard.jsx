import { CheckCircle2, Eye, MessageCircle, PencilLine } from 'lucide-react';
import { financialService } from '../../../services/financialService';
import { buildWhatsAppLink } from '../../../services/whatsappService.js';
import { formatCompetenceBR, formatDateBR } from '../../../services/dateUtils.js';
import { calculateOutstandingValue } from '../services/receivableService.js';

const readWhatsappPreference = () => {
  if (typeof window === 'undefined') return true;

  try {
    const settings = JSON.parse(window.localStorage.getItem('@kitmanager/settings') || '{}');
    return settings.whatsappReminders !== false;
  } catch {
    return true;
  }
};

export function ReceivableCard({ receivable, onPay, onEdit, onHistory }) {
  const currency = financialService.formatCurrency;
  const isOverdue = receivable.status === 'vencido';
  const isPending = receivable.status === 'pendente';
  const outstandingValue = calculateOutstandingValue(receivable);
  const isPaid = receivable.status === 'pago';
  const urgencyClass = isOverdue
    ? 'border-red-200 border-l-4 border-l-red-500 bg-red-50'
    : isPending
      ? 'border-amber-200 border-l-4 border-l-amber-400 bg-white'
      : isPaid
        ? 'border-emerald-200 border-l-4 border-l-emerald-500 bg-white'
        : 'border-slate-200 border-l-4 border-l-slate-300 bg-white';
  const statusBadgeClass = isOverdue
    ? 'bg-red-100 text-red-700'
    : isPending
      ? 'bg-amber-100 text-amber-700'
      : isPaid
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-600';
  const tenantPhone = receivable.tenant?.whatsapp || receivable.tenant?.phone;
  const whatsappEnabled = readWhatsappPreference();

  const handleWhatsApp = () => {
    const message = [
      `Olá, ${receivable.tenant?.name || 'tudo bem'}!`,
      `Passando para lembrar do aluguel de ${formatCompetenceBR(receivable.competence)}.`,
      `Valor em aberto: ${currency(outstandingValue || receivable.expected_value)}.`,
      `Vencimento: ${formatDateBR(receivable.due_date)}.`,
    ].join(' ');

    const link = buildWhatsAppLink(tenantPhone, message);
    if (!link) return;

    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm md:p-5 ${urgencyClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {receivable.kitnet?.name || 'Kitnet'} · {receivable.tenant?.name || 'sem locatário'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {formatCompetenceBR(receivable.competence)} · vence {formatDateBR(receivable.due_date)}
          </p>
          <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass}`}>
            {receivable.status}
          </span>
        </div>
        <div className="space-y-0.5 text-right">
          <p className="text-lg font-bold text-slate-900">{currency(receivable.expected_value)}</p>
          {receivable.paid_value ? <p className="text-xs text-emerald-700">Pago: {currency(receivable.paid_value)}</p> : null}
          {outstandingValue > 0 && receivable.paid_value ? <p className="text-xs text-slate-500">Resta: {currency(outstandingValue)}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {receivable.status !== 'pago' ? (
          <button type="button" onClick={() => onPay(receivable)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:flex-none">
            <CheckCircle2 className="h-5 w-5" /> Receber
          </button>
        ) : null}
        {whatsappEnabled && tenantPhone && receivable.status !== 'pago' ? (
          <button type="button" onClick={handleWhatsApp} title="Cobrar pelo WhatsApp" aria-label="Cobrar pelo WhatsApp" className="rounded-2xl border border-emerald-200 bg-white p-2.5 text-emerald-600 transition hover:bg-emerald-50">
            <MessageCircle className="h-5 w-5" />
          </button>
        ) : null}
        <button type="button" onClick={() => onHistory(receivable)} title="Ver histórico" aria-label="Ver histórico" className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50">
          <Eye className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => onEdit(receivable)} title="Editar" aria-label="Editar" className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50">
          <PencilLine className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
