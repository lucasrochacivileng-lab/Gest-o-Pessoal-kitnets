-- Patrimônio pessoal não herda o acesso dos gestores de locações.
create policy records_wealth_admin_only on public.records as restrictive
for all to authenticated
using (entity not in ('WealthAsset','WealthValuation') or (select public.is_admin()))
with check (entity not in ('WealthAsset','WealthValuation') or (select public.is_admin()));

create function public.wealth_access() returns boolean language sql stable
security invoker set search_path=pg_catalog,public as $$ select public.is_admin(); $$;
revoke execute on function public.wealth_access() from public,anon;
grant execute on function public.wealth_access() to authenticated;

create function public.validate_wealth_record() returns trigger language plpgsql
security invoker set search_path=pg_catalog,public as $$
declare asset public.records%rowtype; amount numeric; share numeric; position_date date;
begin
  if current_setting('app.restore_scope',true)='restore' then return new; end if;
  if tg_op='UPDATE' and old.entity in ('WealthAsset','WealthValuation') then
    if new.entity<>old.entity then raise exception 'Não é possível mudar a entidade patrimonial.'; end if;
    if old.entity='WealthValuation' then raise exception 'Registre uma nova posição para corrigir, preservando o histórico.'; end if;
    if new.data->>'kind' is distinct from old.data->>'kind' or new.data->>'start_date' is distinct from old.data->>'start_date'
      or new.active is distinct from old.active then raise exception 'Tipo, início e histórico patrimonial devem ser preservados.'; end if;
  end if;
  if new.entity='WealthAsset' then
    if nullif(btrim(new.data->>'name'),'') is null or coalesce(new.data->>'kind','') not in ('imovel','investimento','conta','bem','divida')
      or coalesce(new.data->>'start_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Cadastro patrimonial inválido.'; end if;
    if (new.data->>'start_date')::date>current_date then raise exception 'A data de início não pode estar no futuro.'; end if;
  elsif new.entity='WealthValuation' then
    select * into asset from public.records where entity='WealthAsset' and active and id=new.data->>'asset_id';
    if not found then raise exception 'Bem ou dívida não encontrado.'; end if;
    if coalesce(new.data->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Data inválida.'; end if;
    position_date:=(new.data->>'date')::date;
    amount:=(new.data->>'value')::numeric; share:=(new.data->>'ownership_percent')::numeric;
    if position_date<(asset.data->>'start_date')::date or position_date>current_date
      or amount is null or amount<0 or amount>1e12 or amount::text in ('NaN','Infinity','-Infinity')
      or share is null or share<=0 or share>100 or share::text in ('NaN','Infinity','-Infinity')
      or nullif(btrim(new.data->>'source'),'') is null or nullif(btrim(new.data->>'reason'),'') is null
      then raise exception 'Posição inválida: confira data, valor, participação, fonte e motivo.'; end if;
    new.data:=new.data || jsonb_build_object('value',round(amount,2),'recorded_at',clock_timestamp());
  end if;
  return new;
end;
$$;
create trigger records_07_wealth_validation before insert or update on public.records
for each row execute function public.validate_wealth_record();
revoke execute on function public.validate_wealth_record() from public,anon,authenticated;
