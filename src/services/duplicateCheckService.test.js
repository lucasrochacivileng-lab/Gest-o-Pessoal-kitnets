import { describe, expect, it } from 'vitest';
import {
  findAllDuplicates,
  findDuplicateExpenses,
  findDuplicatePersonalEntries,
  findExpenseDuplicateOf,
  findPersonalDuplicateOf,
} from './duplicateCheckService.js';

describe('duplicateCheckService', () => {
  it('detecta a mesma conta lançada duas vezes com descrição diferente (caso SPNET)', () => {
    const expenses = [
      { id: 'e1', date: '2026-07-10', description: 'Internet SPNET', category: 'internet', value: 129.9, kitnet_id: 'k1', active: true },
      { id: 'e2', date: '2026-07-10', description: 'SPNET energia kitnets', category: 'internet', value: 129.9, kitnet_id: 'k1', active: true },
    ];

    const groups = findDuplicateExpenses(expenses);

    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe('Mesmo valor, mesma kitnet e mesmo mês');
    expect(groups[0].items).toHaveLength(2);
  });

  it('detecta mesma descrição com valor digitado diferente', () => {
    const expenses = [
      { id: 'e1', date: '2026-07-10', description: 'Internet SPNET', value: 129.9, kitnet_id: 'k1', active: true },
      { id: 'e2', date: '2026-07-11', description: 'internet spnet', value: 130, kitnet_id: 'k1', active: true },
    ];

    const groups = findDuplicateExpenses(expenses);

    expect(groups).toHaveLength(1);
    expect(groups[0].reason).toBe('Mesma descrição no mesmo mês');
  });

  it('não aponta despesas legítimas de meses ou kitnets diferentes', () => {
    const expenses = [
      { id: 'e1', date: '2026-07-10', description: 'Internet SPNET', value: 129.9, kitnet_id: 'k1', active: true },
      { id: 'e2', date: '2026-08-10', description: 'Internet SPNET', value: 129.9, kitnet_id: 'k1', active: true },
      { id: 'e3', date: '2026-07-10', description: 'Internet SPNET', value: 129.9, kitnet_id: 'k2', active: true },
    ];

    expect(findDuplicateExpenses(expenses)).toHaveLength(0);
  });

  it('ignora registros inativos (já excluídos)', () => {
    const expenses = [
      { id: 'e1', date: '2026-07-10', description: 'Internet SPNET', value: 129.9, kitnet_id: 'k1', active: true },
      { id: 'e2', date: '2026-07-10', description: 'Internet SPNET', value: 129.9, kitnet_id: 'k1', active: false },
    ];

    expect(findDuplicateExpenses(expenses)).toHaveLength(0);
  });

  it('detecta duplicidade em lançamentos pessoais, exceto receitas', () => {
    const personal = [
      { id: 'pi1', date: '2026-07-05', category: 'mercado', value: 300, type: 'expense', active: true },
      { id: 'pi2', date: '2026-07-06', category: 'mercado', value: 300, type: 'expense', active: true },
      { id: 'pi3', date: '2026-07-07', category: 'salario', value: 300, type: 'income', active: true },
    ];

    const groups = findDuplicatePersonalEntries(personal);
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((item) => item.id)).toEqual(['pi1', 'pi2']);
  });

  it('combina os dois grupos com a origem marcada', () => {
    const expenses = [
      { id: 'e1', date: '2026-07-10', description: 'SPNET', value: 129.9, kitnet_id: 'k1', active: true },
      { id: 'e2', date: '2026-07-10', description: 'SPNET internet', value: 129.9, kitnet_id: 'k1', active: true },
    ];
    const personal = [
      { id: 'pi1', date: '2026-07-05', category: 'mercado', value: 300, type: 'expense', active: true },
      { id: 'pi2', date: '2026-07-06', category: 'mercado', value: 300, type: 'expense', active: true },
    ];

    const groups = findAllDuplicates({ expenses, personal });
    expect(groups.some((group) => group.origin === 'kitnets')).toBe(true);
    expect(groups.some((group) => group.origin === 'pessoal')).toBe(true);
  });

  describe('checagem no instante de salvar', () => {
    it('encontra conflito de despesa antes de gravar (caso SPNET)', () => {
      const existing = [
        { id: 'e1', date: '2026-07-10', description: 'Internet SPNET', value: 129.9, kitnet_id: 'k1', active: true },
      ];
      const candidate = { date: '2026-07-12', description: 'SPNET energia kitnets', value: 129.9, kitnet_id: 'k1' };

      const match = findExpenseDuplicateOf(candidate, existing);
      expect(match?.id).toBe('e1');
    });

    it('não aponta conflito quando é uma despesa realmente diferente', () => {
      const existing = [
        { id: 'e1', date: '2026-07-10', description: 'Internet SPNET', value: 129.9, kitnet_id: 'k1', active: true },
      ];
      const candidate = { date: '2026-07-12', description: 'Manutenção elétrica', value: 250, kitnet_id: 'k1' };

      expect(findExpenseDuplicateOf(candidate, existing)).toBeNull();
    });

    it('ignora despesas já excluídas ao checar conflito', () => {
      const existing = [
        { id: 'e1', date: '2026-07-10', description: 'Internet SPNET', value: 129.9, kitnet_id: 'k1', active: false },
      ];
      const candidate = { date: '2026-07-12', description: 'Internet SPNET', value: 129.9, kitnet_id: 'k1' };

      expect(findExpenseDuplicateOf(candidate, existing)).toBeNull();
    });

    it('encontra conflito em lançamento pessoal, mas nunca em receitas', () => {
      const existing = [
        { id: 'pi1', date: '2026-07-05', category: 'mercado', value: 300, type: 'expense', active: true },
      ];

      expect(findPersonalDuplicateOf({ date: '2026-07-06', category: 'mercado', value: 300, type: 'expense' }, existing)?.id).toBe('pi1');
      expect(findPersonalDuplicateOf({ date: '2026-07-06', category: 'mercado', value: 300, type: 'income' }, existing)).toBeNull();
    });
  });
});
