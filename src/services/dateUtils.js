// Formatação de datas para exibição em pt-BR.
// Internamente o app guarda datas ISO ('2026-07-10') e competências 'YYYY-MM';
// estas funções convertem apenas na hora de MOSTRAR (telas, mensagens de
// WhatsApp, notificações) — nunca altere o formato armazenado.

/** '2026-07-10' -> '10/07/2026'. Valores vazios/não-ISO voltam como vieram. */
export const formatDateBR = (isoDate) => {
  const value = String(isoDate || '').slice(0, 10);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate || '';
  return `${match[3]}/${match[2]}/${match[1]}`;
};

/** '2026-07' -> '07/2026'. */
export const formatCompetenceBR = (competence) => {
  const match = String(competence || '').match(/^(\d{4})-(\d{2})/);
  if (!match) return competence || '';
  return `${match[2]}/${match[1]}`;
};

export default { formatDateBR, formatCompetenceBR };
