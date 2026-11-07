begin;

create table public.replacement_searches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  match_id text not null,
  role text not null references public.assignment_types(name),
  original_family_id uuid not null,
  replacement_family_id uuid,
  status text not null default 'searching' check (status in ('searching','found','exhausted','cancelled')),
  current_group integer not null default 0 check (current_group between 0 and 3),
  deadline timestamptz,
  created_at timestamptz not null default now(),
  foreign key (team_id, match_id) references public.matches(team_id,id),
  foreign key (team_id, original_family_id) references public.families(team_id,id) on delete cascade,
  foreign key (team_id, replacement_family_id) references public.families(team_id,id) on delete set null (replacement_family_id),
  unique (team_id,id)
);
create unique index one_active_replacement on public.replacement_searches(team_id,match_id,role) where status = 'searching';
create table public.replacement_invitations (
  team_id uuid not null,
  search_id uuid not null,
  family_id uuid not null,
  priority_group integer not null check (priority_group between 1 and 3),
  response text not null default 'queued' check (response in ('queued','pending','declined','accepted','closed')),
  invited_at timestamptz,
  responded_at timestamptz,
  primary key (search_id,family_id),
  foreign key (team_id,search_id) references public.replacement_searches(team_id,id) on delete cascade,
  foreign key (team_id,family_id) references public.families(team_id,id) on delete cascade
);
create table public.replacement_notifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  search_id uuid not null,
  family_id uuid not null,
  message text not null,
  created_at timestamptz not null default now(),
  foreign key (team_id,search_id) references public.replacement_searches(team_id,id) on delete cascade,
  foreign key (team_id,family_id) references public.families(team_id,id) on delete cascade
);

create function private.my_family(p_team uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select family_id from public.profiles where team_id=p_team and id=auth.uid() and approved;
$$;
create function private.replacement_eligible(p_team uuid,p_match text,p_role text,p_family uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists(select 1 from public.families f where f.team_id=p_team and f.id=p_family
    and (p_role <> 'OVR' or f.ovr_ok) and (p_role <> 'Klockan' or f.clock_ok)
    and (p_role <> 'Speaker/Musik' or f.speaker_ok)
    and not exists(select 1 from public.assignments a where a.team_id=p_team and a.match_id=p_match and a.family_id=p_family)
    and not exists(select 1 from public.family_unavailability u where u.team_id=p_team and u.match_id=p_match and u.family_id=p_family));
$$;

-- Serialize all assignment writes and replacement operations within a team.
-- This also prevents two searches for different slots assigning the same family.
create function private.lock_staffing() returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.team_id,old.team_id)::text, 42));
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger a_lock_staffing before insert or update or delete on public.assignments
for each row execute function private.lock_staffing();

