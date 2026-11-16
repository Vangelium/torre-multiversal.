-- SQL extraído del historial de migraciones reales Supabase (20261111080304).
-- Ya aplicado; no ejecutar de nuevo manualmente.
revoke all on table public.tm_character_saves from anon; revoke all on table public.tm_character_saves from public; grant select, insert, update on table public.tm_character_saves to authenticated;
