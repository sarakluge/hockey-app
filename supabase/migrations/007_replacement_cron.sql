-- Required in hosted Supabase: migration fails visibly if Cron cannot be enabled.
begin;
create extension if not exists pg_cron;
select cron.schedule('advance-shift-replacements', '* * * * *', 'select private.process_replacements()');
commit;
