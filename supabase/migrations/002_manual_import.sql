begin;

create function public.manual_matches(p_matches jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r jsonb;
 old public.matches;
 newrow public.matches;
begin
 if not public.is_admin() then raise exception 'Administratör krävs';
end if;

 perform pg_advisory_xact_lock(2149522208);

 if jsonb_typeof(p_matches)<>'array' or jsonb_array_length(p_matches)=0 then raise exception 'Tom import';
end if;

 for r in select * from jsonb_array_elements(p_matches) loop
  if r->>'source_id' !~ '^\d+$' then raise exception 'Officiellt numeriskt matchnummer krävs';
end if;

  if r->>'starts_at' is not null and r->>'starts_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Explicit tidszon krävs';
end if;

  select * into old from public.matches where id=r->>'id';

  insert into public.matches(id,competition,source_id,starts_at,home_team,away_team,arena,status,needs_review)
  values(r->>'id',r->>'competition',r->>'source_id',(r->>'starts_at')::timestamptz,r->>'home_team',r->>'away_team',r->>'arena',r->>'status',coalesce((r->>'needs_review')::boolean,false))
  on conflict(id) do update set starts_at=excluded.starts_at,home_team=excluded.home_team,away_team=excluded.away_team,arena=excluded.arena,status=excluded.status,needs_review=excluded.needs_review returning * into newrow;

  if old.id is null or (old.starts_at,old.arena,old.status,old.away_team,old.needs_review) is distinct from (newrow.starts_at,newrow.arena,newrow.status,newrow.away_team,newrow.needs_review) then
   insert into public.match_changes(match_id,old_data,new_data) values(newrow.id,case when old.id is null then null else to_jsonb(old) end,to_jsonb(newrow));

   if old.id is not null then update public.matches set changed_at=now() where id=newrow.id;
end if;

  end if;

 end loop;

end;
$$;

revoke all on function public.manual_matches(jsonb) from public,anon;

grant execute on function public.manual_matches(jsonb) to authenticated;

commit;

