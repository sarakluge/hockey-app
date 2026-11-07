begin;

-- Family choices use the existing capability flags. No personal role storage.
create or replace function public.save_my_duty_roles(p_team_id uuid, p_roles text[])
returns void language plpgsql security definer set search_path = ''
as $$
declare
  member_family uuid;
begin
  if auth.uid() is null then raise exception 'Inloggning krävs'; end if;
  if p_roles is null or cardinality(p_roles) = 0
    or not (p_roles <@ array['OVR', 'Klockan', 'Speaker/Musik']::text[])
    or array_position(p_roles, null) is not null then
    raise exception 'Välj minst en giltig uppgift';
  end if;
  select family_id into member_family from public.profiles
    where team_id = p_team_id and id = auth.uid() and approved
    for share;
  if member_family is null then
    raise exception 'Administratören behöver godkänna och koppla kontot till en familj';
  end if;
  update public.families set
    ovr_ok = 'OVR' = any(p_roles),
    clock_ok = 'Klockan' = any(p_roles),
    speaker_ok = 'Speaker/Musik' = any(p_roles)
    where team_id = p_team_id and id = member_family;
end;
$$;
revoke all on function public.save_my_duty_roles(uuid, text[]) from public, anon;
grant execute on function public.save_my_duty_roles(uuid, text[]) to authenticated;

-- Only confirmed Auth email changes are copied into team memberships.
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke all on function public.sync_profile_email() from public;
drop trigger if exists profile_email_changed on auth.users;
create trigger profile_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_profile_email();
commit;
