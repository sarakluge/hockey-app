begin;

-- Initial schema for a NEW, EMPTY project. No production data is seeded.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete restrict,
  name text not null check (length(name) between 1 and 120),
  home_team text not null check (length(home_team) between 1 and 160),
  sync_enabled boolean not null default false,
  unique (club_id, name)
);

create table public.team_competitions (
  team_id uuid not null references public.teams(id) on delete cascade,
  competition text not null check (competition ~ '^[0-9]+$'),
  kind text not null check (kind in ('serie', 'dm')),
  primary key (team_id, competition)
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  ovr_ok boolean not null default false,
  clock_ok boolean not null default false,
  speaker_ok boolean not null default false,
  unique (team_id, id),
  unique (team_id, name)
);

-- A profile is a TEAM MEMBERSHIP, not a global permission.
-- One Auth user may have different roles/approval/family in different teams.
create table public.profiles (
  team_id uuid not null references public.teams(id) on delete cascade,
  id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'PARENT' check (role in ('ADMIN', 'PARENT')),
  approved boolean not null default false,
  family_id uuid,
  primary key (team_id, id),
  foreign key (team_id, family_id)
    references public.families(team_id, id) on delete set null (family_id)
);
create index profiles_user_idx on public.profiles(id, team_id);

create table public.matches (
  team_id uuid not null,
  id text not null,
  competition text not null,
  source_id text not null check (source_id ~ '^[0-9]+$'),
  starts_at timestamptz,
  home_team text not null,
  away_team text not null,
  arena text not null,
  status text not null check (status in ('scheduled', 'finished', 'postponed', 'cancelled')),
  changed_at timestamptz,
  needs_review boolean not null default false,
  missing_from_source boolean not null default false,
  primary key (team_id, id),
  unique (team_id, competition, source_id),
  foreign key (team_id, competition)
    references public.team_competitions(team_id, competition) on delete restrict,
  check (id = competition || ':' || source_id)
);

-- Shared, non-personal vocabulary. Only provisioners can modify these six slots.
create table public.assignment_types (
  name text primary key,
  sort_order integer not null unique
);
insert into public.assignment_types (name, sort_order) values
  ('Båsdörr 1', 1),
  ('Båsdörr 2', 2),
  ('OVR', 3),
  ('Klockan', 4),
  ('Speaker/Musik', 5),
  ('Matchvärd', 6);

create table public.assignments (
  team_id uuid not null,
  match_id text not null,
  role text not null references public.assignment_types(name),
  family_id uuid not null,
  primary key (team_id, match_id, role),
  foreign key (team_id, match_id)
    references public.matches(team_id, id) on delete restrict,
  foreign key (team_id, family_id)
    references public.families(team_id, id) on delete cascade
);
create index assignments_family_idx on public.assignments(team_id, family_id);

create table public.instructions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  body text not null,
  arena text not null,
  role text not null,
  unique (team_id, title, arena, role)
);

create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  success boolean not null,
  message text not null
);
create index sync_logs_team_idx on public.sync_logs(team_id, created_at);

create table public.match_changes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  match_id text not null,
  created_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb not null,
  foreign key (team_id, match_id) references public.matches(team_id, id)
);

create table public.sync_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  requested_by uuid references auth.users(id) on delete set null
);
create index sync_requests_team_idx on public.sync_requests(team_id, created_at);

-- Definer helpers avoid recursive policies on profiles. Never trust Auth metadata.
create function public.is_approved(p_team_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where team_id = p_team_id and id = auth.uid() and approved
  );
$$;

create function public.is_admin(p_team_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where team_id = p_team_id and id = auth.uid() and approved and role = 'ADMIN'
  );
$$;

