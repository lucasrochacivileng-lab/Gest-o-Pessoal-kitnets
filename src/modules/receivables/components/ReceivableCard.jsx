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
  const urgencyClass = isOverdue ? 'border-red-200 bg-red-50' : isPending ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white';
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
    <div className={`rounded-3xl border p-6 shadow-sm ${urgencyClass}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Competência {formatCompetenceBR(receivable.competence)}</p>
          <p className="text-sm text-slate-500">Vencimento: {formatDateBR(receivable.due_date)}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{receivable.status}</p>
          {receivable.kitnet ? <p className="mt-1 text-xs text-slate-500">Kitnet: {receivable.kitnet.name}</p> : null}
          {receivable.tenant ? <p className="text-xs text-slate-500">Locatário: {receivable.tenant.name}</p> : null}
        </div>
        <div className="space-y-1 text-right">
          <p className="text-lg font-semibold text-slate-900">{currency(receivable.expected_value)}</p>
          {receivable.paid_value ? <p className="text-xs text-emerald-700">Pago: {currency(receivable.paid_value)}</p> : null}
          {outstandingValue > 0 ? <p className="text-xs text-slate-500">Restante: {currency(outstandingValue)}</p> : null}
          {isOverdue ? <p className="text-xs text-red-600">Em atraso</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {receivable.status !== 'pago' ? (
          <button type="button" onClick={() => onPay(receivable)} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Receber aluguel
          </button>
        ) : null}
        {whatsappEnabled && tenantPhone && receivable.status !== 'pago' ? (
          <button type="button" onClick={handleWhatsApp} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
        ) : null}
        <button type="button" onClick={() => onHistory(receivable)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          <Eye className="h-4 w-4" /> Ver histórico
        </button>
        <button type="button" onClick={() => onEdit(receivable)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          <PencilLine className="h-4 w-4" /> Editar
        </button>
      </div>
    </div>
  );
}
