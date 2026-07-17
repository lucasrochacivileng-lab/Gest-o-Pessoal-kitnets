import { repository } from '../repository/index.js';
import { isSupabaseEnabled, supabase } from './supabaseClient.js';

const DOCUMENTS_BUCKET = 'documents';
const MAX_PDF_SIZE = 50 * 1024 * 1024;

export const RENTAL_DOCUMENT_TYPES = {
  contract: 'contrato_pdf',
  inspection: 'termo_vistoria_pdf',
  keys: 'termo_recebimento_chaves_pdf',
  tenant: 'documento_locatario_pdf',
};

export const RENTAL_DOCUMENT_LABELS = {
  [RENTAL_DOCUMENT_TYPES.contract]: 'Contrato de locação',
  [RENTAL_DOCUMENT_TYPES.inspection]: 'Termo de vistoria',
  [RENTAL_DOCUMENT_TYPES.keys]: 'Termo de recebimento de chaves',
  [RENTAL_DOCUMENT_TYPES.tenant]: 'Documento do locatário',
};

export const isPdfFile = (file) => Boolean(
  file && (file.type === 'application/pdf' || String(file.name || '').toLowerCase().endsWith('.pdf')),
);

export const hasRentalDocumentFile = (document) => Boolean(
  document && (document.file_data || document.file_url || document.file_path),
);

export const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export const dataUrlToBlob = (dataUrl) => {
  const [metadata, base64] = String(dataUrl || '').split(',');
  const mimeType = metadata?.match(/data:(.*);base64/)?.[1] || 'application/pdf';
  const binary = window.atob(base64 || '');
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
};

export const openRentalDocument = async (document) => {
  if (!hasRentalDocumentFile(document)) throw new Error('Nenhum arquivo foi anexado a este documento.');

  if (document.file_data) {
    const url = URL.createObjectURL(dataUrlToBlob(document.file_data));
    const opened = window.open(url, '_blank');
    if (opened) opened.focus();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  if (document.file_path && isSupabaseEnabled && supabase) {
    const opened = window.open('about:blank', '_blank');
    if (opened) opened.opener = null;
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(document.file_path, 10 * 60);
    if (error || !data?.signedUrl) {
      if (opened) opened.close();
      throw new Error('Não foi possível abrir o PDF. Tente novamente.');
    }
    if (opened) opened.location.href = data.signedUrl;
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  if (document.file_url) window.open(document.file_url, '_blank', 'noopener,noreferrer');
};

export const getRentalDocumentStatus = (document) => (
  hasRentalDocumentFile(document) ? (document.file_name || 'PDF anexado') : 'Pendente de anexo'
);

export const documentsForContract = (documents, contractId) => (
  (documents || []).filter((document) => document.contract_id === contractId && document.active !== false)
);

export const upsertRentalDocument = async ({ documents = [], file, type, kitnet, contract, tenant, source = 'Locações' }) => {
  if (!file) return null;
  if (!isPdfFile(file)) throw new Error('Envie apenas arquivos PDF.');
  if (Number(file.size || 0) > MAX_PDF_SIZE) throw new Error('O PDF deve ter no máximo 50 MB.');
  if (!contract?.id) throw new Error('Salve o contrato antes de anexar documentos.');

  const existing = documents.find((document) => (
    document.contract_id === contract.id
    && document.type === type
    && document.active !== false
  ));
  const label = RENTAL_DOCUMENT_LABELS[type] || 'Documento';
  const filePath = `rentals/${contract.id}/${type}.pdf`;
  let fileData = null;

  if (isSupabaseEnabled && supabase) {
    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, file, { contentType: 'application/pdf', upsert: true });
    if (error) throw new Error(`Não foi possível enviar o PDF: ${error.message}`);
  } else {
    fileData = await readFileAsDataUrl(file);
  }

  const payload = {
    title: `${label} - ${kitnet?.name || tenant?.name || contract.id}`,
    type,
    file_name: file.name,
    file_type: file.type || 'application/pdf',
    file_data: fileData,
    file_path: isSupabaseEnabled ? filePath : '',
    file_url: '',
    kitnet_id: kitnet?.id || contract.kitnet_id || '',
    tenant_id: tenant?.id || contract.tenant_id || '',
    contract_id: contract.id,
    uploaded_at: new Date().toISOString(),
    notes: `${label} anexado pela tela de ${source}`,
    active: true,
  };

  return existing
    ? repository.update('Document', existing.id, payload)
    : repository.create('Document', payload);
};

export default {
  documentsForContract,
  getRentalDocumentStatus,
  openRentalDocument,
  upsertRentalDocument,
};
