begin;

-- Partial, manually verified imports do not mark other matches as missing.
create function public.manual_matches(p_team_id uuid, p_matches jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin(p_team_id) then
    raise exception 'Administratör för laget krävs';
  end if;
  perform private.apply_matches(p_team_id, p_matches, false);
end;
$$;

revoke all on function public.manual_matches(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.manual_matches(uuid, jsonb) to authenticated;

commit;
