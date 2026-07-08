import { useEffect, useMemo, useState } from 'react';
import { Bell, RefreshCw, Send } from 'lucide-react';
import NotificationCard from '../components/NotificationCard.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import notificationService from '../services/notificationService.js';
import { NOTIFICATION_STATUS, notificationStatusLabels } from '../types/notification.types.js';

const statusFilters = [
  { value: 'todos', label: 'Todos' },
  ...Object.values(NOTIFICATION_STATUS).map((status) => ({
    value: status,
    label: notificationStatusLabels[status],
  })),
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState(notificationService.readSettings());
  const [filter, setFilter] = useState('todos');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const result = await notificationService.loadCenterData();
    setNotifications(result.notifications);
    setSettings(result.settings);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    return notifications.reduce((acc, notification) => {
      acc[notification.status] = (acc[notification.status] || 0) + 1;
      return acc;
    }, {});
  }, [notifications]);

  const visibleNotifications = useMemo(() => {
    if (filter === 'todos') return notifications;
    return notifications.filter((notification) => notification.status === filter);
  }, [filter, notifications]);

  const updateSetting = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const saveSettings = () => {
    const next = notificationService.saveSettings(settings);
    setSettings(next);
    setMessage('Configurações de notificação salvas.');
  };

  const generateNotifications = async () => {
    const result = await notificationService.generateDueNotifications();
    setMessage(`${result.created.length} notificação(ões) criada(s). ${result.skipped.length} já existia(m).`);
    await load();
  };

  const sendPendingNow = async () => {
    const sent = await notificationService.sendPendingNow();
    setMessage(`${sent.length} lembrete(s) processado(s) em modo local/simulado.`);
    await load();
  };

  const sendOneNow = async (notificationId) => {
    await notificationService.sendNow(notificationId);
    setMessage('Lembrete processado em modo local/simulado.');
    await load();
  };

  const sendWhatsApp = async (notificationId) => {
    // Abre a janela ANTES do trabalho assíncrono para não cair no bloqueador
    // de pop-ups; se algo falhar, ela é fechada.
    const whatsappWindow = window.open('', '_blank', 'noopener,noreferrer');

    try {
      const { link, tenantName } = await notificationService.getWhatsAppLink(notificationId);

      if (whatsappWindow) {
        whatsappWindow.location = link;
      } else {
        window.open(link, '_blank', 'noopener,noreferrer');
      }

      await notificationService.registerWhatsAppSent(notificationId, tenantName);
      setMessage(`Cobrança aberta no WhatsApp${tenantName ? ` de ${tenantName}` : ''}. A notificação foi marcada como enviada.`);
      await load();
    } catch (error) {
      whatsappWindow?.close();
      setMessage(error instanceof Error ? error.message : 'Não foi possível abrir o WhatsApp.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notificações</h1>
          <p className="text-sm text-slate-500">
            Alertas de contas, aluguéis e contratos a vencer com histórico de envio e confirmação.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={generateNotifications} className="ds-btn ds-btn-secondary">
            <RefreshCw className="h-4 w-4" /> Gerar alertas agora
          </button>
          <button type="button" onClick={sendPendingNow} className="ds-btn ds-btn-primary">
            <Send className="h-4 w-4" /> Enviar lembretes pendentes
          </button>
        </div>
      </div>

      {message ? <div className="ds-alert ds-alert-info">{message}</div> : null}

      <NotificationSettings
        settings={settings}
        onChange={updateSetting}
        onSave={saveSettings}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <div className="ds-card">
          <p className="text-sm text-slate-500">Pendentes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary[NOTIFICATION_STATUS.PENDING] || 0}</p>
        </div>
        <div className="ds-card">
          <p className="text-sm text-slate-500">Enviadas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary[NOTIFICATION_STATUS.SENT] || 0}</p>
        </div>
        <div className="ds-card">
          <p className="text-sm text-slate-500">Confirmadas</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary[NOTIFICATION_STATUS.CONFIRMED] || 0}</p>
        </div>
        <div className="ds-card">
          <p className="text-sm text-slate-500">Erros</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary[NOTIFICATION_STATUS.ERROR] || 0}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Bell className="h-5 w-5" /> Central de notificações
            </h2>
            <p className="text-sm text-slate-500">
              Cobranças de aluguel e contrato podem ser enviadas pelo WhatsApp; o envio por e-mail ainda é simulado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                  filter === item.value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="ds-card text-slate-500">Carregando notificações...</div>
        ) : visibleNotifications.length ? (
          <div className="space-y-4">
            {visibleNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onSendNow={sendOneNow}
                onWhatsApp={sendWhatsApp}
              />
            ))}
          </div>
        ) : (
          <div className="ds-card text-slate-500">
            Nenhuma notificação encontrada para este filtro.
          </div>
        )}
      </section>
    </div>
  );
}
