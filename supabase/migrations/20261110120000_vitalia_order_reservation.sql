-- Pedido con código: hash de la reserva y hash del contenido, más dos funciones atómicas.
-- NO APLICAR en producción sin la revisión de Sentinel.
-- No guarda el código, el mail ni el nombre. payload_hash solo sirve para saber si un reintento
-- es el mismo pedido. No reactiva códigos viejos: una reserva ya tomada no se suelta en bloque.
--
-- vitalia_prepare_coded_order toma la fila del código con FOR UPDATE y, en la misma transacción,
-- inserta el pedido o reconoce el que ya existe. vitalia_release_unmatched_code usa el mismo
-- bloqueo y no borra la reserva si hay pedido. Un error de la función revierte todo: no se libera
-- nada cuando la lectura o la escritura es incierta.
-- El índice único de reservation_hash impide dos filas con el mismo token. El uso único del cupón
-- lo da el bloqueo de la fila del código, no ese índice.

begin;

alter table public.vitalia_orders
  add column if not exists reservation_hash text
  check (reservation_hash is null or reservation_hash ~ '^[0-9a-f]{64}$');

alter table public.vitalia_orders
  add column if not exists payload_hash text
  check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$');

create unique index if not exists vitalia_orders_reservation_hash_key
  on public.vitalia_orders (reservation_hash)
  where reservation_hash is not null;

create or replace function public.vitalia_prepare_coded_order(
  p_code_hash text,
  p_reservation_hash text,
  p_payload_hash text,
  p_subtotal_cents bigint,
  p_suggestion_cents bigint,
  p_bulk_cents bigint,
  p_code_cents bigint,
  p_total_cents bigint,
  p_free_shipping boolean,
  p_items jsonb,
  p_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_code public.vitalia_welcome_codes%rowtype;
  v_order public.vitalia_orders%rowtype;
  v_ref text;
begin
  if p_code_hash !~ '^[0-9a-f]{64}$' or p_reservation_hash !~ '^[0-9a-f]{64}$' or p_payload_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status','invalid');
  end if;
  select * into v_code
    from public.vitalia_welcome_codes
   where code_hash = p_code_hash
   for update;
  if not found or v_code.expires_at <= p_at then
    return jsonb_build_object('status','invalid');
  end if;
  if v_code.redeemed_at is not null and v_code.reservation_hash is distinct from p_reservation_hash then
    return jsonb_build_object('status','used');
  end if;
  select * into v_order
    from public.vitalia_orders
   where reservation_hash = p_reservation_hash
   for update;
  if found then
    if v_order.payload_hash is distinct from p_payload_hash
       or v_order.items is distinct from p_items
       or v_order.subtotal_cents is distinct from p_subtotal_cents
       or v_order.suggestion_cents is distinct from p_suggestion_cents
       or v_order.bulk_cents is distinct from p_bulk_cents
       or v_order.code_cents is distinct from p_code_cents
       or v_order.total_cents is distinct from p_total_cents
       or v_order.free_shipping is distinct from p_free_shipping then
      return jsonb_build_object('status','mismatch','ref', v_order.ref);
    end if;
    return jsonb_build_object('status','exists','ref', v_order.ref);
  end if;
  update public.vitalia_welcome_codes
     set redeemed_at = p_at,
         reservation_hash = p_reservation_hash
   where id = v_code.id;
  insert into public.vitalia_orders (
    subtotal_cents, suggestion_cents, bulk_cents, code_cents, total_cents,
    free_shipping, used_code, items, reservation_hash, payload_hash
  ) values (
    p_subtotal_cents, p_suggestion_cents, p_bulk_cents, p_code_cents, p_total_cents,
    p_free_shipping, true, p_items, p_reservation_hash, p_payload_hash
  )
  returning ref into v_ref;
  return jsonb_build_object('status','created','ref', v_ref);
end;
$$;

create or replace function public.vitalia_release_unmatched_code(
  p_code_hash text,
  p_reservation_hash text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_code_hash !~ '^[0-9a-f]{64}$' or p_reservation_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status','kept');
  end if;
  select id into v_id
    from public.vitalia_welcome_codes
   where code_hash = p_code_hash
   for update;
  if v_id is null then
    return jsonb_build_object('status','missing');
  end if;
  if not exists (
    select 1 from public.vitalia_welcome_codes
     where id = v_id and reservation_hash = p_reservation_hash
  ) then
    return jsonb_build_object('status','kept');
  end if;
  if exists (
    select 1 from public.vitalia_orders
     where reservation_hash = p_reservation_hash
  ) then
    return jsonb_build_object('status','kept');
  end if;
  update public.vitalia_welcome_codes
     set redeemed_at = null,
         reservation_hash = null
   where id = v_id
     and reservation_hash = p_reservation_hash
     and not exists (
       select 1 from public.vitalia_orders
        where reservation_hash = p_reservation_hash
     );
  return jsonb_build_object('status','released');
end;
$$;

revoke all on function public.vitalia_prepare_coded_order(text,text,text,bigint,bigint,bigint,bigint,bigint,boolean,jsonb,timestamptz) from public;
revoke all on function public.vitalia_release_unmatched_code(text,text) from public;

do $grant$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.vitalia_prepare_coded_order(text,text,text,bigint,bigint,bigint,bigint,bigint,boolean,jsonb,timestamptz) from anon';
    execute 'revoke all on function public.vitalia_release_unmatched_code(text,text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.vitalia_prepare_coded_order(text,text,text,bigint,bigint,bigint,bigint,bigint,boolean,jsonb,timestamptz) from authenticated';
    execute 'revoke all on function public.vitalia_release_unmatched_code(text,text) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.vitalia_prepare_coded_order(text,text,text,bigint,bigint,bigint,bigint,bigint,boolean,jsonb,timestamptz) to service_role';
    execute 'grant execute on function public.vitalia_release_unmatched_code(text,text) to service_role';
  end if;
end
$grant$;

commit;
