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

/**
 * 'Hoje' no fuso LOCAL (Brasil, UTC-3), não em UTC.
 * `new Date().toISOString()` usa o dia em UTC: entre 21h e meia-noite no
 * horário local, o UTC já virou o dia seguinte e um aluguel com vencimento
 * hoje passaria a comparar como atrasado ~3h antes da hora.
 */
export const todayLocalISO = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Competência do mês corrente ('2026-08') no fuso LOCAL, pelo mesmo motivo do
 * `todayLocalISO`. A janela de erro aqui é menor mas mais traiçoeira: só no
 * ÚLTIMO dia do mês, entre 21h e meia-noite, o UTC já virou o mês — e a tela
 * abre no mês seguinte, vazia, parecendo que os lançamentos sumiram.
 */
export const currentMonthLocal = (date = new Date()) => todayLocalISO(date).slice(0, 7);

export default { formatDateBR, formatCompetenceBR, todayLocalISO, currentMonthLocal };
