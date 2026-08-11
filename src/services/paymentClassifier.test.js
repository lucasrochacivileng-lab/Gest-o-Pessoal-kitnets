import { describe, expect, it } from 'vitest';
import { hasRentLink, rentPaymentsOnly } from './paymentClassifier.js';

// Este filtro é o que separa "pagamento de aluguel" de qualquer outra linha
// que tenha ido parar na entidade Payment. Ele é aplicado em OITO pontos de
// agregação (dashboard, consolidado, fluxo de caixa, extrato, relatórios,
// conciliação de caixa, visão financeira e caixa de entrada de receitas), e é
// a única coisa que impede um lançamento sem vínculo — como o salário
// informado como saldo de abertura na carga inicial — de ser somado como
// receita das kitnets. Remover um dos cinco campos aceitos aqui muda o
// resultado do negócio sem quebrar mais nada.

describe('paymentClassifier', () => {
  it('aceita o pagamento quando QUALQUER vínculo de aluguel está presente', () => {
    expect(hasRentLink({ receivable_id: 'r1' })).toBe(true);
    expect(hasRentLink({ contract_id: 'c1' })).toBe(true);
    expect(hasRentLink({ kitnet_id: 'k1' })).toBe(true);
    expect(hasRentLink({ tenant_id: 't1' })).toBe(true);
    expect(hasRentLink({ competence: '2026-08' })).toBe(true);
  });

  it('rejeita lançamento sem nenhum vínculo de aluguel', () => {
    expect(hasRentLink({})).toBe(false);
    expect(hasRentLink()).toBe(false);
    // Carga inicial gravou salário e saldo residual na entidade Payment, com
    // os campos de vínculo presentes porém VAZIOS — string vazia não pode
    // passar por vínculo.
    expect(hasRentLink({
      paid_value: 9000,
      receivable_id: '',
      kitnet_id: '',
      tenant_id: '',
      notes: 'Salário de junho informado como parte do saldo atual.',
    })).toBe(false);
  });

  it('mantém o aluguel e descarta o salário órfão na mesma lista', () => {
    const salario = { id: 'p-salario', paid_value: 9000, kitnet_id: '', receivable_id: '' };
    const aluguel = { id: 'p-aluguel', paid_value: 950, receivable_id: 'r1' };

    const rents = rentPaymentsOnly([salario, aluguel]);

    expect(rents).toEqual([aluguel]);
    expect(rents.reduce((sum, row) => sum + row.paid_value, 0)).toBe(950);
  });

  it('não quebra com lista vazia ou ausente', () => {
    expect(rentPaymentsOnly([])).toEqual([]);
    expect(rentPaymentsOnly()).toEqual([]);
  });
});
