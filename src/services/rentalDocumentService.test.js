import { describe, expect, it } from 'vitest';
import {
  RENTAL_DOCUMENT_TYPES,
  documentsForContract,
  getRentalDocumentStatus,
  isPdfFile,
} from './rentalDocumentService.js';

describe('rentalDocumentService', () => {
  it('mantém os anexos separados por contrato para preservar o histórico', () => {
    const documents = [
      { id: 'd1', contract_id: 'c1', type: RENTAL_DOCUMENT_TYPES.contract, active: true },
      { id: 'd2', contract_id: 'c2', type: RENTAL_DOCUMENT_TYPES.contract, active: true },
      { id: 'd3', contract_id: 'c1', type: RENTAL_DOCUMENT_TYPES.inspection, active: false },
    ];

    expect(documentsForContract(documents, 'c1').map((row) => row.id)).toEqual(['d1']);
    expect(documentsForContract(documents, 'c2').map((row) => row.id)).toEqual(['d2']);
  });

  it('aceita apenas arquivos PDF e exibe um estado amigável', () => {
    expect(isPdfFile({ name: 'contrato.PDF', type: '' })).toBe(true);
    expect(isPdfFile({ name: 'foto.jpg', type: 'image/jpeg' })).toBe(false);
    expect(getRentalDocumentStatus(null)).toBe('Nenhum arquivo anexado');
    expect(getRentalDocumentStatus({ file_name: 'contrato.pdf' })).toBe('contrato.pdf');
  });
});
