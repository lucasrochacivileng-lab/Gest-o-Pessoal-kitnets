export const notificationDeliveryService = {
  async sendEmail(notification) {
    const payload = {
      provider: 'local-simulated',
      futureProviders: ['supabase-edge-functions', 'resend', 'pwa-push-notifications'],
      to: notification.recipient_email || 'destinatario-nao-configurado',
      subject: notification.title,
      body: notification.message,
      deepLink: notification.deep_link,
    };

    return {
      ok: true,
      payload,
      message: 'Envio simulado localmente. Pronto para conectar Resend via Supabase Edge Function.',
    };
  },
};

export default notificationDeliveryService;
