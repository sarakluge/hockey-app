begin;
-- Keep existing migrations and user preferences intact for already-installed projects.
-- Only push deliveries are created from now on, regardless of former email settings.
create or replace function private.queue_external_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare request boolean;
begin
  select exists(select 1 from public.replacement_invitations i
    where i.search_id=new.search_id and i.family_id=new.family_id and i.response='pending') into request;
  insert into public.notification_deliveries(notification_id,user_id,channel,subscription_id,is_request)
    select new.id,p.id,'push',s.id,request from public.profiles p
    join public.push_subscriptions s on s.team_id=p.team_id and s.user_id=p.id
    where p.team_id=new.team_id and p.family_id=new.family_id and p.approved;
  return new;
end;
$$;
-- Retire pending email jobs; do not remove delivery history or existing preferences.
update public.notification_deliveries set state='skipped',lease_id=null,last_error='Email delivery disabled'
where channel='email' and state in ('queued','sending');
commit;