-- Registration requests access ONLY to the explicitly selected team.
-- No INSERT/UPDATE rights on profiles are granted to unapproved users.
create function public.request_team_access(p_team_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Inloggning krävs';
  end if;
  select email into user_email from auth.users where id = auth.uid();
  if user_email is null then
    raise exception 'Verifierat e-postkonto krävs';
  end if;
  insert into public.profiles (team_id, id, email)
  values (p_team_id, auth.uid(), user_email)
  on conflict (team_id, id) do nothing;
end;
$$;

alter table public.clubs enable row level security;
alter table public.teams enable row level security;
alter table public.team_competitions enable row level security;
alter table public.profiles enable row level security;

create policy membership_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin(team_id));
create policy membership_update on public.profiles for update to authenticated
  using (public.is_admin(team_id)) with check (public.is_admin(team_id));
create policy membership_delete on public.profiles for delete to authenticated
  using (public.is_admin(team_id));
create policy team_read on public.teams for select to authenticated
  using (exists (
    select 1 from public.profiles where profiles.team_id = teams.id and profiles.id = auth.uid()
  ));
create policy club_read on public.clubs for select to authenticated
  using (exists (select 1 from public.teams where teams.club_id = clubs.id));
create policy competition_read on public.team_competitions for select to authenticated
  using (public.is_approved(team_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'families', 'matches', 'assignments', 'instructions',
    'sync_logs', 'match_changes', 'sync_requests'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy team_read on public.%I for select to authenticated using (public.is_approved(team_id))',
      table_name
    );
  end loop;
  foreach table_name in array array['families', 'assignments', 'instructions'] loop
    execute format(
      'create policy team_admin_write on public.%I for all to authenticated using (public.is_admin(team_id)) with check (public.is_admin(team_id))',
      table_name
    );
  end loop;
end;
$$;

-- Sync request identities are only visible to the relevant team's admins.
drop policy team_read on public.sync_requests;
create policy admin_read on public.sync_requests for select to authenticated
  using (public.is_admin(team_id));
alter table public.assignment_types enable row level security;
create policy vocabulary_read on public.assignment_types for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and approved));

create function private.immutable_team()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.team_id is distinct from old.team_id then
    raise exception 'En rad kan inte flyttas mellan lag';
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'families', 'matches', 'assignments', 'instructions',
    'sync_logs', 'match_changes', 'sync_requests', 'team_competitions'
  ] loop
    execute format(
      'create trigger immutable_team before update on public.%I for each row execute function private.immutable_team()',
      table_name
    );
  end loop;
end;
$$;

create function private.validate_assignment()
returns trigger language plpgsql set search_path = ''
as $$
declare
  family public.families;
begin
  select * into family from public.families
  where team_id = new.team_id and id = new.family_id;
  if not found then
    raise exception 'Familjen saknas i laget';
  end if;
  if (new.role = 'OVR' and not family.ovr_ok)
    or (new.role = 'Klockan' and not family.clock_ok)
    or (new.role = 'Speaker/Musik' and not family.speaker_ok) then
    raise exception 'Familjen saknar behörighet för uppgiften';
  end if;
  return new;
end;
$$;
create trigger assignment_eligibility before insert or update on public.assignments
  for each row execute function private.validate_assignment();

