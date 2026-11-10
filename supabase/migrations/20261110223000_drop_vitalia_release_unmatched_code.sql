-- Quita public.vitalia_release_unmatched_code(text, text).
-- El checkout ya no la llama: vitalia_prepare_coded_order crea o reconoce el pedido
-- en la misma transacción, y un error no libera la reserva.
-- NO APLICAR en producción ni en un proyecto remoto hasta la revisión de Sentinel.
-- No reactiva códigos y no toca las filas de vitalia_orders ni vitalia_welcome_codes.

begin;

drop function if exists public.vitalia_release_unmatched_code(text, text);

commit;
