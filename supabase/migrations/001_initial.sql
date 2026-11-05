begin;

create table public.families (
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(name) between 1 and 120),
 ovr_ok boolean not null default false, clock_ok boolean not null default false, speaker_ok boolean not null default false
);

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, role text not null default 'PARENT' check(role in ('ADMIN','PARENT')),
 approved boolean not null default false, family_id uuid references public.families(id) on delete set null
);

create table public.matches (
 id text primary key, competition text not null check(competition in ('21495','22208')), source_id text not null,
 starts_at timestamptz, home_team text not null check(home_team='Team Söderort(FOC/THH)'), away_team text not null, arena text not null,
 status text not null check(status in ('scheduled','finished','postponed','cancelled')),
 changed_at timestamptz, needs_review boolean not null default false, missing_from_source boolean not null default false,
 unique(competition,source_id), check(id=competition||':'||source_id)
);

create table public.assignment_types (name text primary key, sort_order integer not null unique);

insert into public.assignment_types values ('Båsdörr 1',1),('Båsdörr 2',2),('OVR',3),('Klockan',4),('Speaker/Musik',5),('Matchvärd',6);

create table public.assignments (
 match_id text not null references public.matches(id) on delete restrict,
 role text not null references public.assignment_types(name), family_id uuid not null references public.families(id) on delete cascade,
 primary key(match_id,role)
);

create index assignments_family_idx on public.assignments(family_id);

create table public.instructions (id uuid primary key default gen_random_uuid(), title text not null, body text not null, arena text not null, role text not null, unique(title,arena,role));

create table public.sync_logs (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), success boolean not null, message text not null);

create table public.match_changes (id uuid primary key default gen_random_uuid(), match_id text not null references public.matches(id), created_at timestamptz not null default now(), old_data jsonb, new_data jsonb not null);

create table public.sync_requests (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), requested_by uuid references auth.users(id) on delete set null);

create function public.is_approved() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and approved);
 $$;

create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and approved and role='ADMIN');
 $$;

create function public.new_profile() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.profiles(id,email) values(new.id,coalesce(new.email,''));
return new;
end;
 $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();

alter table public.profiles enable row level security;

create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());

create policy profile_admin on public.profiles for update to authenticated using(public.is_admin()) with check(public.is_admin());

