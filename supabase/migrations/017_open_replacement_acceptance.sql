-- All approved, eligible families may accept an active search.
-- Invitation groups continue to control push notifications and declines only.
begin;
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
  if p_action='decline' then perform private.advance_replacement(p_search_id); end if;
  select * into s from public.replacement_searches where id=p_search_id;
  if s.status<>'searching' then raise exception 'Sökningen är avslutad'; end if;
  if p_action='assign' then
    if not administrator then raise exception 'Administratör krävs'; end if;
    f := p_family_id;
  elsif p_action='decline' and not exists(select 1 from public.replacement_invitations where search_id=p_search_id and family_id=f and response='pending') then
    raise exception 'Ingen aktiv förfrågan till din familj';
  end if;
  if p_action='decline' then
    update public.replacement_invitations set response='declined',responded_at=now() where search_id=p_search_id and family_id=f;
    perform private.advance_replacement(p_search_id);
    return;
  end if;
  if f is null or f=s.original_family_id or not private.replacement_eligible(s.team_id,s.match_id,s.role,f,p_action='assign' and administrator) then raise exception 'Familjen kan inte ta passet längre'; end if;
  if not exists(select 1 from public.matches m where m.team_id=s.team_id and m.id=s.match_id
    and m.status not in ('finished','cancelled') and (m.starts_at is null or m.starts_at>now())) then
    raise exception 'Matchen är inte kommande';
  end if;
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

commit;
