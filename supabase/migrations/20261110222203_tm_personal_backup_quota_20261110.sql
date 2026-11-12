-- Version de migracion real: 20261110222203
-- Cuota máxima: 20 backups personales por usuario, con protección de concurrencia.
create schema if not exists tm_private;
revoke all on schema tm_private from public, anon, authenticated;

create or replace function tm_private.limit_personal_backups()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $body$
declare existing_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text, 0));
  if exists (select 1 from public.tm_legacy_backups
             where user_id = new.user_id and import_key = new.import_key) then
    return new;
  end if;
  select count(*) into existing_count from public.tm_legacy_backups
    where user_id = new.user_id;
  if existing_count >= 20 then
    raise exception 'backup quota exceeded: maximum 20 snapshots per account'
      using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

revoke execute on function tm_private.limit_personal_backups() from public, anon, authenticated;
drop trigger if exists tm_backup_quota_guard on public.tm_legacy_backups;
create trigger tm_backup_quota_guard
before insert on public.tm_legacy_backups
for each row execute function tm_private.limit_personal_backups();

grant delete on public.tm_legacy_backups to authenticated;
create policy tm_legacy_backups_delete_own
on public.tm_legacy_backups for delete to authenticated
using ((select auth.uid()) = user_id);
