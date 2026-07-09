import { repository } from '../../../repository/index.js';
import notificationDeliveryService from './notificationDeliveryService.js';
import receivableService from '../../receivables/services/receivableService.js';
import { buildWhatsAppLink } from '../../../services/whatsappService.js';
import { formatDateBR } from '../../../services/dateUtils.js';
import {
  NOTIFICATION_ENTITY,
  NOTIFICATION_EVENT,
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPE,
} from '../types/notification.types.js';

const SETTINGS_KEY = '@kitmanager/notification-settings';

export const defaultNotificationSettings = {
  expenseAlertDays: '3',
  rentAlertDays: '5',
  contractAlertDays: '30,60',
  defaultRecipientEmail: '',
  emailEnabled: false,
  pushEnabled: false,
};

const todayString = () => new Date().toISOString().slice(0, 10);
const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
};

const parseDays = (value, fallback = [3]) => {
  const days = String(value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item >= 0);

  return days.length ? days : fallback;
};

const getTargetDueDate = (row) => row.due_date || row.date || row.end_date || '';

const isDateWithinAlertWindow = (date, days, currentDate = todayString()) => {
  if (!date || date < currentDate) return false;

  return days.some((day) => date <= addDays(currentDate, day));
};

export const buildDeepLink = (entity, id) => {
  const routes = {
    [NOTIFICATION_ENTITY.EXPENSE]: '/despesas',
    [NOTIFICATION_ENTITY.RECEIVABLE]: '/recebimentos',
    [NOTIFICATION_ENTITY.CONTRACT]: '/contratos',
    [NOTIFICATION_ENTITY.PROJECT]: '/projetos',
    [NOTIFICATION_ENTITY.EXPERT_REPORT]: '/pericias',
  };

  return `${routes[entity] || '/notificacoes'}/${id}`;
};

export const readNotificationSettings = () => {
  if (typeof window === 'undefined') return defaultNotificationSettings;

  try {
    return {
      ...defaultNotificationSettings,
      ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}'),
    };
  } catch {
    return defaultNotificationSettings;
  }
};

export const writeNotificationSettings = (settings) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultNotificationSettings, ...settings }));
};

const createEvent = async (notificationId, action, notes = '') => {
  return repository.create('NotificationEvent', {
    notification_id: notificationId,
    action,
    notes,
    created_at: new Date().toISOString(),
    active: true,
  });
};

const getTenantById = (tenants, tenantId) => tenants.find((tenant) => tenant.id === tenantId) || null;
const getKitnetById = (kitnets, kitnetId) => kitnets.find((kitnet) => kitnet.id === kitnetId) || null;
const getContractById = (contracts, contractId) => contracts.find((contract) => contract.id === contractId) || null;

const findExistingNotification = (notifications, candidate) => {
  return notifications.find((notification) => (
    notification.type === candidate.type
    && notification.entity === candidate.entity
    && notification.entity_id === candidate.entity_id
    && notification.status !== NOTIFICATION_STATUS.CONFIRMED
    && notification.status !== NOTIFICATION_STATUS.IGNORED
    && notification.active !== false
  ));
};

const buildExpenseCandidate = (expense, settings, currentDate) => {
  const dueDate = getTargetDueDate(expense);
  const days = parseDays(settings.expenseAlertDays, [3]);
  const isOverdue = Boolean(dueDate) && dueDate < currentDate;

  if (expense.status === 'pago' || (!isOverdue && !isDateWithinAlertWindow(dueDate, days, currentDate))) return null;

  const label = expense.description || expense.category || expense.id;
  const title = isOverdue ? `Conta vencida: ${label}` : `Conta a vencer: ${label}`;
  const message = isOverdue
    ? `A conta "${label}" venceu em ${formatDateBR(dueDate)} e continua marcada como pendente. Ela já foi paga?`
    : `A conta "${label}" vence em ${formatDateBR(dueDate)}. Ela já foi paga?`;

  return {
    type: NOTIFICATION_TYPE.EXPENSE_DUE,
    entity: NOTIFICATION_ENTITY.EXPENSE,
    entity_id: expense.id,
    title,
    message,
    recipient_email: settings.defaultRecipientEmail,
    due_date: dueDate,
    deep_link: buildDeepLink(NOTIFICATION_ENTITY.EXPENSE, expense.id),
    scheduled_for: currentDate,
  };
};

