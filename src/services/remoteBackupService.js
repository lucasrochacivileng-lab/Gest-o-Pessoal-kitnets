import { supabase } from './supabaseClient.js';
import { validateRecordBackup } from './backupValidation.js';

const fail = (error) => { if (error) throw new Error(`Não foi possível concluir o backup: ${error.message}`); };
const toBase64 = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
};

export function normalizeRemoteBackup(value) {
  if (value?.format === 'kitmanager-backup') {
    if (value.version !== 2 || !Array.isArray(value.database?.records) || !Array.isArray(value.files)
      || !Array.isArray(value.database?.transactions) || !Array.isArray(value.database?.notifications)) throw new Error('Versão ou estrutura de backup inválida.');
    const entities = Object.create(null);
    for (const row of value.database.records) {
      if (!row || typeof row.entity !== 'string' || !row.data || row.id !== row.data.id || typeof row.active !== 'boolean') throw new Error('Registro inválido no backup.');
      (entities[row.entity] ||= []).push({ ...row.data, id: row.id, active: row.active });
    }
    if (value.database.records.length) validateRecordBackup(entities);
    return structuredClone(value);
  }
  validateRecordBackup(value);
  return { format: 'kitmanager-backup', version: 2, legacy: true, database: {
    records: Object.entries(value).flatMap(([entity, rows]) => rows.map((data) => ({ id: data.id, entity, active: data.active !== false, data }))),
    notifications: [], transactions: [],
  }, files: [] };
}

export async function exportRemoteBackup() {
  // Um único snapshot no PostgreSQL, sem o limite de linhas de SELECT do PostgREST.
  const { data, error } = await supabase.rpc('export_application_backup');
  fail(error);
  const backup = normalizeRemoteBackup({ ...data, files: [] });
  const paths = [...new Set(backup.database.records.filter((row) => row.entity === 'Document').map((row) => row.data.file_path).filter(Boolean))];
  for (const path of paths) {
    const result = await supabase.storage.from('documents').download(path);
    fail(result.error);
    backup.files.push({ path, content_type: result.data.type || 'application/pdf', base64: await toBase64(result.data) });
  }
  backup.scope = 'Registros, caixa de entrada financeira e PDFs referenciados. Não inclui usuários, senhas, preferências do navegador ou histórico de auditoria.';
  return backup;
}

export async function importRemoteBackup(value, { expectedRevision } = {}) {
  const backup = normalizeRemoteBackup(value);
  if (!expectedRevision) throw new Error('Exporte uma cópia de segurança atual antes de restaurar.');
  const required = new Set(backup.database.records.filter((row) => row.entity === 'Document').map((row) => row.data.file_path).filter(Boolean));
  const files = new Map();
  // Valida e decodifica tudo antes do primeiro upload ou escrita no banco.
  for (const file of backup.files) {
    if (!required.has(file.path) || files.has(file.path) || typeof file.base64 !== 'string') throw new Error('Anexo inválido ou duplicado no backup.');
    try { files.set(file.path, { file, bytes: Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0)) }); }
    catch { throw new Error('Anexo inválido no backup.'); }
  }
  if (!backup.legacy && [...required].some((path) => !files.has(path))) throw new Error('O backup está incompleto: faltam PDFs.');
  try {
    for (const [oldPath, { file, bytes }] of files) {
      const path = `restored/${crypto.randomUUID()}.pdf`;
      const result = await supabase.storage.from('documents').upload(path, bytes, { contentType: file.content_type || 'application/pdf', upsert: false });
      fail(result.error);
      backup.database.records.forEach((row) => {
        if (row.entity === 'Document' && row.data.file_path === oldPath) row.data.file_path = path;
      });
    }
    backup.files = []; // Os anexos já estão no Storage; a transação recebe apenas os registros.
    const { data, error } = await supabase.rpc('restore_application_backup', { p_backup: backup, p_expected_revision: expectedRevision });
    // Uma falha de rede pode ocorrer depois do COMMIT. Não removemos os PDFs
    // enviados: eles podem já estar vinculados à restauração confirmada no servidor.
    fail(error);
    if (!data?.restored) throw new Error('Resposta de restauração não confirmada. Recarregue e confira os dados.');
    return data;
  } catch (error) {
    throw new Error(`${error.message} Nenhum arquivo anterior foi sobrescrito. Confira o estado atual antes de repetir.`);
  }
}
