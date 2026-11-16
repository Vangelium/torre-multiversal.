-- Aplicada en Supabase como 20261111173201_tm_character_saves_guard_and_restrict_grants
-- Restablece permisos mínimos de la tabla por-personaje creada antes.
begin;
revoke all on table public.tm_character_saves from public, anon, authenticated;
grant select,insert,update on table public.tm_character_saves to authenticated;
create or replace function tm_private.tm_character_saves_guard()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  if new.user_id is distinct from old.user_id
     or new.profile_id is distinct from old.profile_id then
    raise exception 'character slot identity is immutable' using errcode='23514';
  end if;
  if new.revision <> old.revision + 1 then
    raise exception 'character slot revision must increment by exactly one' using errcode='23514';
  end if;
  new.updated_at := now();
  new.verified := false;
  return new;
end;
$$;
revoke all on function tm_private.tm_character_saves_guard() from public, anon, authenticated;
drop trigger if exists tm_character_saves_guard on public.tm_character_saves;
create trigger tm_character_saves_guard before update on public.tm_character_saves
 for each row execute function tm_private.tm_character_saves_guard();
commit;