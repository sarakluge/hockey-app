begin;

create table public.family_unavailability (
  team_id uuid not null,
  match_id text not null,
  family_id uuid not null,
  primary key (team_id, match_id, family_id),
  foreign key (team_id, match_id) references public.matches(team_id, id) on delete cascade,
  foreign key (team_id, family_id) references public.families(team_id, id) on delete cascade
);
alter table public.family_unavailability enable row level security;

create policy availability_read on public.family_unavailability for select to authenticated
  using (public.is_admin(team_id) or exists (
    select 1 from public.profiles p where p.team_id = family_unavailability.team_id
      and p.id = auth.uid() and p.approved and p.family_id = family_unavailability.family_id
  ));
create policy availability_insert on public.family_unavailability for insert to authenticated
  with check (exists (
    select 1 from public.profiles p where p.team_id = family_unavailability.team_id
      and p.id = auth.uid() and p.approved and p.family_id = family_unavailability.family_id
  ));
create policy availability_delete on public.family_unavailability for delete to authenticated
  using (exists (
    select 1 from public.profiles p where p.team_id = family_unavailability.team_id
      and p.id = auth.uid() and p.approved and p.family_id = family_unavailability.family_id
  ));
-- Upserts may update the same key; the family and team must remain owned by the caller.
create policy availability_update on public.family_unavailability for update to authenticated
  using (exists (
    select 1 from public.profiles p where p.team_id = family_unavailability.team_id
      and p.id = auth.uid() and p.approved and p.family_id = family_unavailability.family_id
  )) with check (exists (
    select 1 from public.profiles p where p.team_id = family_unavailability.team_id
      and p.id = auth.uid() and p.approved and p.family_id = family_unavailability.family_id
  ));
create trigger immutable_team before update on public.family_unavailability
  for each row execute function private.immutable_team();
revoke all on public.family_unavailability from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.family_unavailability to authenticated;

commit;