-- Private implementation, shared by the service-only sync and admin-only manual import.
create function private.apply_matches(p_team_id uuid, p_matches jsonb, p_full_sync boolean)
returns void language plpgsql set search_path = ''
as $$
declare
  item jsonb;
  previous public.matches;
  updated public.matches;
  expected_home text;
  changes integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_team_id::text, 0));
  select home_team into expected_home from public.teams where id = p_team_id;
  if not found then
    raise exception 'Okänt lag';
  end if;
  if jsonb_typeof(p_matches) is distinct from 'array'
    or jsonb_array_length(p_matches) = 0 then
    raise exception 'Tom eller ogiltig matchimport';
  end if;
  if (select count(*) from jsonb_array_elements(p_matches)) <>
    (select count(distinct value->>'id') from jsonb_array_elements(p_matches)) then
    raise exception 'Dubbla match-ID';
  end if;
  if p_full_sync and exists (
    select 1 from public.team_competitions competition
    where competition.team_id = p_team_id and not exists (
      select 1 from jsonb_array_elements(p_matches) source
      where source->>'competition' = competition.competition
    )
  ) then
    raise exception 'Alla lagets tävlingar krävs för full synk';
  end if;

  for item in select * from jsonb_array_elements(p_matches) loop
    if item ? 'team_id' and item->>'team_id' is distinct from p_team_id::text then
      raise exception 'Fel lag i matchdata';
    end if;
    if item->>'home_team' is distinct from expected_home then
      raise exception 'Fel hemmalag';
    end if;
    if item->>'starts_at' is not null
      and item->>'starts_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then
      raise exception 'Explicit tidszon krävs';
    end if;
    select * into previous from public.matches
    where team_id = p_team_id and id = item->>'id';

    insert into public.matches (
      team_id, id, competition, source_id, starts_at, home_team,
      away_team, arena, status, needs_review
    ) values (
      p_team_id, item->>'id', item->>'competition', item->>'source_id',
      (item->>'starts_at')::timestamptz, item->>'home_team',
      item->>'away_team', item->>'arena', item->>'status',
      coalesce((item->>'needs_review')::boolean, false)
    )
    on conflict (team_id, id) do update set
      starts_at = excluded.starts_at,
      home_team = excluded.home_team,
      away_team = excluded.away_team,
      arena = excluded.arena,
      status = excluded.status,
      needs_review = excluded.needs_review,
      missing_from_source = case when p_full_sync then false else matches.missing_from_source end
    returning * into updated;

    if previous.id is null or
      (previous.starts_at, previous.arena, previous.status, previous.away_team,
       previous.needs_review, previous.missing_from_source) is distinct from
      (updated.starts_at, updated.arena, updated.status, updated.away_team,
       updated.needs_review, updated.missing_from_source) then
      insert into public.match_changes (team_id, match_id, old_data, new_data)
      values (p_team_id, updated.id,
        case when previous.id is null then null else to_jsonb(previous) end,
        to_jsonb(updated));
      if previous.id is not null then
        update public.matches set changed_at = now()
        where team_id = p_team_id and id = updated.id;
      end if;
      changes := changes + 1;
    end if;
  end loop;

  if p_full_sync then
    insert into public.match_changes (team_id, match_id, old_data, new_data)
    select p_team_id, match.id, to_jsonb(match),
      to_jsonb(match) || jsonb_build_object('missing_from_source', true)
    from public.matches match
    where match.team_id = p_team_id and not match.missing_from_source
      and not exists (
        select 1 from jsonb_array_elements(p_matches) source where source->>'id' = match.id
      );
    update public.matches match set missing_from_source = true, changed_at = now()
    where match.team_id = p_team_id and not match.missing_from_source
      and not exists (
        select 1 from jsonb_array_elements(p_matches) source where source->>'id' = match.id
      );
    insert into public.sync_logs (team_id, success, message)
    values (p_team_id, true, format(
      '%s hemmamatcher lästa, %s nya/ändrade. Bemanning bevarad.',
      jsonb_array_length(p_matches), changes
    ));
  end if;
end;
$$;

