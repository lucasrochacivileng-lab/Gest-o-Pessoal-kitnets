// Motor de regras de classificação (inspirado no "rules engine" do Firefly III,
// numa versão enxuta): o usuário cria regras com um GATILHO (palavra na
// descrição + cartão opcional) e uma AÇÃO (definir a classificação/categoria e,
// opcionalmente, a origem/segmento). As regras rodam na importação de fatura e
// podem ser reaplicadas aos lançamentos já existentes.
//
// Este módulo é PURO (sem repositório/IO): recebe listas e devolve resultados,
// para ser fácil de testar e reaproveitar tanto na importação quanto na tela.

import { CARD_CATEGORY_OPTIONS } from './categoryCatalog.js';

export const CLASSIFICATION_RULE_ENTITY = 'ClassificationRule';

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .trim()
  .toLowerCase();

// Opções de classificação (categoria) — vêm do catálogo único de categorias
// (categoryCatalog.js), a mesma lista usada por Cartões e pelo seletor inline
// "Classificação" das Despesas. Reexportada aqui porque a tela de regras e o
// seletor já a consomem deste módulo.
export const CLASSIFICATION_OPTIONS = CARD_CATEGORY_OPTIONS;

// Origem (segmento) que uma regra pode opcionalmente aplicar. "" = não altera.
export const RULE_SEGMENT_OPTIONS = [
  { value: '', label: 'Não alterar a origem' },
  { value: 'kitnets', label: 'Kitnets' },
  { value: 'pericias', label: 'Perícias' },
  { value: 'projetos', label: 'Projetos' },
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'trabalho', label: 'Trabalho / Servidor' },
];

// Uma regra casa quando: está ativa, tem palavra-chave, a descrição da transação
// CONTÉM a palavra-chave (sem acento/caixa) e — se a regra restringe um cartão —
// o cartão bate.
export const ruleMatches = (rule, transaction) => {
  if (!rule || rule.enabled === false) return false;

  const keyword = normalize(rule.keyword);
  if (!keyword) return false;
  if (!normalize(transaction?.description).includes(keyword)) return false;

  if (rule.card_name && normalize(transaction?.card_name) !== normalize(rule.card_name)) {
    return false;
  }

  return true;
};

// Ordena por prioridade (menor primeiro); empate desempata por palavra-chave,
// só para a ordem ser estável/previsível.
export const sortRules = (rules = []) => [...rules].sort((a, b) => (
  (Number(a.priority ?? 0) - Number(b.priority ?? 0))
  || String(a.keyword || '').localeCompare(String(b.keyword || ''))
));

// Ações da PRIMEIRA regra que casa (por prioridade), ou null. Só devolve as
// ações efetivamente definidas na regra.
export const applyRules = (rules = [], transaction = {}) => {
  const match = sortRules(rules).find((rule) => ruleMatches(rule, transaction));
  if (!match) return null;

  const actions = {};
  if (match.category) actions.category = match.category;
  if (match.segment) actions.segment = match.segment;
  return Object.keys(actions).length ? actions : null;
};

// Planeja (sem gravar) os updates necessários para uma lista de lançamentos:
// só entra quem casa uma regra E cuja ação MUDA algo. Devolve
// [{ id, changes, description }] pronto para o chamador persistir.
export const planRuleUpdates = (rules = [], transactions = []) => transactions.reduce((acc, tx) => {
  const actions = applyRules(rules, tx);
  if (!actions) return acc;

  const changes = {};
  if (actions.category && actions.category !== tx.category) changes.category = actions.category;
  if (actions.segment && actions.segment !== tx.segment) changes.segment = actions.segment;

  if (Object.keys(changes).length) {
    acc.push({ id: tx.id, changes, description: tx.description });
  }
  return acc;
}, []);

export default {
  CLASSIFICATION_RULE_ENTITY,
  CLASSIFICATION_OPTIONS,
  RULE_SEGMENT_OPTIONS,
  ruleMatches,
  sortRules,
  applyRules,
  planRuleUpdates,
};
