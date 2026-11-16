-- Version de migracion real: 20261110220121
-- Restringir acceso API RPC a la funcion del event trigger de auto-RLS.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
