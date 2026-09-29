begin;
set local role authenticated;
set local request.jwt.claims='{"sub":"d5781e1e-91cd-41bb-8219-2f6875533731","role":"authenticated"}';
insert into public.records(id,entity,data) values
('wealth-test-asset','WealthAsset','{"id":"wealth-test-asset","name":"Bem teste","kind":"imovel","start_date":"2020-01-01"}'),
('wealth-test-value','WealthValuation','{"id":"wealth-test-value","asset_id":"wealth-test-asset","date":"2020-01-01","value":100000,"ownership_percent":50,"source":"Teste","reason":"Inicial"}');
do $$ declare failed boolean:=false; begin
  assert public.wealth_access();
  begin update public.records set data=data||'{"value":200000}' where id='wealth-test-value'; exception when raise_exception then failed:=true; end;
  assert failed,'Posição anterior foi alterada'; failed:=false;
  begin insert into public.records(id,entity,data) values('wealth-bad','WealthValuation','{"asset_id":"wealth-test-asset","date":"2020-01-01","value":-1,"ownership_percent":100,"source":"Teste","reason":"Inválido"}'); exception when raise_exception then failed:=true; end;
  assert failed,'Valor inválido aceito';
end $$;
set local request.jwt.claims='{"sub":"f3863393-651c-4594-b0a1-3ea70b077596","role":"authenticated"}';
do $$ declare failed boolean:=false; begin
  assert not public.wealth_access();
  assert not exists(select 1 from public.records where id='wealth-test-asset'),'Gestor leu patrimônio privado';
  begin insert into public.records(id,entity,data) values('wealth-denied','WealthAsset','{"name":"Privado","kind":"conta","start_date":"2020-01-01"}'); exception when insufficient_privilege then failed:=true; end;
  assert failed,'Gestor gravou patrimônio';
  assert not has_function_privilege('anon','public.wealth_access()','execute');
end $$;
rollback;
