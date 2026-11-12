begin;

create table public.notification_preferences (
  team_id uuid not null,
  user_id uuid not null,
  email_enabled boolean not null default true,
  primary key(team_id,user_id),
  foreign key(team_id,user_id) references public.profiles(team_id,id) on delete cascade
);
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  user_id uuid not null,
  endpoint text not null check (
    length(endpoint) < 4096 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify.windows.com)/'
  ),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}$'),
  unique(team_id,user_id,endpoint),
  foreign key(team_id,user_id) references public.profiles(team_id,id) on delete cascade
);
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.replacement_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email','push')),
  subscription_id uuid references public.push_subscriptions(id) on delete cascade,
  is_request boolean not null,
  state text not null default 'queued' check(state in ('queued','sending','sent','skipped','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_id uuid,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check ((channel='push') = (subscription_id is not null))
);
create unique index notification_email_once on public.notification_deliveries(notification_id,user_id) where channel='email';
create unique index notification_push_once on public.notification_deliveries(notification_id,subscription_id) where channel='push';
create index notification_dispatch_queue on public.notification_deliveries(available_at) where state in ('queued','sending');

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;
create policy own_notification_preferences on public.notification_preferences for all to authenticated
  using(user_id=auth.uid() and public.is_approved(team_id))
  with check(user_id=auth.uid() and public.is_approved(team_id));
create policy own_push_subscriptions on public.push_subscriptions for all to authenticated
  using(user_id=auth.uid() and public.is_approved(team_id))
  with check(user_id=auth.uid() and public.is_approved(team_id));
revoke all on public.notification_preferences,public.push_subscriptions,public.notification_deliveries from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.notification_preferences,public.push_subscriptions to authenticated;

create function private.queue_external_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare request boolean;
begin
  select exists(select 1 from public.replacement_invitations i
    where i.search_id=new.search_id and i.family_id=new.family_id and i.response='pending') into request;
  insert into public.notification_deliveries(notification_id,user_id,channel,is_request)
    select new.id,p.id,'email',request from public.profiles p
    left join public.notification_preferences pref on pref.team_id=p.team_id and pref.user_id=p.id
    where p.team_id=new.team_id and p.family_id=new.family_id and p.approved and coalesce(pref.email_enabled,true);
  insert into public.notification_deliveries(notification_id,user_id,channel,subscription_id,is_request)
    select new.id,p.id,'push',s.id,request from public.profiles p join public.push_subscriptions s on s.team_id=p.team_id and s.user_id=p.id
    where p.team_id=new.team_id and p.family_id=new.family_id and p.approved;
  return new;
end;
$$;
create trigger queue_external_notification after insert on public.replacement_notifications
for each row execute function private.queue_external_notification();

-- Service-only RPC: current membership, consent and invitation state are checked again
-- at delivery time. A lease makes overlapping cron invocations safe.
create function public.claim_notification_deliveries(p_channels text[])
returns setof jsonb language plpgsql security definer set search_path='' as $$
declare d public.notification_deliveries; n public.replacement_notifications;
  s public.replacement_searches; m public.matches; p public.profiles;
  sub public.push_subscriptions; email_ok boolean;
begin
  update public.notification_deliveries set state='failed',lease_id=null,last_error='Delivery lease expired'
    where state='sending' and attempts>=6 and available_at<=now();
  for d in select * from public.notification_deliveries
    where state in ('queued','sending') and available_at<=now() and attempts<6
      and channel=any(p_channels)
    order by available_at,id limit 10 for update skip locked
  loop
    select * into n from public.replacement_notifications where id=d.notification_id;
    select * into s from public.replacement_searches where id=n.search_id;
    select * into m from public.matches where team_id=n.team_id and id=s.match_id;
    select * into p from public.profiles where team_id=n.team_id and id=d.user_id;
    select coalesce((select email_enabled from public.notification_preferences where team_id=n.team_id and user_id=d.user_id),true) into email_ok;
    select * into sub from public.push_subscriptions where id=d.subscription_id;
    if p.id is null or not p.approved or p.family_id is distinct from n.family_id
      or (d.channel='email' and (not email_ok or p.email=''))
      or (d.channel='push' and sub.id is null)
      or (d.is_request and (s.status<>'searching' or s.deadline<=now()
        or m.status in ('finished','cancelled') or m.starts_at<=now()
        or not exists(select 1 from public.replacement_invitations i where i.search_id=s.id and i.family_id=n.family_id and i.response='pending')))
      or d.created_at < now()-interval '23 hours'
    then
      update public.notification_deliveries set state='skipped',lease_id=null where id=d.id;
      continue;
    end if;
    update public.notification_deliveries set state='sending', attempts=attempts+1,
      lease_id=gen_random_uuid(),available_at=now()+interval '5 minutes'
      where id=d.id returning * into d;
    return next jsonb_build_object('id',d.id,'lease_id',d.lease_id,'channel',d.channel,
      'email',p.email,'subscription',case when d.channel='push' then jsonb_build_object('endpoint',sub.endpoint,'keys',jsonb_build_object('p256dh',sub.p256dh,'auth',sub.auth)) else null end,
      'search_id',s.id,'message',n.message,'role',s.role,'away_team',m.away_team,
      'starts_at',m.starts_at,'deadline',case when d.is_request then s.deadline else null end,
      'is_request',d.is_request);
  end loop;
end;
$$;

create function public.finish_notification_delivery(p_id uuid,p_lease_id uuid,p_result text,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
declare d public.notification_deliveries;
begin
  if p_result not in ('sent','retry','expired','skipped') then raise exception 'Invalid delivery result'; end if;
  select * into d from public.notification_deliveries where id=p_id and lease_id=p_lease_id and state='sending' for update;
  if d.id is null then return; end if;
  update public.notification_deliveries set
    state=case when p_result='sent' then 'sent' when p_result in ('expired','skipped') then 'skipped' when attempts>=6 then 'failed' else 'queued' end,
    sent_at=case when p_result='sent' then now() else null end,
    available_at=now()+make_interval(secs=>least(3600,30*power(2,d.attempts)::integer)),
    last_error=left(p_error,100),lease_id=null where id=d.id;
  if p_result='expired' and d.channel='push' then
    delete from public.push_subscriptions where id=d.subscription_id;
  end if;
end;
$$;
revoke all on function private.queue_external_notification(),public.claim_notification_deliveries(text[]),public.finish_notification_delivery(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.claim_notification_deliveries(text[]),public.finish_notification_delivery(uuid,uuid,text,text) to service_role;
commit;
