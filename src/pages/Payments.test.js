import { describe, expect, it } from 'vitest';
import { enrichPaymentRow } from './Payments.jsx';

describe('enrichPaymentRow', () => {
  it('preenche kitnet_id/tenant_id/competence de um pagamento legado via o recebivel vinculado', () => {
    const row = { id: 'p1', receivable_id: 'r1', paid_value: 800 };
    const relationOptions = {
      Receivable: [{ id: 'r1', kitnet_id: 'k1', tenant_id: 't1', competence: '2026-07' }],
    };

    const enriched = enrichPaymentRow(row, relationOptions);

    expect(enriched.kitnet_id).toBe('k1');
    expect(enriched.tenant_id).toBe('t1');
    expect(enriched.competence).toBe('2026-07');
  });

  it('nao mexe num pagamento que ja tem os proprios campos preenchidos', () => {
    const row = { id: 'p2', receivable_id: 'r1', kitnet_id: 'k2', tenant_id: 't2', competence: '2026-06' };
    const relationOptions = {
      Receivable: [{ id: 'r1', kitnet_id: 'k1', tenant_id: 't1', competence: '2026-07' }],
    };

    expect(enrichPaymentRow(row, relationOptions)).toEqual(row);
  });

  it('devolve a linha original quando nao ha recebivel vinculado (pagamento manual)', () => {
    const row = { id: 'p3', paid_value: 100 };
    expect(enrichPaymentRow(row, { Receivable: [] })).toEqual(row);
  });
});
