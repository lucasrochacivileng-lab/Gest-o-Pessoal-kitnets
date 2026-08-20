-- Em qual fatura uma compra cai, a partir do ciclo cadastrado no cartao.
-- Espelha src/services/cardCycleService.js (invoiceForPurchase): a compra entra
-- na PRIMEIRA fatura que fechar a partir dela; a fatura vence no mesmo mes do
-- fechamento quando o vencimento vem depois dele (Nubank: fecha 3, vence 10) e
-- no mes seguinte quando nao (Amazon: fecha 24, vence 10).
-- Devolve NULL quando o cartao nao tem fechamento/vencimento cadastrado - quem
-- chama decide o que fazer (hoje: mantem a data da compra).
create or replace function public.card_invoice_due_date(
  p_card_id text,
  p_purchase_date date
)
returns date
language plpgsql
stable
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_closing_day int;
  v_due_day int;
  v_closing_month date;
  v_due_month date;
  v_due_day_safe int;
begin
  if p_card_id is null or p_purchase_date is null then
    return null;
  end if;

  select nullif(data ->> 'closing_day', '')::int,
         nullif(data ->> 'due_day', '')::int
    into v_closing_day, v_due_day
  from public.records
  where id = p_card_id and entity = 'CreditCard' and active;

  if v_closing_day is null or v_due_day is null
     or v_closing_day not between 1 and 31
     or v_due_day not between 1 and 31 then
    return null;
  end if;

  -- Comprou ate o fechamento deste mes? Entra nesta virada; senao, na proxima.
  -- O least() com o ultimo dia do mes cobre fechamento 31 em fevereiro.
  if extract(day from p_purchase_date)::int <= least(
       v_closing_day,
       extract(day from (date_trunc('month', p_purchase_date) + interval '1 month - 1 day'))::int
     ) then
    v_closing_month := date_trunc('month', p_purchase_date)::date;
  else
    v_closing_month := (date_trunc('month', p_purchase_date) + interval '1 month')::date;
  end if;

  if v_due_day > v_closing_day then
    v_due_month := v_closing_month;
  else
    v_due_month := (v_closing_month + interval '1 month')::date;
  end if;

  v_due_day_safe := least(
    v_due_day,
    extract(day from (date_trunc('month', v_due_month) + interval '1 month - 1 day'))::int
  );

  return v_due_month + (v_due_day_safe - 1);
end;
$function$;
