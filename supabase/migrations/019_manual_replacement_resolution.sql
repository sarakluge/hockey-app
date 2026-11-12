begin;

-- Assignment writes already hold the team's staffing advisory lock.
create function private.resolve_staffed_replacement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare resolved_id uuid;
begin
  for resolved_id in
    update public.replacement_searches s
    set status='found', replacement_family_id=new.family_id, deadline=null
    where s.team_id=new.team_id and s.match_id=new.match_id and s.role=new.role
      and s.status in ('searching','exhausted')
      and s.original_family_id<>new.family_id
    returning s.id
  loop
    update public.replacement_invitations set response='closed'
    where search_id=resolved_id and response in ('queued','pending');
  end loop;
  return new;
end;
$$;

create trigger resolve_staffed_replacement after insert or update on public.assignments
for each row execute function private.resolve_staffed_replacement();
revoke all on function private.resolve_staffed_replacement() from public,anon,authenticated,service_role;

-- Repair searches left unresolved by earlier manual staffing changes.
with resolved as (
  update public.replacement_searches s
  set status='found', replacement_family_id=a.family_id, deadline=null
  from public.assignments a
  where a.team_id=s.team_id and a.match_id=s.match_id and a.role=s.role
    and s.status in ('searching','exhausted')
    and a.family_id<>s.original_family_id
  returning s.id
)
update public.replacement_invitations i set response='closed'
where i.search_id in (select id from resolved) and i.response in ('queued','pending');

commit;