create function private.advance_replacement(p_id uuid,p_force boolean default false)
returns void language plpgsql set search_path = '' as $$
declare s public.replacement_searches; m public.matches; g integer;
begin
  select * into s from public.replacement_searches where id=p_id;
  if s.id is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(s.team_id::text,42));
  select * into s from public.replacement_searches where id=p_id for update;
  if s.status <> 'searching' then return; end if;
  select * into m from public.matches where team_id=s.team_id and id=s.match_id;
  if m.status in ('finished','cancelled') or m.starts_at <= now() or not exists (
    select 1 from public.assignments where team_id=s.team_id and match_id=s.match_id and role=s.role and family_id=s.original_family_id
  ) then
    update public.replacement_searches set status=case when m.status='cancelled' then 'cancelled' else 'exhausted' end,deadline=null where id=p_id;
    update public.replacement_invitations set response='closed' where search_id=p_id and response in ('queued','pending');
    return;
  end if;
  -- Eligibility can change since search creation or the previous group.
  update public.replacement_invitations i set response='closed'
  where search_id=p_id and response in ('queued','pending') and not private.replacement_eligible(s.team_id,s.match_id,s.role,i.family_id);
  if not p_force and s.deadline > now() and exists (
    select 1 from public.replacement_invitations where search_id=p_id and response='pending'
  ) then
    -- A moved kick-off may require a shorter response window.
    update public.replacement_searches set deadline=least(deadline,now()+(m.starts_at-now())/(4-current_group)) where id=p_id;
    return;
  end if;
  update public.replacement_invitations set response='closed' where search_id=p_id and response='pending';
  select min(priority_group) into g from public.replacement_invitations where search_id=p_id and response='queued' and priority_group>s.current_group;
  if g is null then
    update public.replacement_searches set status='exhausted',deadline=null where id=p_id;
    insert into public.replacement_notifications(team_id,search_id,family_id,message)
      values(s.team_id,p_id,s.original_family_id,'Ingen ersättare hittad. Din familj ansvarar fortfarande för passet.');
    return;
  end if;
  update public.replacement_searches set current_group=g,
    deadline=least(now()+interval '24 hours',coalesce(now()+(m.starts_at-now())/(4-g),now()+interval '24 hours')) where id=p_id;
  update public.replacement_invitations set response='pending',invited_at=now() where search_id=p_id and priority_group=g and response='queued';
  insert into public.replacement_notifications(team_id,search_id,family_id,message)
    select s.team_id,p_id,family_id,'Kan din familj ta ett pass som '||s.role||'? Svara under Mina pass.' from public.replacement_invitations where search_id=p_id and response='pending';
end;
$$;

create function public.start_replacement(p_team_id uuid,p_match_id text,p_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare owner_id uuid; search_id uuid;
begin
  if not public.is_approved(p_team_id) then raise exception 'Godkänt konto krävs'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_team_id::text,42));
  select family_id into owner_id from public.assignments where team_id=p_team_id and match_id=p_match_id and role=p_role;
  if owner_id is null or (owner_id is distinct from private.my_family(p_team_id) and not public.is_admin(p_team_id)) then raise exception 'Passet tillhör inte din familj'; end if;
  if not exists(select 1 from public.matches where team_id=p_team_id and id=p_match_id and status not in ('finished','cancelled') and (starts_at is null or starts_at>now())) then raise exception 'Matchen är inte kommande'; end if;
  insert into public.replacement_searches(team_id,match_id,role,original_family_id) values(p_team_id,p_match_id,p_role,owner_id) returning id into search_id;
  -- Snapshot workload across ALL assigned shifts, including completed matches.
  with loads as (
    select f.id,count(a.family_id) as total from public.families f left join public.assignments a on a.team_id=f.team_id and a.family_id=f.id
    where f.team_id=p_team_id group by f.id
  ), average as (select avg(total) as value from loads)
  insert into public.replacement_invitations(team_id,search_id,family_id,priority_group)
    select p_team_id,search_id,l.id,case when l.total<av.value then 1 when l.total>ceil(av.value) then 3 else 2 end
    from loads l cross join average av where l.id<>owner_id and private.replacement_eligible(p_team_id,p_match_id,p_role,l.id);
  perform private.advance_replacement(search_id);
  return search_id;
end;
$$;