const buildReceivableCandidate = (receivable, contracts, tenants, kitnets, settings, currentDate) => {
  const dueDate = getTargetDueDate(receivable);
  const days = parseDays(settings.rentAlertDays, [5]);
  const isOverdue = Boolean(dueDate) && dueDate < currentDate;

  if (receivable.status === 'pago' || (!isOverdue && !isDateWithinAlertWindow(dueDate, days, currentDate))) return null;

  const contract = getContractById(contracts, receivable.contract_id);
  const tenant = getTenantById(tenants, receivable.tenant_id || contract?.tenant_id);
  const kitnet = getKitnetById(kitnets, receivable.kitnet_id || contract?.kitnet_id);
  const label = kitnet?.name || receivable.competence || receivable.id;
  const title = isOverdue ? `Aluguel vencido: ${label}` : `Aluguel a vencer: ${label}`;
  const message = isOverdue
    ? `O aluguel de ${tenant?.name || 'locatário não informado'} venceu em ${formatDateBR(dueDate)} e ainda não foi registrado. Foi pago?`
    : `O aluguel de ${tenant?.name || 'locatário não informado'} vence em ${formatDateBR(dueDate)}. O pagamento já foi confirmado?`;

  return {
    type: NOTIFICATION_TYPE.RENT_DUE,
    entity: NOTIFICATION_ENTITY.RECEIVABLE,
    entity_id: receivable.id,
    title,
    message,
    recipient_email: tenant?.email || settings.defaultRecipientEmail,
    due_date: dueDate,
    deep_link: buildDeepLink(NOTIFICATION_ENTITY.RECEIVABLE, receivable.id),
    scheduled_for: currentDate,
  };
};

const buildContractCandidate = (contract, tenants, kitnets, settings, currentDate) => {
  const dueDate = getTargetDueDate(contract);
  const days = parseDays(settings.contractAlertDays, [30, 60]);

  if (contract.status !== 'ativo' || !isDateWithinAlertWindow(dueDate, days, currentDate)) return null;

  const tenant = getTenantById(tenants, contract.tenant_id);
  const kitnet = getKitnetById(kitnets, contract.kitnet_id);
  const title = `Contrato a vencer: ${kitnet?.name || contract.id}`;
  const message = `O contrato de ${tenant?.name || 'locatário não informado'} vence em ${formatDateBR(dueDate)}. Abra o app para renovar, encerrar ou acompanhar.`;

  return {
    type: NOTIFICATION_TYPE.CONTRACT_DUE,
    entity: NOTIFICATION_ENTITY.CONTRACT,
    entity_id: contract.id,
    title,
    message,
    recipient_email: tenant?.email || settings.defaultRecipientEmail,
    due_date: dueDate,
    deep_link: buildDeepLink(NOTIFICATION_ENTITY.CONTRACT, contract.id),
    scheduled_for: currentDate,
  };
};

// Próximo aniversário do contrato (data de reajuste anual): a menor data
// "start_date + k anos" (k >= 1) que ainda não passou. Retorna '' sem start_date.
export const getNextAdjustmentDate = (startDate, currentDate = todayString()) => {
  const start = String(startDate || '').slice(0, 10);
  if (!start || start.length < 10) return '';

  const startYear = Number(start.slice(0, 4));
  const monthDay = start.slice(4); // '-MM-DD'
  let year = Math.max(startYear + 1, Number(currentDate.slice(0, 4)));
  let candidate = `${year}${monthDay}`;

  if (candidate < currentDate) {
    candidate = `${year + 1}${monthDay}`;
  }

  return candidate;
};

