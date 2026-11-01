-- Vitalia growth pack: suscriptores del popup, códigos de bienvenida, pedidos y carritos abandonados.
-- NO APLICAR sin la revisión de seguridad. El proyecto de Supabase es compartido: todo va con prefijo vitalia_.
-- Acceso: solo la service role desde el servidor (Next.js). RLS activado y sin políticas = anon/authenticated
-- no ven nada; además se revocan los permisos de tabla y secuencia para esos roles.

begin;

create table if not exists public.vitalia_subscribers (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 6 and 254 and email = lower(email)),
  consent_text text not null,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  cart_token_hash text not null unique check (cart_token_hash ~ '^[0-9a-f]{64}$'),
  unsub_token_hash text not null unique check (unsub_token_hash ~ '^[0-9a-f]{64}$'),
  constraint vitalia_subscribers_email_key unique (email)
);

-- Solo se guarda el hash SHA-256 del código: una filtración de la tabla no da códigos usables.
create table if not exists public.vitalia_welcome_codes (
  id bigint generated always as identity primary key,
  subscriber_id bigint not null unique references public.vitalia_subscribers(id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  reservation_hash text check (reservation_hash is null or reservation_hash ~ '^[0-9a-f]{64}$'),
  check ((redeemed_at is null) = (reservation_hash is null))
);

-- Pedidos preparados en el sitio (montos calculados en el servidor). El número de referencia sale del id.
-- Sin datos personales: ni nombre, ni mail, ni dirección, ni el código (tampoco su hash, para no poder cruzarlo
-- con el suscriptor). Solo fecha, montos, si se usó código y qué descuentos aplicaron.
create table if not exists public.vitalia_orders (
  id bigint generated always as identity primary key,
  ref text generated always as ('V-' || lpad(id::text, 4, '0')) stored unique,
  created_at timestamptz not null default now(),
  subtotal_cents bigint not null check (subtotal_cents >= 0),
  suggestion_cents bigint not null default 0 check (suggestion_cents >= 0),
  bulk_cents bigint not null default 0 check (bulk_cents >= 0),
  code_cents bigint not null default 0 check (code_cents >= 0),
  total_cents bigint not null check (total_cents >= 0),
  free_shipping boolean not null,
  used_code boolean not null default false,
  discounts_applied text[] generated always as (array_remove(array[
    case when suggestion_cents > 0 then 'sugerencia_10' end,
    case when bulk_cents > 0 then 'compra_400k_10' end,
    case when code_cents > 0 then 'codigo_bienvenida_10' end
  ], null)) stored,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50)
);

-- Carrito abandonado: solo de suscriptores con consentimiento y sin baja (lo controla el servidor).
create table if not exists public.vitalia_abandoned_carts (
  subscriber_id bigint primary key references public.vitalia_subscribers(id) on delete cascade,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50),
  updated_at timestamptz not null default now(),
  converted_at timestamptz
);

-- Los carritos abandonados vencen a los 90 días (desde la última actualización).
create index if not exists vitalia_abandoned_carts_updated_at_idx on public.vitalia_abandoned_carts (updated_at);

create or replace function public.vitalia_purge_abandoned_carts()
returns integer
language sql
security invoker
set search_path = ''
as $$
  with gone as (
    delete from public.vitalia_abandoned_carts
     where updated_at < now() - interval '90 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;

-- La función está en public, así que PostgREST la expondría como RPC: solo la puede ejecutar la service role.
revoke all on function public.vitalia_purge_abandoned_carts() from public, anon, authenticated;
grant execute on function public.vitalia_purge_abandoned_carts() to service_role;

-- Limpieza diaria (03:15 UTC = 00:15 en Córdoba) con pg_cron, solo si la extensión ya está activa.
-- Si no lo está: activarla en Supabase (Database > Extensions > pg_cron) y correr este mismo cron.schedule,
-- o llamar a la función desde un job del servidor.
do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('vitalia-purge-abandoned-carts', '15 3 * * *', 'select public.vitalia_purge_abandoned_carts()');
  else
    raise notice 'pg_cron no está activo: programar public.vitalia_purge_abandoned_carts() a mano';
  end if;
end
$do$;

alter table public.vitalia_subscribers enable row level security;
alter table public.vitalia_welcome_codes enable row level security;
alter table public.vitalia_orders enable row level security;
alter table public.vitalia_abandoned_carts enable row level security;

revoke all on table public.vitalia_subscribers, public.vitalia_welcome_codes, public.vitalia_orders, public.vitalia_abandoned_carts from anon, authenticated, public;
revoke all on sequence public.vitalia_subscribers_id_seq, public.vitalia_welcome_codes_id_seq, public.vitalia_orders_id_seq from anon, authenticated, public;

grant select, insert, update, delete on table public.vitalia_subscribers, public.vitalia_welcome_codes, public.vitalia_orders, public.vitalia_abandoned_carts to service_role;
grant usage, select on sequence public.vitalia_subscribers_id_seq, public.vitalia_welcome_codes_id_seq, public.vitalia_orders_id_seq to service_role;

-- Sin políticas para anon/authenticated a propósito. La service role ignora RLS (bypassrls).

commit;

-- Verificación sugerida después de aplicar (debe devolver 0 filas):
-- select table_name, grantee, privilege_type from information_schema.role_table_grants
--  where table_name like 'vitalia\_%' and grantee in ('anon','authenticated');
