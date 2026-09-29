-- Executar apenas em banco de teste. Todo o cenário é descartado ao final.
begin;
set local role authenticated;
set local request.jwt.claims='{"sub":"d5781e1e-91cd-41bb-8219-2f6875533731","role":"authenticated"}';
insert into public.records(id,entity,data) values
('ops-kit','Kitnet','{"id":"ops-kit","status":"ocupada"}'),
('ops-tenant','Tenant','{"id":"ops-tenant","status":"ativo"}'),
('ops-contract','Contract','{"id":"ops-contract","status":"ativo","kitnet_id":"ops-kit","tenant_id":"ops-tenant","start_date":"2099-01-01","end_date":"2099-12-31","rent_value":1000,"fine_months":3}'),
('ops-r1','Receivable','{"id":"ops-r1","contract_id":"ops-contract","competence":"2099-09","due_date":"2099-09-10","expected_value":1000,"paid_value":0,"status":"pendente"}'),
('ops-r2','Receivable','{"id":"ops-r2","contract_id":"ops-contract","competence":"2099-10","expected_value":1000,"paid_value":0,"status":"pendente"}'),
('ops-alert','Notification','{"id":"ops-alert","entity":"Receivable","entity_id":"ops-r1","type":"rent_due","status":"erro"}');

do $$
declare result jsonb; original jsonb; failed boolean:=false;
begin
  result:=public.register_receivable_payment('ops-r1','ops-p1','{"paid_value":1000,"discount":100,"payment_date":"2099-09-10"}');
  assert (select data->>'status' from public.records where id='ops-r1')='pago';
  assert (select data->>'status' from public.records where id='ops-alert')='resolvida','Pagamento não encerrou alerta com erro';
  update public.records set data=data || '{"status":"pendente"}' where id='ops-alert';
  assert (select data->>'status' from public.records where id='ops-alert')='resolvida','Tela desatualizada reabriu aluguel quitado';
  begin
    update public.records set entity='Income' where id='ops-p1';
  exception when raise_exception then failed:=true;
  end;
  assert failed,'Pagamento trocou de entidade sem recompor saldo';
  failed:=false;
  result:=public.register_receivable_payment('ops-r1','ops-p1','{"paid_value":1000,"discount":100,"payment_date":"2099-09-10"}');
  assert (result->>'idempotent_replay')::boolean,'Retry de quitação integral falhou';
  original:=(select data from public.records where id='ops-p1');
  result:=public.amend_receivable_payment('ops-p1','{"paid_value":600,"discount":50}',original,false,'Corrigir valor digitado');
  assert (result#>>'{payment,net_value}')::numeric=550,'Líquido não foi recalculado';
  assert (select data->>'paid_value' from public.records where id='ops-r1')::numeric=600;
  assert (select data->>'status' from public.records where id='ops-alert')='pendente','Correção não reabriu alerta';
  begin
    perform public.amend_receivable_payment('ops-p1','{"paid_value":500}',original,false,'Edição desatualizada');
  exception when raise_exception then failed:=true;
  end;
  assert failed,'Edição concorrente não foi bloqueada';
  original:=(select data from public.records where id='ops-p1'); failed:=false;
  begin
    perform public.amend_receivable_payment('ops-p1','{"paid_value":1001}',original,false,'Acima do saldo');
  exception when raise_exception then failed:=true;
  end;
  assert failed;
  assert (select data->>'paid_value' from public.records where id='ops-r1')::numeric=600,'Falha não fez rollback';
  result:=public.amend_receivable_payment('ops-p1','{}',original,true,'Estorno teste');
  assert (select data->>'paid_value' from public.records where id='ops-r1')::numeric=0;
  assert not (select active from public.records where id='ops-p1');
  perform public.amend_receivable_payment('ops-p1','{}',original,true,'Retry do estorno');
  assert (select data->>'paid_value' from public.records where id='ops-r1')::numeric=0;
end;
$$;

-- Força falha no último passo financeiro da rescisão e verifica rollback completo.
insert into public.records(id,entity,data) values('ops-conflicting-fine','Receivable',
  '{"id":"ops-conflicting-fine","contract_id":"ops-contract","competence":"2099-09","type":"multa_quebra","expected_value":500,"status":"pendente"}');
do $$
declare failed boolean:=false; result jsonb;
begin
  begin
    perform public.terminate_rental_contract('ops-contract','2099-09-25',true);
  exception when unique_violation then failed:=true;
  end;
  assert failed,'Falha de multa não foi exercitada';
  assert (select data->>'status' from public.records where id='ops-contract')='ativo';
  assert (select active from public.records where id='ops-r2'),'Rescisão parcial cancelou cobranças';
  assert (select data->>'status' from public.records where id='ops-kit')='ocupada';
  update public.records set active=false where id='ops-conflicting-fine';
  result:=public.terminate_rental_contract('ops-contract','2099-09-25',true);
  assert result->'fineReceivable'->>'type'='multa_quebra';
  assert (select active from public.records where id='ops-r1'),'Aluguel do mês desapareceu';
  assert (select data->>'status' from public.records where id='ops-contract')='encerrado';
  assert not (select active from public.records where id='ops-r2');
  assert (select data->>'status' from public.records where id='ops-kit')='vaga';
  assert public.terminate_rental_contract('ops-contract','2099-09-25',true)=result,'Retry da rescisão criou multa nova';
end;
$$;

insert into public.records(id,entity,data)
select 'ops-volume-'||i,'Kitnet',jsonb_build_object('id','ops-volume-'||i,'name','Teste de paginação') from generate_series(1,1201) i;
do $$
declare backup jsonb; broken jsonb; failed boolean:=false; before_count integer;
begin
  backup:=public.export_application_backup();
  select count(*) into before_count from public.records;
  assert jsonb_array_length(backup#>'{database,records}')=before_count and before_count>1200,'Snapshot truncado';
  broken:=jsonb_set(backup,'{database,transactions}','[{"id":"00000000-0000-0000-0000-000000000001"}]');
  begin
    perform public.restore_application_backup(broken,backup->>'revision');
  exception when not_null_violation then failed:=true;
  end;
  assert failed,'Falha de restauração não foi exercitada';
  assert (select count(*) from public.records)=before_count,'Restauração inválida perdeu dados';
  assert public.restore_application_backup(backup,backup->>'revision')->>'restored'='true','Restauração válida falhou';
  backup:=public.export_application_backup();
  update public.records set data=data || '{"name":"Alterado por outro dispositivo"}' where id='ops-kit';
  failed:=false;
  begin
    perform public.restore_application_backup(backup,backup->>'revision');
  exception when raise_exception then failed:=true;
  end;
  assert failed,'Restauração sobrescreveu alteração concorrente';
  assert (select data->>'name' from public.records where id='ops-kit')='Alterado por outro dispositivo';
end;
$$;

set local request.jwt.claims='{"sub":"f3863393-651c-4594-b0a1-3ea70b077596","role":"authenticated"}';
do $$
declare failed boolean:=false;
begin
  begin perform public.export_application_backup(); exception when raise_exception then failed:=true; end;
  assert failed,'Gestor acessou backup administrativo';
  assert not has_function_privilege('anon','public.restore_application_backup(jsonb,text)','execute');
  assert not has_function_privilege('anon','public.amend_receivable_payment(text,jsonb,jsonb,boolean,text)','execute');
end;
$$;
rollback;
