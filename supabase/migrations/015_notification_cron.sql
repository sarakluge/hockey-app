begin;
create extension if not exists pg_net with schema extensions;
-- Vault secrets are configured separately; no credentials in migrations or client code.
create function private.dispatch_notification_queue() returns void
language plpgsql security definer set search_path='' as $$
declare endpoint text; token text;
begin
  if not exists(select 1 from public.notification_deliveries where state in ('queued','sending') and available_at<=now()) then return; end if;
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='notification_dispatch_url';
  select decrypted_secret into token from vault.decrypted_secrets where name='notification_dispatch_secret';
  if endpoint is null or token is null then return; end if;
  perform net.http_post(url:=endpoint,
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),
    body:='{}'::jsonb,timeout_milliseconds:=120000);
end;
$$;
revoke all on function private.dispatch_notification_queue() from public,anon,authenticated,service_role;
select cron.schedule('dispatch-replacement-notifications','* * * * *','select private.dispatch_notification_queue()');
commit;
