import { CheckCircle2, Eye, MessageCircle, PencilLine } from 'lucide-react';
import { financialService } from '../../../services/financialService';
import { buildWhatsAppLink } from '../../../services/whatsappService.js';
import { formatCompetenceBR, formatDateBR } from '../../../services/dateUtils.js';
import { calculateOutstandingValue } from '../services/receivableService.js';

const STATUS_BADGE = {
  vencido: 'bg-red-100 text-red-700',
  pendente: 'bg-amber-100 text-amber-700',
  pago: 'bg-emerald-100 text-emerald-700',
  parcial: 'bg-blue-100 text-blue-700',
};

const readWhatsappPreference = () => {
  if (typeof window === 'undefined') return true;

  try {
    const settings = JSON.parse(window.localStorage.getItem('@kitmanager/settings') || '{}');
    return settings.whatsappReminders !== false;
  } catch {
    return true;
  }
};

// Tabela para desktop/tablet; no celular a lista continua em ReceivableCard
// (empilhado, mesma lógica de ações). Ambos compartilham a mesma regra de
// negócio: receber marca o recebível como pago e por baixo já cria o
// Pagamento correspondente (ver receivableService.registerPayment).
export function ReceivableTable({ receivables, onPay, onEdit, onHistory }) {
  const currency = financialService.formatCurrency;
  const whatsappEnabled = readWhatsappPreference();

  return (
    <div className="ds-table hidden max-h-[70vh] overflow-auto md:block">
      <table className="w-full text-left text-sm">
        <thead className="text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-4 py-3">Kitnet / Locatário</th>
            <th className="px-4 py-3">Competência</th>
            <th className="px-4 py-3">Vencimento</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3">Status</th>
            <th className="w-36 px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {receivables.map((receivable) => {
            const outstandingValue = calculateOutstandingValue(receivable);
            const tenantPhone = receivable.tenant?.whatsapp || receivable.tenant?.phone;
            const isPaid = receivable.status === 'pago';

            const handleWhatsApp = () => {
              const message = [
                `Olá, ${receivable.tenant?.name || 'tudo bem'}!`,
                `Passando para lembrar do aluguel de ${formatCompetenceBR(receivable.competence)}.`,
                `Valor em aberto: ${currency(outstandingValue || receivable.expected_value)}.`,
                `Vencimento: ${formatDateBR(receivable.due_date)}.`,
              ].join(' ');

              const link = buildWhatsAppLink(tenantPhone, message);
              if (link) window.open(link, '_blank', 'noopener,noreferrer');
            };

            return (
              <tr key={receivable.id} className="border-t border-slate-100 transition hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{receivable.kitnet?.name || 'Kitnet'}</p>
                  <p className="text-xs text-slate-500">{receivable.tenant?.name || 'sem locatário'}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{formatCompetenceBR(receivable.competence)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateBR(receivable.due_date)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <p className="font-semibold text-slate-900">{currency(receivable.expected_value)}</p>
                  {receivable.paid_value ? <p className="text-xs text-emerald-700">Pago: {currency(receivable.paid_value)}</p> : null}
                  {outstandingValue > 0 && receivable.paid_value ? <p className="text-xs text-slate-500">Resta: {currency(outstandingValue)}</p> : null}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_BADGE[receivable.status] || 'bg-slate-100 text-slate-600'}`}>
                    {receivable.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {!isPaid ? (
                      <button type="button" onClick={() => onPay(receivable)} title="Receber" aria-label="Receber pagamento" className="rounded-xl bg-emerald-600 p-2 text-white transition hover:bg-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    ) : null}
                    {whatsappEnabled && tenantPhone && !isPaid ? (
                      <button type="button" onClick={handleWhatsApp} title="Cobrar pelo WhatsApp" aria-label="Cobrar pelo WhatsApp" className="rounded-xl border border-emerald-200 p-2 text-emerald-600 transition hover:bg-emerald-50">
                        <MessageCircle className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button type="button" onClick={() => onHistory(receivable)} title="Ver histórico" aria-label="Ver histórico" className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => onEdit(receivable)} title="Editar" aria-label="Editar" className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50">
                      <PencilLine className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ReceivableTable;
