import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronRight, MessageCircle } from 'lucide-react';
import { financialService } from '../../services/financialService';
import { buildWhatsAppLink } from '../../services/whatsappService.js';
import { formatCompetenceBR, formatDateBR } from '../../services/dateUtils.js';

const lateLabel = (item) => {
  if (item.daysLate > 0) return `${item.daysLate} dia(s) em atraso`;
  if (item.daysLate === 0) return 'vence hoje';
  return `vence em ${-item.daysLate} dia(s)`;
};

// Bloco "Precisa de você": cobranças resolvidas direto do dashboard,
// pensado para uso no celular (botões grandes, uma ação por linha).
export function ActionCenter({ items = [] }) {
  const navigate = useNavigate();

  if (!items.length) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
        Tudo em dia! Nenhum aluguel vencido ou vencendo nos próximos 3 dias.
      </div>
    );
  }

  const sendWhatsApp = (item) => {
    const message = [
      `Olá, ${item.tenantName || 'tudo bem'}!`,
      item.isFine
        ? `Passando para lembrar da multa contratual (${formatCompetenceBR(item.competence)}).`
        : `Passando para lembrar do aluguel de ${formatCompetenceBR(item.competence)}.`,
      `Valor em aberto: ${financialService.formatCurrency(item.outstanding)}.`,
      `Vencimento: ${formatDateBR(item.dueDate)}.`,
    ].join(' ');

    const link = buildWhatsAppLink(item.tenantPhone, message);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <h2 className="text-base font-semibold text-amber-900">Precisa de você</h2>
        <span className="ml-auto rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
          {items.length}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-[var(--radius-lg)] border border-amber-100 bg-white p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {item.kitnetName || 'Kitnet'}{item.tenantName ? ` · ${item.tenantName}` : ''}
                </p>
                <p className="text-xs text-slate-500">
                  {item.isFine ? 'Multa de quebra' : `Aluguel ${formatCompetenceBR(item.competence)}`}
                  {' · '}
                  <span className={item.daysLate > 0 ? 'font-semibold text-red-600' : 'text-slate-500'}>
                    {lateLabel(item)}
                  </span>
                </p>
              </div>
              <p className="flex-shrink-0 text-sm font-bold text-slate-900">
                {financialService.formatCurrency(item.outstanding)}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex">
              {item.tenantPhone ? (
                <button
                  type="button"
                  onClick={() => sendWhatsApp(item)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" /> Cobrar
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => navigate(`/recebimentos/${item.id}`)}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 ${item.tenantPhone ? '' : 'col-span-2'}`}
              >
                Registrar <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ActionCenter;
