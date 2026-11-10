-- Un pedido preparado por código guarda solo el hash de la reserva (no el código ni el mail).
-- Así un reintento del mismo intento reconoce el pedido ya creado y no abre otro uso.
-- NO APLICAR en producción sin la revisión de Sentinel. Aplicar esta migración ANTES de publicar
-- la versión de la app que escribe reservation_hash: si la columna no existe, el checkout con código
-- falla cerrado (503) y no libera la reserva.
-- No libera reservas viejas. Los pedidos anteriores no tienen este hash, así que no se puede saber
-- si una reserva ya tomada tiene un pedido real. No reactivar códigos en bloque.
-- Consulta de diagnóstico, solo lectura, para revisar a mano (no borra ni actualiza nada):
-- select c.id, c.redeemed_at is not null as reservado, c.expires_at < now() as vencido
--   from public.vitalia_welcome_codes c
--   order by c.id;

begin;

alter table public.vitalia_orders
  add column if not exists reservation_hash text
  check (reservation_hash is null or reservation_hash ~ '^[0-9a-f]{64}$');

create unique index if not exists vitalia_orders_reservation_hash_key
  on public.vitalia_orders (reservation_hash)
  where reservation_hash is not null;

commit;
