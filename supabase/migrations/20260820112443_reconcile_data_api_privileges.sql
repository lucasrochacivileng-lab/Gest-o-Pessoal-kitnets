-- A exposição automática de novos objetos ao Data API deixou de ser uma
-- premissa segura. Concede somente os privilégios usados pela aplicação e
-- mantém anon sem acesso ao núcleo operacional.

grant usage on schema public to authenticated, service_role;
grant usage on type public.app_role to authenticated, service_role;

revoke all on table public.records, public.profiles, public.notifications,
  public.transactions, public.audit_log from anon;

grant select, insert, update, delete on table public.records to authenticated;
grant select on table public.profiles to authenticated;
grant update (name, avatar_url) on table public.profiles to authenticated;
grant select, insert, update on table public.notifications to authenticated;
grant select, insert, update on table public.transactions to authenticated;
grant select on table public.audit_log to authenticated;

grant all on table public.records, public.profiles, public.notifications,
  public.transactions, public.audit_log to service_role;

revoke execute on function public.card_invoice_due_date(text, date) from public, anon;
revoke execute on function public.credit_card_display_name(text) from public, anon;
grant execute on function public.card_invoice_due_date(text, date) to authenticated;
grant execute on function public.credit_card_display_name(text) to authenticated;
