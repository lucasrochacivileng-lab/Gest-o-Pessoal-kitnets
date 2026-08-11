import { describe, expect, it } from 'vitest';
import { addMoney, fromCents, parseMoneyInput, subtractMoney, toCents } from './money.js';

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

  // A versao anterior fazia replace(',', '.'), que troca so a PRIMEIRA
  // virgula: '1.234,56' virava '1.234.56', dava NaN e era convertido em ZERO
  // em silencio. Qualquer valor com separador de milhar sumia do lancamento.
  it('entende separador de milhar sem zerar o valor', () => {
    expect(parseMoneyInput('1.234,56')).toBe(1234.56);
    expect(parseMoneyInput('1.234.567,89')).toBe(1234567.89);
    expect(parseMoneyInput('1,234.56')).toBe(1234.56);
    expect(toCents('1.234,56')).toBe(123456);
    expect(toCents('1.234.567,89')).toBe(123456789);
  });

  it('preserva o sinal negativo', () => {
    expect(parseMoneyInput('-1.234,56')).toBe(-1234.56);
    expect(parseMoneyInput(-42)).toBe(-42);
    expect(toCents('-10,50')).toBe(-1050);
  });

  it('aceita numero, texto simples e lixo em volta do valor', () => {
    expect(parseMoneyInput(1234.56)).toBe(1234.56);
    expect(parseMoneyInput('1234.56')).toBe(1234.56);
    expect(parseMoneyInput('R$ 1.234,56')).toBe(1234.56);
    expect(parseMoneyInput('')).toBe(0);
    expect(parseMoneyInput(null)).toBe(0);
    expect(parseMoneyInput(undefined)).toBe(0);
    expect(parseMoneyInput(NaN)).toBe(0);
    expect(parseMoneyInput('abc')).toBe(0);
  });
});
