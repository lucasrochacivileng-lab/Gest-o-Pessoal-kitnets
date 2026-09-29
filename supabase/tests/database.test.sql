\set ON_ERROR_STOP on

-- Os três scripts abaixo usam ASSERT e falham imediatamente em qualquer
-- regressão. O teste TAP final confirma ao runner que todo o conjunto terminou.
\ir reproducible_baseline.sql
\ir financial_core_authenticated.sql
\ir 0015_anon_records_privileges.sql
\ir financial_operations.sql
\ir wealth_positions.sql

select plan(1);
select pass('baseline, RLS, auditoria e privilégios validados');
select * from finish();
