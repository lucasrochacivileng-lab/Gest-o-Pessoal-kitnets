import { describe, it, expect } from 'vitest';
import {
  ruleMatches,
  sortRules,
  applyRules,
  planRuleUpdates,
} from './classificationRuleService.js';

const rule = (over = {}) => ({ keyword: 'amazon', category: 'assinatura', enabled: true, priority: 0, ...over });

describe('ruleMatches', () => {
  it('casa por trecho da descrição, sem acento e sem caixa', () => {
    expect(ruleMatches(rule({ keyword: 'AMAZÔN' }), { description: 'Compra amazon br sao paulo' })).toBe(true);
  });

  it('não casa quando a descrição não contém a palavra-chave', () => {
    expect(ruleMatches(rule(), { description: 'Posto Shell' })).toBe(false);
  });

  it('ignora regra desativada ou sem palavra-chave', () => {
    expect(ruleMatches(rule({ enabled: false }), { description: 'amazon' })).toBe(false);
    expect(ruleMatches(rule({ keyword: '' }), { description: 'amazon' })).toBe(false);
  });

  it('respeita o filtro opcional de cartão', () => {
    const r = rule({ card_name: 'Nubank' });
    expect(ruleMatches(r, { description: 'amazon', card_name: 'nubank' })).toBe(true);
    expect(ruleMatches(r, { description: 'amazon', card_name: 'Santander' })).toBe(false);
  });
});

describe('applyRules', () => {
  it('devolve as ações da primeira regra por prioridade', () => {
    const rules = [
      rule({ keyword: 'amazon', category: 'outros', priority: 10 }),
      rule({ keyword: 'amazon', category: 'assinatura', segment: 'pessoal', priority: 1 }),
    ];
    expect(applyRules(rules, { description: 'AMAZON PRIME' })).toEqual({ category: 'assinatura', segment: 'pessoal' });
  });

  it('devolve null quando nenhuma regra casa', () => {
    expect(applyRules([rule()], { description: 'Farmácia São João' })).toBeNull();
  });

  it('só inclui ações definidas (sem segment vazio)', () => {
    expect(applyRules([rule({ segment: '' })], { description: 'amazon' })).toEqual({ category: 'assinatura' });
  });
});

describe('sortRules', () => {
  it('ordena por prioridade crescente', () => {
    const out = sortRules([rule({ keyword: 'b', priority: 5 }), rule({ keyword: 'a', priority: 2 })]);
    expect(out.map((r) => r.keyword)).toEqual(['a', 'b']);
  });
});

describe('planRuleUpdates', () => {
  it('só planeja mudança quando a regra altera algo', () => {
    const rules = [rule({ keyword: 'amazon', category: 'mercado' })];
    const txs = [
      { id: '1', description: 'AMAZON BR', category: 'outros' }, // muda -> entra
      { id: '2', description: 'AMAZON US', category: 'mercado' }, // já correto -> fora
      { id: '3', description: 'Posto Shell', category: 'outros' }, // não casa -> fora
    ];
    expect(planRuleUpdates(rules, txs)).toEqual([
      { id: '1', changes: { category: 'mercado' }, description: 'AMAZON BR' },
    ]);
  });

  it('planeja também a troca de segmento', () => {
    const rules = [rule({ keyword: 'leroy', category: 'material de construcao', segment: 'kitnets' })];
    const txs = [{ id: '9', description: 'LEROY MERLIN', category: 'outros', segment: 'pessoal' }];
    expect(planRuleUpdates(rules, txs)).toEqual([
      { id: '9', changes: { category: 'material de construcao', segment: 'kitnets' }, description: 'LEROY MERLIN' },
    ]);
  });
});
