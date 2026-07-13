import { describe, expect, it } from 'vitest';
import { addMoney, fromCents, subtractMoney, toCents } from './money.js';

describe('money', () => {
  it('calcula valores em centavos sem acumular imprecisao binaria', () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(subtractMoney(10, 0.1, 0.2)).toBe(9.7);
  });

  it('normaliza entrada decimal brasileira e arredonda para centavos', () => {
    expect(toCents('12,345')).toBe(1235);
    expect(fromCents(1235)).toBe(12.35);
  });

  it('trata valores ausentes ou invalidos como zero', () => {
    expect(toCents(undefined)).toBe(0);
    expect(toCents('invalido')).toBe(0);
  });
});