do $$ declare t text;
 begin
 foreach t in array array['families','matches','assignment_types','assignments','instructions','sync_logs','match_changes'] loop
  execute format('alter table public.%I enable row level security',t);

  execute format('create policy approved_read on public.%I for select to authenticated using(public.is_approved())',t);

 end loop;

 foreach t in array array['families','assignments','instructions'] loop
  execute format('create policy admin_write on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);

 end loop;

end $$;

alter table public.sync_requests enable row level security;

create policy requests_read on public.sync_requests for select to authenticated using(public.is_admin());

-- Matchdata skrivs endast av validerade RPC-anrop (ingen fri frontend-upsert).
create function public.validate_assignment() returns trigger language plpgsql set search_path='' as $$
declare f public.families;
 begin
 select * into f from public.families where id=new.family_id;

 if (new.role='OVR' and not f.ovr_ok) or (new.role='Klockan' and not f.clock_ok) or (new.role='Speaker/Musik' and not f.speaker_ok) then
 raise exception 'Familjen saknar behörighet för uppgiften';
 end if;

 return new;
end;
$$;

create trigger assignment_eligibility before insert or update on public.assignments for each row execute function public.validate_assignment();

create function public.sync_matches(p_matches jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r jsonb;
 old public.matches;
 newrow public.matches;
 n integer:=0;
 begin
 if auth.role()<>'service_role' then raise exception 'Endast synktjänsten';
end if;

 perform pg_advisory_xact_lock(2149522208);

 if jsonb_typeof(p_matches)<>'array' or jsonb_array_length(p_matches)=0 then raise exception 'Tom synk avvisad';
end if;

 if not exists(select 1 from jsonb_array_elements(p_matches) as source(value) where source.value->>'competition'='21495') or not exists(select 1 from jsonb_array_elements(p_matches) as source(value) where source.value->>'competition'='22208') then raise exception 'Båda tävlingarna krävs';
end if;

 for r in select * from jsonb_array_elements(p_matches) loop
  select * into old from public.matches where id=r->>'id';

  insert into public.matches(id,competition,source_id,starts_at,home_team,away_team,arena,status,needs_review)
   values(r->>'id',r->>'competition',r->>'source_id',(r->>'starts_at')::timestamptz,r->>'home_team',r->>'away_team',r->>'arena',r->>'status',coalesce((r->>'needs_review')::boolean,false))
   on conflict(id) do update set starts_at=excluded.starts_at,home_team=excluded.home_team,away_team=excluded.away_team,arena=excluded.arena,status=excluded.status,needs_review=excluded.needs_review,missing_from_source=false returning * into newrow;

  if old.id is null or (old.starts_at,old.arena,old.status,old.away_team,old.needs_review,old.missing_from_source) is distinct from (newrow.starts_at,newrow.arena,newrow.status,newrow.away_team,newrow.needs_review,newrow.missing_from_source) then
   insert into public.match_changes(match_id,old_data,new_data) values(newrow.id,case when old.id is null then null else to_jsonb(old) end,to_jsonb(newrow));

   if old.id is not null then update public.matches set changed_at=now() where id=newrow.id;
end if;
n:=n+1;

  end if;

 end loop;

 insert into public.match_changes(match_id,old_data,new_data)
 select m.id,to_jsonb(m),to_jsonb(m)||jsonb_build_object('missing_from_source',true) from public.matches m where not m.missing_from_source and not exists(select 1 from jsonb_array_elements(p_matches) as source(value) where source.value->>'id'=m.id);

 update public.matches m set missing_from_source=true,changed_at=now() where not m.missing_from_source and not exists(select 1 from jsonb_array_elements(p_matches) as source(value) where source.value->>'id'=m.id);

 insert into public.sync_logs(success,message) values(true,format('%s hemmamatcher lästa, %s nya/ändrade. Bemanning bevarad.',jsonb_array_length(p_matches),n));

end;
$$;

create function public.import_excel(p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r jsonb;
 a jsonb;
 f_id uuid;
 existing uuid;
 begin
 if not public.is_admin() then raise exception 'Administratör krävs';
end if;

 perform pg_advisory_xact_lock(2149522208);

 for r in select * from jsonb_array_elements(p_data->'families') loop
  insert into public.families(name,ovr_ok,clock_ok,speaker_ok) values(r->>'name',(r->>'ovr_ok')::boolean,(r->>'clock_ok')::boolean,(r->>'speaker_ok')::boolean)
  on conflict(name) do update set ovr_ok=excluded.ovr_ok,clock_ok=excluded.clock_ok,speaker_ok=excluded.speaker_ok;

 end loop;

 for r in select * from jsonb_array_elements(p_data->'rows') loop
  if not exists(select 1 from public.matches where id=r->>'match_id') then raise exception 'Ogiltig matchkoppling';
end if;

  for a in select * from jsonb_array_elements(r->'assignments') loop
   select id into f_id from public.families where name=a->>'name';

   if f_id is null then raise exception 'Okänd familj';
end if;

   select family_id into existing from public.assignments where match_id=r->>'match_id' and role=a->>'role';

   if existing is not null and existing<>f_id then raise exception 'Befintlig bemanning skiljer sig; justera manuellt först';
end if;

   insert into public.assignments(match_id,role,family_id) values(r->>'match_id',a->>'role',f_id) on conflict do nothing;

  end loop;

 end loop;

 for r in select * from jsonb_array_elements(p_data->'instructions') loop
  insert into public.instructions(title,body,arena,role) values(r->>'title',r->>'body',r->>'arena',r->>'role') on conflict(title,arena,role) do update set body=excluded.body;

 end loop;

end;
$$;

create function public.request_sync() returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.is_admin() then raise exception 'Administratör krävs';
end if;

 perform pg_advisory_xact_lock(2149522209);

 if exists(select 1 from public.sync_requests where created_at>now()-interval '5 minutes') then raise exception 'Vänta fem minuter mellan synkstarter';
end if;

 insert into public.sync_requests(requested_by) values(auth.uid());
end;
$$;

-- Inga funktionsrättigheter till anonyma. Triggerfunktioner anropas enbart av triggers.
revoke all on function public.new_profile(),public.validate_assignment(),public.import_excel(jsonb),public.sync_matches(jsonb),public.request_sync(),public.is_admin(),public.is_approved() from public,anon;

revoke all on function public.sync_matches(jsonb) from authenticated;

grant execute on function public.is_admin(),public.is_approved(),public.import_excel(jsonb),public.request_sync() to authenticated;

grant execute on function public.sync_matches(jsonb) to service_role;

grant usage on schema public to authenticated,service_role;

grant insert,select on public.sync_logs to service_role;

grant select on all tables in schema public to authenticated;

grant insert,update,delete on public.families,public.assignments,public.instructions to authenticated;

grant update on public.profiles to authenticated;

commit;

