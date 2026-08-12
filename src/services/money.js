/**
 * Converte para número o dinheiro vindo de formulário, arquivo ou banco.
 *
 * Aceita número, '1234.56', '1.234,56' (brasileiro) e '1,234.56' (americano).
 * A regra: o ÚLTIMO separador é o decimal, todos os anteriores são de milhar.
 *
 * A versão anterior fazia `replace(',', '.')`, que troca só a PRIMEIRA vírgula:
 * '1.234,56' virava '1.234.56' e caía em NaN, e o NaN era silenciosamente
 * convertido em ZERO. Um valor com separador de milhar sumia sem erro nenhum.
 */
export const parseMoneyInput = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  const text = String(value ?? '').trim().replace(/[^\d,.-]/g, '');
  if (!text) return 0;

  const negative = text.startsWith('-');
  const digits = text.replace(/-/g, '');
  const lastSeparator = Math.max(digits.lastIndexOf(','), digits.lastIndexOf('.'));
  const normalized = lastSeparator === -1
    ? digits
    : `${digits.slice(0, lastSeparator).replace(/[.,]/g, '')}.${digits.slice(lastSeparator + 1).replace(/[.,]/g, '')}`;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
};

export const toCents = (value) => {
  const number = parseMoneyInput(value);
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) : 0;
};

export const fromCents = (value) => Number((Number(value || 0) / 100).toFixed(2));

export const addMoney = (...values) => fromCents(values.reduce((sum, value) => sum + toCents(value), 0));

export const sumMoney = (values = []) => fromCents(values.reduce((sum, value) => sum + toCents(value), 0));

export const subtractMoney = (value, ...values) => {
  const cents = values.reduce((result, item) => result - toCents(item), toCents(value));
  return fromCents(cents);
};
