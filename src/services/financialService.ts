const money = (value = 0) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const financialService = {
  money,
  formatCurrency(value: number | string | null | undefined) {
    return money(Number(value || 0));
  },
};
