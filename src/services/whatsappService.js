// Envio real de cobranças/lembretes via WhatsApp: gera links wa.me com a
// mensagem pré-preenchida. Não depende de servidor — abre a conversa no
// WhatsApp do dispositivo com o texto pronto para enviar.

/**
 * Normaliza telefone brasileiro para o formato internacional usado pelo wa.me.
 * Aceita "(64) 99999-8888", "64999998888", "+55 64 99999-8888" etc.
 * Retorna '' quando não há dígitos.
 */
export const normalizePhoneBR = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';

  // Já tem DDI 55 (12+ dígitos: 55 + DDD + número). Números locais têm 10-11
  // dígitos — mesmo um DDD 55 (região de Santa Maria-RS) recebe o prefixo.
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
};

/** Monta o link wa.me; retorna null se o telefone for vazio/inválido. */
export const buildWhatsAppLink = (phone, message) => {
  const normalized = normalizePhoneBR(phone);
  if (!normalized) return null;

  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${normalized}${text}`;
};

export default { normalizePhoneBR, buildWhatsAppLink };
