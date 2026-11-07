begin;
alter table public.families add column staffing_exempt boolean not null default false;
-- Automatic invitations exclude exempt families; explicit admin assignment may use them.
create or replace function private.replacement_eligible(p_team uuid,p_match text,p_role text,p_family uuid,p_manual boolean)
returns boolean language sql stable set search_path = '' as $$
  select exists(select 1 from public.families f where f.team_id=p_team and f.id=p_family
    and (p_manual or not f.staffing_exempt)
    and (p_role <> 'OVR' or f.ovr_ok) and (p_role <> 'Klockan' or f.clock_ok)
    and (p_role <> 'Speaker/Musik' or f.speaker_ok)
    and not exists(select 1 from public.assignments a where a.team_id=p_team and a.match_id=p_match and a.family_id=p_family)
    and not exists(select 1 from public.family_unavailability u where u.team_id=p_team and u.match_id=p_match and u.family_id=p_family));
$$;

create or replace function private.replacement_eligible(p_team uuid,p_match text,p_role text,p_family uuid)
returns boolean language sql stable set search_path = '' as $$
  select private.replacement_eligible(p_team,p_match,p_role,p_family,false);
$$;
create or replace function public.act_on_replacement(p_search_id uuid,p_action text,p_family_id uuid default null)
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
  if f is null or f=s.original_family_id or not private.replacement_eligible(s.team_id,s.match_id,s.role,f,p_action='assign' and administrator) then raise exception 'Familjen kan inte ta passet längre'; end if;
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

create or replace function public.publish_schedule(p_team_id uuid, p_expected jsonb, p_proposal jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare current_rows jsonb; item record;
begin
  if not public.is_admin(p_team_id) then raise exception 'Administratör krävs'; end if;
  if jsonb_typeof(p_expected) is distinct from 'array' or jsonb_typeof(p_proposal) is distinct from 'array' then raise exception 'Ogiltigt förslag'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_team_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_team_id::text, 42));
  -- Block concurrent edits to availability, skills and match times until commit.
  lock table public.assignments, public.family_unavailability, public.families, public.matches, public.replacement_searches in share row exclusive mode;
  select coalesce(jsonb_agg(jsonb_build_object('match_id',match_id,'role',role,'family_id',family_id,'locked',locked)), '[]') into current_rows from public.assignments where team_id=p_team_id;
  if not (current_rows @> p_expected and p_expected @> current_rows) then raise exception 'Bemanningen har ändrats. Skapa ett nytt förslag.'; end if;
  if jsonb_typeof(p_proposal) <> 'array' then raise exception 'Ogiltigt förslag'; end if;
  if exists(select 1 from jsonb_to_recordset(p_proposal) as x(match_id text,role text,family_id uuid,locked boolean) group by match_id,role having count(*)>1) then raise exception 'Dubbla positioner'; end if;
  -- Every protected assignment must remain identical.
  if exists(select 1 from public.assignments a join public.matches m on m.team_id=a.team_id and m.id=a.match_id where a.team_id=p_team_id
    and (a.locked or m.status<>'scheduled' or m.starts_at is null or m.starts_at<=now() or m.missing_from_source or exists(select 1 from public.replacement_searches s where s.team_id=a.team_id and s.match_id=a.match_id and s.role=a.role and s.status='searching'))
    and not p_proposal @> jsonb_build_array(jsonb_build_object('match_id',a.match_id,'role',a.role,'family_id',a.family_id,'locked',a.locked))) then raise exception 'Skyddade pass får inte ändras'; end if;
  for item in select * from jsonb_to_recordset(p_proposal) as x(match_id text,role text,family_id uuid,locked boolean) loop
    if exists(select 1 from public.assignments a where a.team_id=p_team_id and a.match_id=item.match_id and a.role=item.role and a.family_id=item.family_id and a.locked=coalesce(item.locked,false)) then continue; end if;
    if not coalesce(item.locked,false) and exists(select 1 from public.families f where f.team_id=p_team_id and f.id=item.family_id and f.staffing_exempt) then raise exception 'Familjen är undantagen från automatisk bemanning. Välj familjen manuellt.'; end if;
    if not exists(select 1 from public.matches m where m.team_id=p_team_id and m.id=item.match_id and m.status='scheduled' and m.starts_at>now() and not m.missing_from_source) then raise exception 'Matchen kan inte schemaläggas'; end if;
    if exists(select 1 from public.family_unavailability u where u.team_id=p_team_id and u.match_id=item.match_id and u.family_id=item.family_id) then raise exception 'Familjen är otillgänglig'; end if;
    if not exists(select 1 from jsonb_to_recordset(p_proposal) as manual(match_id text,family_id uuid,locked boolean) where manual.match_id=item.match_id and manual.family_id=item.family_id and manual.locked) and (select count(*) from jsonb_to_recordset(p_proposal) as x(match_id text,family_id uuid) where x.match_id=item.match_id and x.family_id=item.family_id)>1 then raise exception 'Max ett pass per familj och match'; end if;
  end loop;
  delete from public.assignments a where a.team_id=p_team_id and not exists(select 1 from jsonb_to_recordset(p_proposal) as x(match_id text,role text,family_id uuid,locked boolean) where x.match_id=a.match_id and x.role=a.role and x.family_id=a.family_id and coalesce(x.locked,false)=a.locked);
  insert into public.assignments(team_id,match_id,role,family_id,locked)
    select p_team_id,x.match_id,x.role,x.family_id,coalesce(x.locked,false) from jsonb_to_recordset(p_proposal) as x(match_id text,role text,family_id uuid,locked boolean)
    on conflict(team_id,match_id,role) do nothing;
end; $$;

revoke all on function private.replacement_eligible(uuid,text,text,uuid,boolean) from public,anon,authenticated,service_role;
-- Withdraw invitations that may already exist when an admin exempts a family.
create function private.withdraw_exempt_invitations() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.staffing_exempt and not old.staffing_exempt then
    perform pg_advisory_xact_lock(hashtextextended(new.team_id::text,42));
    update public.replacement_invitations set response='closed'
      where team_id=new.team_id and family_id=new.id and response in ('queued','pending');
  end if;
  return new;
end; $$;
create trigger withdraw_exempt_invitations after update of staffing_exempt on public.families
for each row execute function private.withdraw_exempt_invitations();
revoke all on function private.withdraw_exempt_invitations() from public,anon,authenticated,service_role;
commit;
