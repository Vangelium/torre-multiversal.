-- SQL extraído del historial de migraciones reales Supabase (20261111075939).
-- Ya aplicado; no ejecutar de nuevo manualmente.
create table if not exists public.tm_character_saves (
 user_id uuid not null references auth.users(id) on delete cascade,
 profile_id text not null check (length(profile_id) between 1 and 80),
 save_version smallint not null check (save_version between 0 and 99),
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and jsonb_typeof(payload->'raw')='string' and octet_length(payload::text) <= 1048576),
 fingerprint text not null check (fingerprint ~ '^sha256:[0-9a-f]{64}$'),
 revision bigint not null default 1 check(revision >= 1),
 verified boolean not null default false check (verified = false),
 updated_at timestamptz not null default now(),
 primary key(user_id,profile_id)
);
alter table public.tm_character_saves enable row level security;
grant select, insert, update on public.tm_character_saves to authenticated;
create policy "tm_character_saves_select_own" on public.tm_character_saves for select to authenticated using ((select auth.uid()) = user_id);
create policy "tm_character_saves_insert_own" on public.tm_character_saves for insert to authenticated with check ((select auth.uid()) = user_id and verified = false);
create policy "tm_character_saves_update_own" on public.tm_character_saves for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and verified = false);
