-- Correção pontual: preenche a forma de pagamento das despesas que hoje caem
-- no card "Outros" (por estarem sem payment_method definido).
--
-- Contexto: os cards Boleto / Pix / Outros na tela de Despesas classificam
-- pelo campo data->>'payment_method' (substring: "boleto" -> Boleto,
-- "pix" -> Pix, resto -> Outros). Despesas antigas ficaram sem esse campo.
--
-- Regras acordadas com o Lucas (2026-07-11):
--   * BOLETO = contas de consumo: água, energia, internet.
--   * PIX    = fornecedores da obra das kitnets: esquadrias, móveis.
--   * Energia SOLAR fica de fora: é paga nos cartões pessoais (card_transaction),
--     não é entity='Expense' — e o consolidado já a conta como investimento
--     das kitnets (ver segmentConsolidationService.js). Há ainda uma trava
--     explícita !~* 'solar' no UPDATE de boleto, por segurança.
--
-- Como usar: rodar no SQL Editor do Supabase. Idempotente — o filtro
-- !~* 'boleto|pix' garante que só mexe no que ainda está em "Outros".

-- 1) Diagnóstico ANTES — o que está em "Outros" hoje
SELECT data->>'description'      AS descricao,
       data->>'category'         AS categoria,
       count(*)                  AS qtd,
       sum((data->>'value')::numeric) AS total
FROM public.records
WHERE entity = 'Expense'
  AND active
  AND coalesce(data->>'payment_method','') !~* 'boleto|pix'
GROUP BY 1, 2
ORDER BY total DESC NULLS LAST;

-- 2) PIX: fornecedores da obra das kitnets (esquadrias, móveis)
UPDATE public.records
SET data = jsonb_set(data, '{payment_method}', '"pix"'),
    updated_at = now()
WHERE entity = 'Expense'
  AND active
  AND data->>'description' ~* 'esquadria|m[oó]vel|m[oó]veis'
  AND coalesce(data->>'payment_method','') !~* 'boleto|pix';

-- 3) BOLETO: contas de consumo (água, energia, internet)
UPDATE public.records
SET data = jsonb_set(data, '{payment_method}', '"boleto"'),
    updated_at = now()
WHERE entity = 'Expense'
  AND active
  AND data->>'description' ~* '[aá]gua|energia|internet'
  AND data->>'description' !~* 'solar'          -- trava contra "energia solar"
  AND coalesce(data->>'payment_method','') !~* 'boleto|pix';

-- 4) Conferência DEPOIS — deve dar ~ Pix 7.625, Boleto 2.057,96, Outros 0
SELECT
  CASE WHEN data->>'payment_method' ~* 'boleto' THEN 'Boleto'
       WHEN data->>'payment_method' ~* 'pix'    THEN 'Pix'
       ELSE 'Outros' END AS card,
  count(*) AS qtd,
  sum((data->>'value')::numeric) AS total
FROM public.records
WHERE entity = 'Expense' AND active
GROUP BY 1
ORDER BY 1;
