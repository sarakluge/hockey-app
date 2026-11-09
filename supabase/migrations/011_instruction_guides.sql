-- Instructions retain the existing team-scoped read and admin-write policies.
alter table public.instructions
  add column phase text not null default 'general'
    check (phase in ('general', 'before', 'during', 'after')),
  add column guide_url text not null default ''
    check (guide_url = '' or guide_url ~ '^https?://[^[:space:]]+$'),
  add column guide_label text not null default '';