const buildContractAdjustCandidate = (contract, tenants, kitnets, settings, currentDate) => {
  if (contract.status !== 'ativo' || !contract.start_date) return null;

  const adjustDate = getNextAdjustmentDate(contract.start_date, currentDate);
  if (!adjustDate) return null;
  if (contract.end_date && adjustDate > String(contract.end_date).slice(0, 10)) return null;

  const days = parseDays(settings.contractAlertDays, [30, 60]);
  if (!isDateWithinAlertWindow(adjustDate, days, currentDate)) return null;

  const years = Number(adjustDate.slice(0, 4)) - Number(String(contract.start_date).slice(0, 4));
  const tenant = getTenantById(tenants, contract.tenant_id);
  const kitnet = getKitnetById(kitnets, contract.kitnet_id);
  const title = `Reajuste anual: ${kitnet?.name || contract.id}`;
  const message = `O contrato de ${tenant?.name || 'locatário não informado'} completa ${years} ano(s) em ${formatDateBR(adjustDate)}. `
    + 'Considere aplicar o reajuste anual do aluguel (IGP-M ou IPCA acumulado de 12 meses) e atualizar o valor no contrato.';

  return {
    type: NOTIFICATION_TYPE.CONTRACT_ADJUST,
    entity: NOTIFICATION_ENTITY.CONTRACT,
    entity_id: contract.id,
    title,
    message,
    recipient_email: settings.defaultRecipientEmail,
    due_date: adjustDate,
    deep_link: buildDeepLink(NOTIFICATION_ENTITY.CONTRACT, contract.id),
    scheduled_for: currentDate,
  };
};

// Projetos e perícias: no dia previsto do recebimento (e enquanto atrasar),
// pergunta se o valor já caiu na conta.
const buildProjectPaymentCandidate = (row, entity, settings, currentDate) => {
  const expectedDate = row.expected_payment_date || '';
  if (!expectedDate || row.status === 'recebido') return null;

  const isOverdue = expectedDate < currentDate;
  const isDueToday = expectedDate === currentDate;
  if (!isOverdue && !isDueToday) return null;

  const kind = entity === NOTIFICATION_ENTITY.EXPERT_REPORT ? 'Perícia' : 'Projeto';
  const label = [kind, row.client || row.process_number || row.project_type || row.report_type].filter(Boolean).join(' ');
  const value = Number(row.fee_value ?? row.value ?? 0);
  const money = value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const title = isOverdue ? `Recebimento atrasado: ${label}` : `Recebimento previsto hoje: ${label}`;
  const message = isOverdue
    ? `O recebimento de ${money} (${label.toLowerCase()}) estava previsto para ${formatDateBR(expectedDate)} e ainda não foi confirmado. O valor já caiu na conta?`
    : `Hoje é o dia previsto do recebimento de ${money} (${label.toLowerCase()}). O valor já caiu na conta?`;

  return {
    type: NOTIFICATION_TYPE.PROJECT_PAYMENT_DUE,
    entity,
    entity_id: row.id,
    title,
    message,
    recipient_email: settings.defaultRecipientEmail,
    due_date: expectedDate,
    deep_link: buildDeepLink(entity, row.id),
    scheduled_for: currentDate,
  };
};

const findNotificationsForTarget = async (entity, id) => {
  const notifications = await repository.list('Notification');
  return notifications.filter((notification) => (
    notification.entity === entity
    && notification.entity_id === id
    && notification.active !== false
  ));
};

const updateTargetAsPaid = async (entity, id) => {
  if (entity === NOTIFICATION_ENTITY.EXPENSE) {
    return repository.update('Expense', id, { status: 'pago', paid_at: todayString() });
  }

  if (entity === NOTIFICATION_ENTITY.RECEIVABLE) {
    const rows = await repository.list('Receivable');
    const receivable = rows.find((row) => row.id === id);
    if (!receivable) return null;

    // Precisa passar pelo MESMO caminho do botão "Receber" (registerPayment),
    // não só marcar o recebível como pago: só assim cria o Pagamento que
    // Extrato, Visão Geral e Dashboard usam para somar a receita do mês.
    // Confirmar aqui sem paid_value = recebeu o valor cheio (mesma regra
    // do "??" em registerPayment).
    const { receivable: updated } = await receivableService.registerPayment(receivable, {});
    return updated;
  }

  if (entity === NOTIFICATION_ENTITY.PROJECT || entity === NOTIFICATION_ENTITY.EXPERT_REPORT) {
    return repository.update(entity, id, { status: 'recebido', received_at: todayString() });
  }

  return null;
};

