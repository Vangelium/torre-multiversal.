-- Applied in Supabase as tm_optional_cloud_slot_cas_20261110.
-- One optional, non-authoritative CAS save slot per authenticated user.
create table if not exists public.tm_cloud_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_id text not null check (length(profile_id) between 1 and 80),
  save_version smallint not null check (save_version between 0 and 99),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and jsonb_typeof(payload->'raw') = 'string'
    and octet_length(payload::text) <= 1048576
  ),
  fingerprint text not null check (fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  revision bigint not null default 1 check (revision >= 1),
  verified boolean not null default false check (verified = false),
  updated_at timestamptz not null default now()
);
alter table public.tm_cloud_saves enable row level security;
revoke all on public.tm_cloud_saves from public, anon, authenticated;
grant select,insert,update on public.tm_cloud_saves to authenticated;
create policy tm_cloud_saves_select_own on public.tm_cloud_saves for select to authenticated
  using ((select auth.uid()) = user_id);
create policy tm_cloud_saves_insert_own on public.tm_cloud_saves for insert to authenticated
  with check ((select auth.uid()) = user_id and verified = false);
create policy tm_cloud_saves_update_own on public.tm_cloud_saves for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and verified = false);
create or replace function tm_private.tm_cloud_revision_guard()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if new.user_id is distinct from old.user_id
    or new.profile_id is distinct from old.profile_id then
    raise exception 'cloud save identity is immutable' using errcode = '23514';
  end if;
  if new.revision <> old.revision + 1 then
    raise exception 'cloud save revision must increase by exactly one' using errcode = '23514';
  end if;
  new.updated_at := now();
  new.verified := false;
  return new;
end;
$$;
revoke execute on function tm_private.tm_cloud_revision_guard() from public, anon, authenticated;
drop trigger if exists tm_cloud_revision_guard on public.tm_cloud_saves;
create trigger tm_cloud_revision_guard before update on public.tm_cloud_saves
  for each row execute function tm_private.tm_cloud_revision_guard();
