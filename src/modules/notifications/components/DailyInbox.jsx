import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, Check, Clock, ExternalLink, X } from 'lucide-react';
import notificationService from '../services/notificationService.js';
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_STATUS,
  notificationTypeLabels,
} from '../types/notification.types.js';

const LAST_SHOWN_KEY = '@kitmanager/daily-inbox-date';
const todayString = () => new Date().toISOString().slice(0, 10);

const wasShownToday = () => {
  try {
    return window.localStorage.getItem(LAST_SHOWN_KEY) === todayString();
  } catch {
    return false;
  }
};

const markShownToday = () => {
  try {
    window.localStorage.setItem(LAST_SHOWN_KEY, todayString());
  } catch {
    // sem localStorage, apenas não persiste a marcação
  }
};

// Pergunta do dia: ao abrir o app, verifica vencimentos (gera os alertas
// sozinho) e pergunta item a item se já foi pago — resolve o "esquecer de
// alimentar a planilha": o app cobra o dono, não o contrário.
export function DailyInbox() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (wasShownToday()) return;

      try {
        await notificationService.generateDueNotifications();
        const { notifications } = await notificationService.loadCenterData();
        const current = todayString();
        const actionable = notifications.filter((notification) => (
          notification.active !== false
          && (notification.status === NOTIFICATION_STATUS.PENDING || notification.status === NOTIFICATION_STATUS.SENT)
          && String(notification.scheduled_for || current) <= current
        ));

        // Uma pergunta por alvo: descarta notificações repetidas do mesmo item.
        const seen = new Set();
        const unique = actionable.filter((notification) => {
          const key = `${notification.entity}|${notification.entity_id}|${notification.type}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        if (!cancelled && unique.length > 0) {
          setItems(unique);
          setOpen(true);
          markShownToday();
        }
      } catch {
        // sem conexão/erro: não bloqueia a abertura do app
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open || items.length === 0) return null;

  const removeItem = (id) => {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      if (next.length === 0) setOpen(false);
      return next;
    });
  };

  const isPayable = (item) => (
    item.entity === NOTIFICATION_ENTITY.RECEIVABLE
    || item.entity === NOTIFICATION_ENTITY.EXPENSE
    || item.entity === NOTIFICATION_ENTITY.PROJECT
    || item.entity === NOTIFICATION_ENTITY.EXPERT_REPORT
  );

  const confirmLabel = (item) => (item.entity === NOTIFICATION_ENTITY.EXPENSE ? 'Sim, foi pago' : 'Sim, recebi');

  const handleConfirm = async (item) => {
    setBusyId(item.id);
    try {
      await notificationService.confirmTarget(item.entity, item.entity_id);
      removeItem(item.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleSnooze = async (item) => {
    setBusyId(item.id);
    try {
      await notificationService.snoozeTarget(item.entity, item.entity_id);
      removeItem(item.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleOpen = (item) => {
    setOpen(false);
    navigate(item.deep_link || '/notificacoes');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-3xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-6 pb-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BellRing className="h-5 w-5 text-amber-500" /> Pendências de hoje
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {items.length} item(ns) esperando resposta. Responda aqui mesmo — leva segundos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar pendências"
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-6 pt-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {notificationTypeLabels[item.type] || item.type}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {isPayable(item) ? (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => handleConfirm(item)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" /> {confirmLabel(item)}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => handleSnooze(item)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <Clock className="h-4 w-4" /> Lembrar amanhã
                </button>
                <button
                  type="button"
                  onClick={() => handleOpen(item)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <ExternalLink className="h-4 w-4" /> Abrir no app
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DailyInbox;
