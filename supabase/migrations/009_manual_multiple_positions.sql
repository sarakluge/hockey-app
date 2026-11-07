begin;
-- Locked positions explicitly chosen by admin may share a family. Automatic
-- proposals still require one position per family and match. Replacement
-- eligibility remains unchanged and always excludes families already staffing.
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
    if not exists(select 1 from public.matches m where m.team_id=p_team_id and m.id=item.match_id and m.status='scheduled' and m.starts_at>now() and not m.missing_from_source) then raise exception 'Matchen kan inte schemaläggas'; end if;
    if exists(select 1 from public.family_unavailability u where u.team_id=p_team_id and u.match_id=item.match_id and u.family_id=item.family_id) then raise exception 'Familjen är otillgänglig'; end if;
    if not exists(select 1 from jsonb_to_recordset(p_proposal) as manual(match_id text,family_id uuid,locked boolean) where manual.match_id=item.match_id and manual.family_id=item.family_id and manual.locked) and (select count(*) from jsonb_to_recordset(p_proposal) as x(match_id text,family_id uuid) where x.match_id=item.match_id and x.family_id=item.family_id)>1 then raise exception 'Max ett pass per familj och match'; end if;
  end loop;
  delete from public.assignments a where a.team_id=p_team_id and not exists(select 1 from jsonb_to_recordset(p_proposal) as x(match_id text,role text,family_id uuid,locked boolean) where x.match_id=a.match_id and x.role=a.role and x.family_id=a.family_id and coalesce(x.locked,false)=a.locked);
  insert into public.assignments(team_id,match_id,role,family_id,locked)
    select p_team_id,x.match_id,x.role,x.family_id,coalesce(x.locked,false) from jsonb_to_recordset(p_proposal) as x(match_id text,role text,family_id uuid,locked boolean)
    on conflict(team_id,match_id,role) do nothing;
end; $$;
commit;