create function public.act_on_replacement(p_search_id uuid,p_action text,p_family_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.replacement_searches; f uuid; administrator boolean;
begin
  select * into s from public.replacement_searches where id=p_search_id;
  if s.id is null or not public.is_approved(s.team_id) then raise exception 'Sökningen är inte tillgänglig'; end if;
  perform pg_advisory_xact_lock(hashtextextended(s.team_id::text,42));
  select * into s from public.replacement_searches where id=p_search_id for update;
  administrator := public.is_admin(s.team_id);
  f := private.my_family(s.team_id);
  if p_action='cancel' then
    if not administrator and f is distinct from s.original_family_id then raise exception 'Behörighet saknas'; end if;
    if s.status<>'searching' then raise exception 'Sökningen är avslutad'; end if;
    update public.replacement_searches set status='cancelled',deadline=null where id=p_search_id;
    update public.replacement_invitations set response='closed' where search_id=p_search_id and response in ('queued','pending');
    return;
  end if;
  if p_action='next' then
    if not administrator then raise exception 'Administratör krävs'; end if;
    perform private.advance_replacement(p_search_id,true);
    return;
  end if;
  if p_action not in ('accept','decline','assign') or p_action is null then raise exception 'Ogiltigt svar'; end if;
  perform private.advance_replacement(p_search_id);
  select * into s from public.replacement_searches where id=p_search_id;
  if s.status<>'searching' then raise exception 'Sökningen är avslutad'; end if;
  if p_action='assign' then
    if not administrator then raise exception 'Administratör krävs'; end if;
    f := p_family_id;
  elsif not exists(select 1 from public.replacement_invitations where search_id=p_search_id and family_id=f and response='pending') then
    raise exception 'Ingen aktiv förfrågan till din familj';
  end if;
  if p_action='decline' then
    update public.replacement_invitations set response='declined',responded_at=now() where search_id=p_search_id and family_id=f;
    perform private.advance_replacement(p_search_id);
    return;
  end if;
  if f is null or f=s.original_family_id or not private.replacement_eligible(s.team_id,s.match_id,s.role,f) then raise exception 'Familjen kan inte ta passet längre'; end if;
  -- Compare-and-swap: never overwrite staffing changed by an administrator.
  update public.assignments set family_id=f where team_id=s.team_id and match_id=s.match_id and role=s.role and family_id=s.original_family_id;
  if not found then raise exception 'Bemanningen har ändrats'; end if;
  update public.replacement_searches set status='found',replacement_family_id=f,deadline=null where id=p_search_id;
  update public.replacement_invitations set response='closed' where search_id=p_search_id and response in ('queued','pending');
  insert into public.replacement_invitations(team_id,search_id,family_id,priority_group,response,responded_at)
    values(s.team_id,p_search_id,f,greatest(1,s.current_group),'accepted',now())
    on conflict(search_id,family_id) do update set response='accepted',responded_at=now();
  insert into public.replacement_notifications(team_id,search_id,family_id,message) values
    (s.team_id,p_search_id,s.original_family_id,'Ersättare hittad! En annan familj har tagit över passet som '||s.role||'.'),
    (s.team_id,p_search_id,f,'Din familj har tagit över passet som '||s.role||'. Det finns nu under Mina pass.');
end;
$$;

create function private.process_replacements() returns void language plpgsql security definer set search_path = '' as $$
declare item record;
begin
  for item in select id from public.replacement_searches where status='searching' order by team_id,id loop
    perform private.advance_replacement(item.id);
  end loop;
end;
$$;

alter table public.replacement_searches enable row level security;
alter table public.replacement_invitations enable row level security;
alter table public.replacement_notifications enable row level security;
create policy replacement_read on public.replacement_searches for select to authenticated using (public.is_approved(team_id));
create policy invitation_read on public.replacement_invitations for select to authenticated using (
  public.is_admin(team_id) or (family_id=private.my_family(team_id) and response<>'queued')
);
create policy notification_read on public.replacement_notifications for select to authenticated using (family_id=private.my_family(team_id));
revoke all on public.replacement_searches,public.replacement_invitations,public.replacement_notifications from public,anon,authenticated,service_role;
grant select on public.replacement_searches,public.replacement_invitations,public.replacement_notifications to authenticated;
revoke all on function private.my_family(uuid),private.replacement_eligible(uuid,text,text,uuid),private.lock_staffing(),private.advance_replacement(uuid,boolean),private.process_replacements(),public.start_replacement(uuid,text,text),public.act_on_replacement(uuid,text,uuid) from public,anon,authenticated,service_role;
grant usage on schema private to authenticated;
grant execute on function private.my_family(uuid) to authenticated;
grant execute on function public.start_replacement(uuid,text,text),public.act_on_replacement(uuid,text,uuid) to authenticated;
commit;
