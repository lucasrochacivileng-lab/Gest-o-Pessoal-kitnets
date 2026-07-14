import { describe, expect, it } from 'vitest';
import { addMoney, fromCents, subtractMoney, sumMoney, toCents } from './money.js';

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

  it('mantem centavos, negativos, valores altos e saldo proximo de zero', () => {
    expect(sumMoney([0.01, 0.02, 0.03])).toBe(0.06);
    expect(addMoney(-10.01, 0.01)).toBe(-10);
    expect(subtractMoney(1000000000.99, 0.99)).toBe(1000000000);
    expect(subtractMoney(0.3, 0.1, 0.2)).toBe(0);
  });

  it('combina pagamento, desconto, multa e juros com arredondamento explicito', () => {
    expect(addMoney(subtractMoney(800.01, 10.02), 5.03, 1.04)).toBe(796.06);
  });
});
