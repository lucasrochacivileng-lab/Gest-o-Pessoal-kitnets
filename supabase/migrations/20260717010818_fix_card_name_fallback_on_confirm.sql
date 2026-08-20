-- O cadastro dos cartoes nao e uniforme: uns tem 'name', o Mercado Pago do pai
-- so tem 'card_name'. Lendo so 'name', a compra desse cartao era gravada SEM
-- card_name - ficava fora do saldo do cartao e nunca casava com a fatura.
create or replace function public.credit_card_display_name(p_card_id text)
returns text
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select coalesce(
    nullif(data ->> 'card_name', ''),
    nullif(data ->> 'name', ''),
    nullif(data ->> 'bank', '')
  )
  from public.records
  where id = p_card_id and entity = 'CreditCard' and active;
$function$;
