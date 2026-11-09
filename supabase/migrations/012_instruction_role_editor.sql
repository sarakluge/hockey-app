begin;

-- Replace one role's instructions atomically, keeping other teams and roles intact.
create or replace function public.save_role_instructions(p_team_id uuid, p_role text, p_instructions jsonb)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.is_admin(p_team_id) then
    raise exception 'Endast lagets administratör kan ändra instruktioner';
  end if;
  if p_role is null or p_role in ('Alla', 'Alla uppgifter', 'Båsdörr 1', 'Båsdörr 2', 'Klocka')
    or jsonb_typeof(p_instructions) is distinct from 'array' then
    raise exception 'Ogiltig uppgift eller instruktioner';
  end if;
  -- Serialize concurrent edits of the same team's role.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_team_id::text || ':' || p_role, 0));
  delete from public.instructions
  where team_id = p_team_id and
    (case when role in ('Alla', 'Alla uppgifter') then ''
      when role in ('Båsdörr 1', 'Båsdörr 2') then 'Båsdörr'
      when role = 'Klocka' then 'Klockan' else btrim(role) end) = p_role;
  insert into public.instructions (team_id, role, title, arena, body, phase, guide_url, guide_label)
    select p_team_id, p_role, item->>'title', coalesce(item->>'arena', ''),
      coalesce(item->>'body', ''), coalesce(item->>'phase', 'general'),
      coalesce(item->>'guide_url', ''), coalesce(item->>'guide_label', '')
    from jsonb_array_elements(p_instructions) item;
end;
$$;
revoke all on function public.save_role_instructions(uuid, text, jsonb) from public, anon;
grant execute on function public.save_role_instructions(uuid, text, jsonb) to authenticated;

commit;