create function public.sync_matches(p_team_id uuid, p_matches jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Endast synktjänsten';
  end if;
  perform private.apply_matches(p_team_id, p_matches, true);
end;
$$;

create function public.import_excel(p_team_id uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  item jsonb;
  assignment jsonb;
  family_id uuid;
  existing_family uuid;
begin
  if not public.is_admin(p_team_id) then
    raise exception 'Administratör för laget krävs';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_team_id::text, 0));
  for item in select * from jsonb_array_elements(p_data->'families') loop
    insert into public.families (team_id, name, ovr_ok, clock_ok, speaker_ok)
    values (p_team_id, item->>'name', (item->>'ovr_ok')::boolean,
      (item->>'clock_ok')::boolean, (item->>'speaker_ok')::boolean)
    on conflict (team_id, name) do update set
      ovr_ok = excluded.ovr_ok, clock_ok = excluded.clock_ok, speaker_ok = excluded.speaker_ok;
  end loop;
  for item in select * from jsonb_array_elements(p_data->'rows') loop
    if not exists (
      select 1 from public.matches where team_id = p_team_id and id = item->>'match_id'
    ) then
      raise exception 'Ogiltig matchkoppling för laget';
    end if;
    for assignment in select * from jsonb_array_elements(item->'assignments') loop
      select id into family_id from public.families
      where team_id = p_team_id and name = assignment->>'name';
      if family_id is null then
        raise exception 'Okänd familj i laget';
      end if;
      select assigned.family_id into existing_family from public.assignments assigned
      where assigned.team_id = p_team_id and assigned.match_id = item->>'match_id'
        and assigned.role = assignment->>'role';
      if existing_family is not null and existing_family <> family_id then
        raise exception 'Befintlig bemanning skiljer sig; justera manuellt först';
      end if;
      insert into public.assignments (team_id, match_id, role, family_id)
      values (p_team_id, item->>'match_id', assignment->>'role', family_id)
      on conflict do nothing;
    end loop;
  end loop;
  for item in select * from jsonb_array_elements(p_data->'instructions') loop
    insert into public.instructions (team_id, title, body, arena, role)
    values (p_team_id, item->>'title', item->>'body', item->>'arena', item->>'role')
    on conflict (team_id, title, arena, role) do update set body = excluded.body;
  end loop;
end;
$$;

create function public.request_sync(p_team_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin(p_team_id) then
    raise exception 'Administratör för laget krävs';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_team_id::text, 1));
  if exists (
    select 1 from public.sync_requests
    where team_id = p_team_id and created_at > now() - interval '5 minutes'
  ) then
    raise exception 'Vänta fem minuter mellan synkstarter för laget';
  end if;
  insert into public.sync_requests (team_id, requested_by) values (p_team_id, auth.uid());
end;
$$;

-- Explicit, object-specific privileges: no dependency on automatic table exposure.
-- Reset any inherited/default grants on THESE app objects, not unrelated public tables.
revoke all on table public.clubs, public.teams, public.team_competitions,
  public.profiles, public.families, public.matches, public.assignment_types,
  public.assignments, public.instructions, public.sync_logs, public.match_changes,
  public.sync_requests from public, anon, authenticated, service_role;
grant usage on schema public to authenticated, service_role;
grant select on public.clubs, public.teams, public.team_competitions,
  public.profiles, public.families, public.matches, public.assignment_types,
  public.assignments, public.instructions, public.sync_logs, public.match_changes,
  public.sync_requests to authenticated;
grant insert, update, delete on public.families, public.assignments, public.instructions
  to authenticated;
grant update (role, approved, family_id) on public.profiles to authenticated;
grant delete on public.profiles to authenticated;
-- Service key is trusted server-side infrastructure and intentionally bypasses RLS.
grant select on public.teams, public.team_competitions to service_role;
grant insert on public.sync_logs to service_role;

revoke all on function public.is_approved(uuid), public.is_admin(uuid),
  public.request_team_access(uuid), public.sync_matches(uuid, jsonb),
  public.import_excel(uuid, jsonb), public.request_sync(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.is_approved(uuid), public.is_admin(uuid),
  public.request_team_access(uuid), public.import_excel(uuid, jsonb), public.request_sync(uuid)
  to authenticated;
grant execute on function public.sync_matches(uuid, jsonb) to service_role;
revoke all on function private.immutable_team(), private.validate_assignment(),
  private.apply_matches(uuid, jsonb, boolean) from public, anon, authenticated, service_role;

commit;
