begin;

-- Names supplied at signup are identification hints, never authorization.
alter table public.profiles
  add column parent_name text check (length(parent_name) between 1 and 120),
  add column child_name text check (length(child_name) between 1 and 120);

create or replace function public.request_team_access(p_team_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  user_email text;
  metadata jsonb;
begin
  if auth.uid() is null then
    raise exception 'Inloggning krävs';
  end if;
  select email, raw_user_meta_data into user_email, metadata
    from auth.users where id = auth.uid();
  if user_email is null then
    raise exception 'Verifierat e-postkonto krävs';
  end if;
  insert into public.profiles (team_id, id, email, parent_name, child_name)
  values (p_team_id, auth.uid(), user_email,
    nullif(left(btrim(metadata->>'parent_name'), 120), ''),
    nullif(left(btrim(metadata->>'child_name'), 120), ''))
  on conflict (team_id, id) do nothing;
end;
$$;

commit;
