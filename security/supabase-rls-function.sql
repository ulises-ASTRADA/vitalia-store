-- Aplicado al proyecto Vitalia (ifcmfxqqiecudxaqddba) el 2026-10-12.
-- No cambia la función ni el event trigger; reduce permisos de ejecución.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

select has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE') as authenticated_execute;
-- Resultado verificado: false, false.
