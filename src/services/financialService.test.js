import { describe, expect, it } from 'vitest';
import { financialService } from './financialService';

describe('financialService.netPaymentValue', () => {
  it('usa net_value quando presente, mesmo que seja zero de propósito', () => {
    expect(financialService.netPaymentValue({ net_value: 0, paid_value: 800 })).toBe(0);
    expect(financialService.netPaymentValue({ net_value: 780, paid_value: 800 })).toBe(780);
  });

  it('cai no paid_value quando net_value não foi informado (pagamento manual sem desconto/multa)', () => {
    expect(financialService.netPaymentValue({ paid_value: 800 })).toBe(800);
    expect(financialService.netPaymentValue({ net_value: null, paid_value: 800 })).toBe(800);
  });

  it('retorna 0 quando nada foi informado', () => {
    expect(financialService.netPaymentValue({})).toBe(0);
  });
});
