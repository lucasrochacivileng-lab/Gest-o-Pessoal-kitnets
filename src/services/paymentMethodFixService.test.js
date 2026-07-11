import { describe, expect, it } from 'vitest';
import { classifyExpensePaymentMethod } from './paymentMethodFixService.js';

describe('classifyExpensePaymentMethod', () => {
  it('classifica moveis/esquadrias como pix', () => {
    expect(classifyExpensePaymentMethod({ description: 'Esquadrias de alumínio' })).toBe('pix');
    expect(classifyExpensePaymentMethod({ category: 'moveis', description: 'Sofá' })).toBe('pix');
    expect(classifyExpensePaymentMethod({ description: 'Móvel planejado' })).toBe('pix');
  });

  it('classifica agua/energia/luz/internet como boleto', () => {
    expect(classifyExpensePaymentMethod({ description: 'Conta de água' })).toBe('boleto');
    expect(classifyExpensePaymentMethod({ category: 'luz', description: 'Enel' })).toBe('boleto');
    expect(classifyExpensePaymentMethod({ description: 'Internet SPNET' })).toBe('boleto');
  });

  it('deixa energia solar de fora (é cartão, não despesa direta)', () => {
    expect(classifyExpensePaymentMethod({ description: 'Energia solar parcela 03' })).toBeNull();
  });

  it('nao classifica o que nao casa nenhuma regra', () => {
    expect(classifyExpensePaymentMethod({ description: 'Material de obra', category: 'material' })).toBeNull();
    expect(classifyExpensePaymentMethod({})).toBeNull();
  });
});
