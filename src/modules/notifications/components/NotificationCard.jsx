import { ExternalLink, MessageCircle, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDateBR } from '../../../services/dateUtils.js';
import {
  notificationStatusLabels,
  notificationTypeLabels,
  NOTIFICATION_ENTITY,
  NOTIFICATION_STATUS,
} from '../types/notification.types.js';

const statusClass = {
  [NOTIFICATION_STATUS.PENDING]: 'ds-badge-warning',
  [NOTIFICATION_STATUS.SENT]: 'ds-badge-info',
  [NOTIFICATION_STATUS.CONFIRMED]: 'ds-badge-success',
  [NOTIFICATION_STATUS.ERROR]: 'ds-badge-danger',
  [NOTIFICATION_STATUS.IGNORED]: 'ds-badge-info',
};

export function NotificationCard({ notification, onSendNow, onWhatsApp }) {
  // WhatsApp só faz sentido quando há locatário por trás (aluguel/contrato)
  // e a notificação ainda está em aberto.
  const canWhatsApp = Boolean(onWhatsApp)
    && (notification.entity === NOTIFICATION_ENTITY.RECEIVABLE || notification.entity === NOTIFICATION_ENTITY.CONTRACT)
    && notification.status !== NOTIFICATION_STATUS.CONFIRMED
    && notification.status !== NOTIFICATION_STATUS.IGNORED;

  return (
    <article className="ds-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`ds-badge ${statusClass[notification.status] || 'ds-badge-info'}`}>
              {notificationStatusLabels[notification.status] || notification.status}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {notificationTypeLabels[notification.type] || notification.type}
            </span>
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">{notification.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{notification.message}</p>
          <div className="mt-3 grid gap-1 text-xs text-slate-500 md:grid-cols-2">
            <p>Vencimento: {formatDateBR(notification.due_date) || '-'}</p>
            <p>E-mail: {notification.recipient_email || 'não configurado'}</p>
            <p>Agendado para: {formatDateBR(notification.scheduled_for) || '-'}</p>
            <p>Enviado em: {formatDateBR(notification.sent_at) || '-'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={notification.deep_link || '/notificacoes'} className="ds-btn ds-btn-secondary">
            <ExternalLink className="h-4 w-4" /> Abrir item
          </Link>
          {canWhatsApp ? (
            <button
              type="button"
              onClick={() => onWhatsApp(notification.id)}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <MessageCircle className="h-4 w-4" /> Cobrar no WhatsApp
            </button>
          ) : null}
          <button type="button" onClick={() => onSendNow(notification.id)} className="ds-btn ds-btn-primary">
            <Send className="h-4 w-4" /> Enviar lembrete agora
          </button>
        </div>
      </div>

      {notification.events?.length ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Histórico</p>
          <div className="mt-3 space-y-2">
            {notification.events.map((event) => (
              <div key={event.id} className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{event.action}</span>
                {' · '}
                {event.created_at || '-'}
                {event.notes ? ` · ${event.notes}` : ''}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default NotificationCard;
