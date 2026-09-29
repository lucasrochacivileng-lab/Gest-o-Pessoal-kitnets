import { addMoney, subtractMoney, toCents, fromCents } from './money.js';

export const paymentFields = ['paid_value', 'discount', 'fine', 'interest', 'payment_date', 'payment_method', 'bank_account_id', 'destination_account', 'receipt_url', 'notes'];
export const paymentSnapshot = (row) => Object.fromEntries(paymentFields.filter((key) => row[key] !== undefined).map((key) => [key, row[key]]));

export function validatePayment(values) {
  const result = { ...values };
  for (const key of ['paid_value', 'discount', 'fine', 'interest']) {
    const value = Number(values[key] ?? 0);
    if (!Number.isFinite(value) || value < 0) throw new Error('Informe valores monetários válidos e não negativos.');
    result[key] = fromCents(toCents(value));
  }
  result.net_value = addMoney(subtractMoney(result.paid_value, result.discount), result.fine, result.interest);
  if (result.net_value < 0) throw new Error('O desconto não pode tornar o valor líquido negativo.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.payment_date || '') || !Number.isFinite(Date.parse(result.payment_date))
    || new Date(result.payment_date).toISOString().slice(0, 10) !== result.payment_date) throw new Error('Informe uma data de pagamento válida.');
  return result;
}

export function syncLocalRentNotifications(db, receivable) {
  const resolved = receivable.active === false || ['pago', 'cancelado'].includes(receivable.status)
    || toCents(receivable.paid_value) >= toCents(receivable.expected_value);
  for (const notification of db.Notification || []) {
    if (notification.entity !== 'Receivable' || notification.entity_id !== receivable.id || notification.type !== 'rent_due' || notification.active === false) continue;
    if (resolved && !['confirmada', 'ignorada', 'resolvida'].includes(notification.status)) {
      notification.status = 'resolvida';
      notification.resolved_at = new Date().toISOString();
      notification.resolution_source = 'receivable';
    } else if (!resolved && ['resolvida', 'confirmada'].includes(notification.status)) {
      notification.status = 'pendente';
      notification.resolved_at = null;
      notification.confirmed_at = null;
    }
  }
}

// Chamado dentro de uma única leitura/gravação local. Não existe await entre as duas.
export function mutateLocalPayment(db, { id, receivableId, values, previous, reverse = false, justification }) {
  db.Payment ||= [];
  const existing = db.Payment.find((row) => row.id === id);
  if (existing && receivableId && existing.receivable_id !== receivableId) throw new Error('Identificador de pagamento já utilizado em outro recebível.');
  const targetId = existing?.receivable_id || receivableId;
  const receivable = (db.Receivable || []).find((row) => row.id === targetId && row.active !== false);
  if (targetId && !receivable) throw new Error('Recebível não encontrado.');
  if (!existing && !receivable) throw new Error('Selecione o recebível para registrar o pagamento.');
  if (existing?.active === false && reverse) return { payment: existing, receivable, idempotentReplay: true };
  if (existing && previous && Object.entries(previous).some(([key, value]) => JSON.stringify(existing[key]) !== JSON.stringify(value))) {
    throw new Error('O pagamento mudou em outro dispositivo. Atualize a tela antes de corrigir.');
  }
  if (existing?.active === false) {
    if (reverse) return { payment: existing, receivable };
    throw new Error('Um pagamento estornado não pode ser alterado.');
  }
  const editable = Object.fromEntries(paymentFields.filter((key) => values?.[key] !== undefined).map((key) => [key, values[key]]));
  const next = reverse ? { ...existing, active: false, status: 'estornado' } : validatePayment({ ...existing, ...editable });
  if (existing && !previous && !reverse) {
    if (paymentFields.some((key) => next[key] !== existing[key])) throw new Error('Identificador de pagamento já utilizado.');
    return { payment: existing, receivable, receiptNumber: existing.receipt_number, idempotentReplay: true };
  }
  if (receivable) {
    if (!reverse && receivable.status === 'cancelado') throw new Error('Não é possível receber uma cobrança cancelada.');
    const total = addMoney(subtractMoney(receivable.paid_value, existing?.paid_value || 0), reverse ? 0 : next.paid_value);
    if (total < 0 || toCents(total) > toCents(receivable.expected_value)) throw new Error('O pagamento excede o saldo ou o recebível está inconsistente.');
    Object.assign(receivable, { paid_value: total, status: total >= Number(receivable.expected_value) ? 'pago' : total > 0 || !reverse ? 'parcial' : 'pendente' });
    syncLocalRentNotifications(db, receivable);
  }
  if (existing) {
    next.change_history = [...(existing.change_history || []), {
      at: new Date().toISOString(), action: reverse ? 'estorno' : 'correcao',
      justification: justification || '', previous: paymentSnapshot(existing),
    }];
    Object.assign(existing, next, { updated_at: new Date().toISOString() });
  }
  else {
    const year = next.payment_date.slice(0, 4);
    const sequence = db.Payment.reduce((max, row) => {
      const match = String(row.receipt_number || '').match(new RegExp(`^${year}-(\\d+)$`));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1;
    Object.assign(next, { id, active: true, receivable_id: receivable.id, contract_id: receivable.contract_id,
      kitnet_id: receivable.kitnet_id, tenant_id: receivable.tenant_id, competence: receivable.competence,
      receipt_number: `${year}-${String(sequence).padStart(4, '0')}`, created_at: new Date().toISOString() });
    db.Payment.push(next);
  }
  return { payment: existing || next, receivable, receiptNumber: (existing || next).receipt_number };
}