export const notificationService = {
  readSettings: readNotificationSettings,
  saveSettings(settings) {
    writeNotificationSettings(settings);
    return readNotificationSettings();
  },

  async loadCenterData() {
    const [notifications, events] = await Promise.all([
      repository.list('Notification'),
      repository.list('NotificationEvent'),
    ]);

    return {
      notifications: notifications
        .map((notification) => ({
          ...notification,
          events: events
            .filter((event) => event.notification_id === notification.id)
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
        }))
        .sort((a, b) => String(b.created_at || b.scheduled_for || '').localeCompare(String(a.created_at || a.scheduled_for || ''))),
      settings: readNotificationSettings(),
    };
  },

  async generateDueNotifications(currentDate = todayString()) {
    const settings = readNotificationSettings();
    const [expenses, receivables, contracts, tenants, kitnets, notifications, projects, expertReports] = await Promise.all([
      repository.list('Expense'),
      repository.list('Receivable'),
      repository.list('Contract'),
      repository.list('Tenant'),
      repository.list('Kitnet'),
      repository.list('Notification'),
      repository.list('ComplementaryProject'),
      repository.list('ExpertReport'),
    ]);

    const candidates = [
      ...expenses.map((expense) => buildExpenseCandidate(expense, settings, currentDate)),
      ...receivables.map((receivable) => buildReceivableCandidate(receivable, contracts, tenants, kitnets, settings, currentDate)),
      ...contracts.map((contract) => buildContractCandidate(contract, tenants, kitnets, settings, currentDate)),
      ...contracts.map((contract) => buildContractAdjustCandidate(contract, tenants, kitnets, settings, currentDate)),
      ...projects.map((project) => buildProjectPaymentCandidate(project, NOTIFICATION_ENTITY.PROJECT, settings, currentDate)),
      ...expertReports.map((report) => buildProjectPaymentCandidate(report, NOTIFICATION_ENTITY.EXPERT_REPORT, settings, currentDate)),
    ].filter(Boolean);

    const created = [];
    const skipped = [];

    for (const candidate of candidates) {
      const existing = findExistingNotification(notifications, candidate);

      if (existing) {
        skipped.push(existing);
        continue;
      }

      const notification = await repository.create('Notification', {
        ...candidate,
        status: NOTIFICATION_STATUS.PENDING,
        created_at: new Date().toISOString(),
        active: true,
      });
      await createEvent(notification.id, NOTIFICATION_EVENT.CREATED, 'Notificação gerada por verificação manual.');
      created.push(notification);
    }

    return { created, skipped, totalCandidates: candidates.length };
  },

  // Resolve o link wa.me da notificação (telefone do locatário + mensagem).
  // Lança erro amigável quando não há locatário/telefone associado.
  async getWhatsAppLink(notificationId) {
    const [notifications, receivables, contracts, tenants] = await Promise.all([
      repository.list('Notification'),
      repository.list('Receivable'),
      repository.list('Contract'),
      repository.list('Tenant'),
    ]);

    const notification = notifications.find((item) => item.id === notificationId);

    if (!notification) {
      throw new Error('Notificação não encontrada.');
    }

    let tenantId = null;

    if (notification.entity === NOTIFICATION_ENTITY.RECEIVABLE) {
      const receivable = receivables.find((row) => row.id === notification.entity_id);
      const contract = getContractById(contracts, receivable?.contract_id);
      tenantId = receivable?.tenant_id || contract?.tenant_id || null;
    } else if (notification.entity === NOTIFICATION_ENTITY.CONTRACT) {
      const contract = getContractById(contracts, notification.entity_id);
      tenantId = contract?.tenant_id || null;
    }

    const tenant = getTenantById(tenants, tenantId);
    const phone = tenant?.whatsapp || tenant?.phone;
    const link = buildWhatsAppLink(phone, notification.message);

    if (!link) {
      throw new Error(`Sem telefone cadastrado para ${tenant?.name || 'o locatário desta notificação'}. Cadastre o telefone na tela de Locatários.`);
    }

    return { link, tenantName: tenant?.name || '' };
  },

  // Registra que a cobrança foi aberta no WhatsApp (a UI abre o link).
  async registerWhatsAppSent(notificationId, tenantName = '') {
    const updated = await repository.update('Notification', notificationId, {
      status: NOTIFICATION_STATUS.SENT,
      sent_at: new Date().toISOString(),
      delivery_payload: { provider: 'whatsapp-link' },
      error_message: '',
    });
    await createEvent(notificationId, NOTIFICATION_EVENT.SENT, `Cobrança aberta no WhatsApp${tenantName ? ` de ${tenantName}` : ''}.`);
    return updated;
  },

  async sendNow(notificationId) {
    const notifications = await repository.list('Notification');
    const notification = notifications.find((item) => item.id === notificationId);

    if (!notification) {
      throw new Error('Notificação não encontrada.');
    }

    try {
      const result = await notificationDeliveryService.sendEmail(notification);
      const updated = await repository.update('Notification', notification.id, {
        status: NOTIFICATION_STATUS.SENT,
        sent_at: new Date().toISOString(),
        delivery_payload: result.payload,
        error_message: '',
      });
      await createEvent(notification.id, NOTIFICATION_EVENT.SENT, result.message);
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar lembrete.';
      const updated = await repository.update('Notification', notification.id, {
        status: NOTIFICATION_STATUS.ERROR,
        error_message: message,
      });
      await createEvent(notification.id, NOTIFICATION_EVENT.ERROR, message);
      return updated;
    }
  },

  async sendPendingNow() {
    const notifications = await repository.list('Notification');
    const pending = notifications.filter((notification) => notification.status === NOTIFICATION_STATUS.PENDING);
    const sent = [];

    for (const notification of pending) {
      sent.push(await this.sendNow(notification.id));
    }

    return sent;
  },

  async markOpenedByTarget(entity, id) {
    const notifications = await findNotificationsForTarget(entity, id);
    const openable = notifications.filter((notification) => (
      notification.status === NOTIFICATION_STATUS.PENDING
      || notification.status === NOTIFICATION_STATUS.SENT
    ));

    for (const notification of openable) {
      if (!notification.opened_at) {
        await repository.update('Notification', notification.id, { opened_at: new Date().toISOString() });
      }
      await createEvent(notification.id, NOTIFICATION_EVENT.OPENED, 'Deep link aberto no app.');
    }

    return openable;
  },

  async confirmTarget(entity, id) {
    await updateTargetAsPaid(entity, id);
    const notifications = await findNotificationsForTarget(entity, id);

    for (const notification of notifications) {
      await repository.update('Notification', notification.id, {
        status: NOTIFICATION_STATUS.CONFIRMED,
        confirmed_at: new Date().toISOString(),
      });
      await createEvent(notification.id, NOTIFICATION_EVENT.CONFIRMED, 'Confirmação registrada pelo usuário.');
    }
  },

  async snoozeTarget(entity, id) {
    const notifications = await findNotificationsForTarget(entity, id);
    const scheduledFor = addDays(todayString(), 1);

    for (const notification of notifications) {
      await repository.update('Notification', notification.id, {
        status: NOTIFICATION_STATUS.PENDING,
        scheduled_for: scheduledFor,
      });
      await createEvent(notification.id, NOTIFICATION_EVENT.SNOOZED, `Lembrete adiado para ${scheduledFor}.`);
    }
  },

  async ignoreTarget(entity, id) {
    const notifications = await findNotificationsForTarget(entity, id);

    for (const notification of notifications) {
      await repository.update('Notification', notification.id, {
        status: NOTIFICATION_STATUS.IGNORED,
        ignored_at: new Date().toISOString(),
      });
      await createEvent(notification.id, NOTIFICATION_EVENT.IGNORED, 'Lembrete ignorado pelo usuário.');
    }
  },
};

export default notificationService;
