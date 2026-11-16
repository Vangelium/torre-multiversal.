-- Aplicada 2026-11-12T00:14:34Z en Supabase cogwkcmlkurzagygnivy.
-- Exclusivamente permite al dueño borrar una ranura experimental antigua.
-- No autoriza borrar personajes vinculados ni manipular economía.
begin;
grant delete on table public.tm_cloud_saves to authenticated;
drop policy if exists tm_cloud_saves_delete_own on public.tm_cloud_saves;
create policy tm_cloud_saves_delete_own on public.tm_cloud_saves
 for delete to authenticated
 using ((select auth.uid()) = user_id);
commit;
