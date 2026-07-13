const normalizeMoneyInput = (value) => {
  if (typeof value === 'string') {
    return value.trim().replace(',', '.');
  }

  return value;
};

export const toCents = (value) => {
  const number = Number(normalizeMoneyInput(value) || 0);
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) : 0;
};

export const fromCents = (value) => Number((Number(value || 0) / 100).toFixed(2));

export const addMoney = (...values) => fromCents(values.reduce((sum, value) => sum + toCents(value), 0));

export const sumMoney = (values = []) => fromCents(values.reduce((sum, value) => sum + toCents(value), 0));

export const subtractMoney = (value, ...values) => {
  const cents = values.reduce((result, item) => result - toCents(item), toCents(value));
  return fromCents(cents);
};
