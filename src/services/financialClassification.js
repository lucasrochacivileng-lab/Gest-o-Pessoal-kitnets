export const SEGMENTS = [
  { key: 'kitnets', label: 'Kitnets' }, { key: 'projetos', label: 'Projetos' },
  { key: 'pericias', label: 'Perícias' }, { key: 'trabalho', label: 'Trabalho / Servidor' },
  { key: 'pessoal', label: 'Pessoal' },
];
const keys = new Set(SEGMENTS.map((row) => row.key));
export const resolveExpenseSegment = (row = {}, fallback = 'pessoal') => {
  if (keys.has(row.segment)) return row.segment;
  if (row.context === 'obra') return 'kitnets';
  return keys.has(row.context) ? row.context : fallback;
};
export const isConfirmed = (row) => row.active !== false && ['pago', 'recebido'].includes(row.status);
export const movementDate = (row) => String(row.paid_date || row.date || '').slice(0, 10);
