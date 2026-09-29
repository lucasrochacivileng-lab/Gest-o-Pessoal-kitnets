// Backups antigos continuam legíveis, mas nunca recebem IDs novos silenciosamente.
export function validateRecordBackup(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) throw new Error('Backup inválido ou vazio.');
  const ids = new Set();
  for (const [entity, rows] of Object.entries(value)) {
    if (!Array.isArray(rows)) throw new Error(`Backup inválido: ${entity} precisa ser uma lista.`);
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) {
        throw new Error('Backup inválido: registros sem ID ou com ID duplicado.');
      }
      if (row.active !== undefined && typeof row.active !== 'boolean') throw new Error('Backup inválido: campo active deve ser booleano.');
      ids.add(row.id);
    }
  }
  return value;
}
