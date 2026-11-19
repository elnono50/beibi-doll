-- =====================================================================
-- Beibi Doll — esquema completo
-- Precios en pesos argentinos enteros (sin centavos).
-- Cada prenda tiene variantes color + talle, cada una con su stock.
-- El stock se reserva al crear el pedido y se devuelve si el pedido
-- se cancela o vence sin pagarse. Nunca puede quedar negativo.
-- Correr una sola vez en Supabase > SQL Editor, antes que 0002_seed.sql.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Administradoras
-- ---------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

create policy "admins: lectura propia" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
-- Sin políticas de escritura: las administradoras se agregan sólo por SQL.

-- ---------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 400),
  image_url   text check (image_url is null or image_url ~ '^https://'),
  sort        integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name             text not null check (char_length(name) between 1 and 120),
  category_id      uuid references public.categories(id) on delete set null,
  price            integer not null check (price between 0 and 100000000),
  compare_at_price integer check (compare_at_price is null or compare_at_price between 0 and 100000000),
  -- [{"name":"Negro","hex":"#111111"}]; vacío = prenda sin elección de color
  colors           jsonb not null default '[]'::jsonb check (jsonb_typeof(colors) = 'array' and jsonb_array_length(colors) <= 20),
  description      text not null default '' check (char_length(description) <= 4000),
  details          text not null default '' check (char_length(details) <= 4000),
  care             text not null default '' check (char_length(care) <= 2000),
  weight_g         integer not null default 300 check (weight_g between 1 and 25000),
  featured         boolean not null default false,
  active           boolean not null default true,
  sort             integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);

create table public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null check (url ~ '^https://'),
  path       text,
  alt        text not null default '' check (char_length(alt) <= 200),
  color      text check (color is null or char_length(color) <= 40), -- foto de un color en particular
  sort       integer not null default 0
);
create index product_images_product_idx on public.product_images(product_id, sort);

create table public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  color      text not null default '' check (char_length(color) <= 40),
  size       text not null check (char_length(size) between 1 and 12),
  stock      integer not null default 0 check (stock >= 0 and stock <= 100000),
  sort       integer not null default 0,
  unique (product_id, color, size)
);
create index product_variants_product_idx on public.product_variants(product_id);

-- ---------------------------------------------------------------------
-- Ajustes del sitio (una sola fila)
-- ---------------------------------------------------------------------
create table public.settings (
  id         integer primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create type public.order_status as enum
  ('pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'expired');
create type public.payment_method as enum ('mercadopago', 'transfer', 'cash');

create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  number              bigint generated always as identity (start with 1001) unique,
  access_token        text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  user_id             uuid references auth.users(id) on delete set null,
  status              public.order_status not null default 'pending',
  payment_method      public.payment_method not null,
  customer_name       text not null,
  email               text not null,
  phone               text not null,
  dni                 text,
  shipping_method     text not null check (shipping_method in ('delivery', 'pickup')),
  shipping_zone       text,  -- opción elegida: "zona:<id>", "correo:D" o "correo:S"
  shipping_zone_label text,
  shipping_eta        text check (shipping_eta is null or char_length(shipping_eta) <= 120),
  shipping_branch     text check (shipping_branch is null or char_length(shipping_branch) <= 160),
  address             jsonb,
  notes               text,
  subtotal            integer not null check (subtotal >= 0),
  discount            integer not null default 0 check (discount >= 0),
  shipping_cost       integer not null default 0 check (shipping_cost >= 0),
  total               integer not null check (total >= 0),
  stock_reserved      boolean not null default true,
  stock_conflict      boolean not null default false,
  reserved_until      timestamptz,
  mp_preference_id    text,
  mp_payment_id       text unique,
  mp_status           text,
  tracking_code       text check (tracking_code is null or char_length(tracking_code) <= 120),
  admin_notes         text check (admin_notes is null or char_length(admin_notes) <= 2000),
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index orders_status_idx on public.orders(status, created_at desc);
create index orders_user_idx on public.orders(user_id, created_at desc);

create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  variant_id    uuid references public.product_variants(id) on delete set null,
  product_name  text not null,
  product_slug  text,
  image_url     text,
  color         text not null default '',
  size          text not null,
  variant_label text not null,  -- "Negro · Talle M"
  quantity      integer not null check (quantity between 1 and 20),
  unit_price    integer not null check (unit_price >= 0)
);
create index order_items_order_idx on public.order_items(order_id);

-- Botón de arrepentimiento (Res. SCI 424/2020)
create table public.withdrawal_requests (
  id           uuid primary key default gen_random_uuid(),
  order_number text not null check (char_length(order_number) <= 20),
  name         text not null check (char_length(name) <= 120),
  email        text not null check (char_length(email) <= 200),
  phone        text check (phone is null or char_length(phone) <= 40),
  reason       text check (reason is null or char_length(reason) <= 2000),
  code         text not null default upper(encode(extensions.gen_random_bytes(4), 'hex')),
  handled      boolean not null default false,
  created_at   timestamptz not null default now()
);

-- updated_at automático
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.categories          enable row level security;
alter table public.products            enable row level security;
alter table public.product_images      enable row level security;
alter table public.product_variants    enable row level security;
alter table public.settings            enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.withdrawal_requests enable row level security;

-- Lectura pública sólo de lo publicado
create policy "categorias: lectura" on public.categories
  for select to anon, authenticated using (active or public.is_admin());
create policy "productos: lectura" on public.products
  for select to anon, authenticated using (active or public.is_admin());
create policy "imagenes: lectura" on public.product_images
  for select to anon, authenticated using (
    public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.active)
  );
create policy "variantes: lectura" on public.product_variants
  for select to anon, authenticated using (
    public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.active)
  );
create policy "ajustes: lectura" on public.settings
  for select to anon, authenticated using (true);

-- Escritura sólo administradoras
create policy "categorias: admin" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "productos: admin" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "imagenes: admin" on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "variantes: admin" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ajustes: admin" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Pedidos: nadie del público lee ni escribe directo (todo pasa por el servidor)
create policy "pedidos: admin lee" on public.orders
  for select to authenticated using (public.is_admin());
create policy "pedidos: admin edita" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "items: admin lee" on public.order_items
  for select to authenticated using (public.is_admin());
create policy "arrepentimiento: admin lee" on public.withdrawal_requests
  for select to authenticated using (public.is_admin());
create policy "arrepentimiento: admin edita" on public.withdrawal_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- La administradora sólo puede editar seguimiento y notas; el estado
-- cambia únicamente con admin_set_order_status (que mueve el stock).
revoke insert, update, delete on public.orders from anon, authenticated;
grant update (tracking_code, admin_notes) on public.orders to authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, delete on public.withdrawal_requests from anon, authenticated;
revoke update on public.withdrawal_requests from anon, authenticated;
grant update (handled) on public.withdrawal_requests to authenticated;
revoke insert, delete on public.settings from anon, authenticated;
revoke all on public.admins from anon;
revoke insert, update, delete on public.admins from authenticated;

-- ---------------------------------------------------------------------
-- Stock: helpers internos
-- ---------------------------------------------------------------------
create or replace function public._restore_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  it record;
begin
  for it in select variant_id, quantity from public.order_items
            where order_id = p_order_id and variant_id is not null loop
    update public.product_variants set stock = stock + it.quantity where id = it.variant_id;
  end loop;
  update public.orders set stock_reserved = false where id = p_order_id;
end $$;

-- Devuelve false si no alcanza el stock (y no toca nada).
create or replace function public._reserve_order_stock(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  it record;
  ok integer;
begin
  for it in select variant_id, quantity from public.order_items where order_id = p_order_id loop
    if it.variant_id is null then
      raise exception 'sin_stock' using errcode = 'P0001';
    end if;
    update public.product_variants set stock = stock - it.quantity
      where id = it.variant_id and stock >= it.quantity;
    get diagnostics ok = row_count;
    if ok = 0 then
      raise exception 'sin_stock' using errcode = 'P0001';
    end if;
  end loop;
  update public.orders set stock_reserved = true where id = p_order_id;
  return true;
exception when sqlstate 'P0001' then
  return false;  -- el bloque se revierte entero
end $$;

revoke all on function public._restore_order_stock(uuid) from public, anon, authenticated;
revoke all on function public._reserve_order_stock(uuid) from public, anon, authenticated;

-- Libera reservas vencidas
create or replace function public.release_expired_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  n integer := 0;
begin
  for o in
    select id from public.orders
    where status = 'pending' and reserved_until is not null and reserved_until < now()
    for update skip locked
  loop
    if (select stock_reserved from public.orders where id = o.id) then
      perform public._restore_order_stock(o.id);
    end if;
    update public.orders set status = 'expired' where id = o.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.release_expired_orders() from public, anon, authenticated;
grant execute on function public.release_expired_orders() to service_role;

-- ---------------------------------------------------------------------
-- Crear pedido (sólo desde el servidor con service_role).
-- Precios, descuentos y zonas se calculan acá. La cotización del correo
-- la calcula el servidor (nunca el navegador) y llega en p.shipping.
-- ---------------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s            jsonb;
  item         jsonb;
  prod         public.products%rowtype;
  var          public.product_variants%rowtype;
  qty          integer;
  v_label      text;
  v_subtotal   integer := 0;
  v_discount   integer := 0;
  ship_cost    integer := 0;
  ship_opt     text;
  ship_label   text;
  ship_eta     text;
  zone         jsonb;
  v_grams      integer := 150;  -- embalaje
  v_province   text := p->'address'->>'province';
  free_from    integer;
  pm           text := p->>'payment_method';
  sm           text := p->'shipping'->>'method';
  new_id       uuid := gen_random_uuid();
  new_number   bigint;
  token        text;
  until_ts     timestamptz;
  img          text;
  pct          numeric;
  items_out    jsonb := '[]'::jsonb;
  ok           integer;
begin
  perform public.release_expired_orders();

  select data into s from public.settings where id = 1;
  if s is null then raise exception 'config_missing'; end if;

  if pm not in ('mercadopago', 'transfer', 'cash') then raise exception 'pago_invalido'; end if;
  if coalesce((s->'payments'->pm->>'enabled')::boolean, false) is not true then
    raise exception 'pago_no_disponible';
  end if;
  if sm not in ('delivery', 'pickup') then raise exception 'envio_invalido'; end if;
  if sm = 'pickup' and coalesce((s->'shipping'->'pickup'->>'enabled')::boolean, false) is not true then
    raise exception 'retiro_no_disponible';
  end if;
  if pm = 'cash' and sm <> 'pickup' then raise exception 'efectivo_solo_retiro'; end if;

  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0
     or jsonb_array_length(p->'items') > 30 then
    raise exception 'carrito_invalido';
  end if;

  insert into public.orders (
    id, status, payment_method, customer_name, email, phone, dni,
    shipping_method, address, shipping_branch, notes, subtotal, total
  ) values (
    new_id, 'pending', pm::public.payment_method,
    left(p->>'customer_name', 120), left(lower(p->>'email'), 200), left(p->>'phone', 40),
    nullif(left(p->>'dni', 12), ''),
    sm, case when sm = 'delivery' then p->'address' else null end,
    case when sm = 'delivery' then nullif(left(p->'shipping'->>'branch', 160), '') end,
    nullif(left(p->>'notes', 600), ''), 0, 0
  ) returning number, access_token into new_number, token;

  for item in select * from jsonb_array_elements(p->'items') loop
    qty := (item->>'quantity')::integer;
    if qty is null or qty < 1 or qty > 20 then raise exception 'cantidad_invalida'; end if;

    select * into var from public.product_variants where id = (item->>'variant_id')::uuid;
    if not found then raise exception 'talle_invalido'; end if;
    select * into prod from public.products where id = var.product_id and active;
    if not found then raise exception 'producto_no_disponible'; end if;

    -- Reserva atómica: si no alcanza, se revierte todo el pedido
    update public.product_variants set stock = stock - qty where id = var.id and stock >= qty;
    get diagnostics ok = row_count;
    if ok = 0 then
      raise exception 'sin_stock:%', prod.name;
    end if;

    v_label := case when var.color <> '' then var.color || ' · ' else '' end || 'Talle ' || var.size;

    select url into img from public.product_images
      where product_id = prod.id
      order by (color is not distinct from nullif(var.color, '')) desc, sort
      limit 1;

    insert into public.order_items
      (order_id, product_id, variant_id, product_name, product_slug, image_url, color, size, variant_label, quantity, unit_price)
    values
      (new_id, prod.id, var.id, prod.name, prod.slug, img, var.color, var.size, v_label, qty, prod.price);

    v_subtotal := v_subtotal + prod.price * qty;
    v_grams := v_grams + prod.weight_g * qty;
    items_out := items_out || jsonb_build_object(
      'id', prod.id, 'title', prod.name || ' (' || v_label || ')', 'quantity', qty, 'unit_price', prod.price
    );
  end loop;

  if pm = 'transfer' then
    pct := coalesce((s->'payments'->'transfer'->>'discount_pct')::numeric, 0);
    if pct > 0 and pct <= 50 then
      v_discount := floor(v_subtotal * pct / 100);
    end if;
  end if;

  if sm = 'delivery' then
    ship_opt := p->'shipping'->>'option';
    if ship_opt like 'zona:%' then
      -- Misma regla que lib/shipping.ts: la tarifa tiene que valer para la provincia
      -- (sin provincias marcadas = todo el país)
      select z into zone from jsonb_array_elements(s->'shipping'->'zones') z
        where z->>'id' = substr(ship_opt, 6) and coalesce((z->>'enabled')::boolean, true);
      if zone is null or v_province is null then raise exception 'zona_invalida'; end if;
      if jsonb_array_length(coalesce(zone->'provinces', '[]'::jsonb)) > 0
         and not (zone->'provinces') ? v_province then
        raise exception 'zona_invalida';
      end if;
      -- Precio por escalón de peso; si pesa más que el último, el precio base
      select (t->>'price')::integer into ship_cost
        from jsonb_array_elements(coalesce(zone->'tiers', '[]'::jsonb)) t
        where v_grams <= (t->>'max_g')::integer
        order by (t->>'max_g')::integer
        limit 1;
      ship_cost := greatest(0, coalesce(ship_cost, (zone->>'price')::integer));
      ship_label := zone->>'label';
      ship_eta := nullif(zone->>'detail', '');
      if coalesce((zone->>'branch')::boolean, false) and coalesce(p->'shipping'->>'branch', '') = '' then
        raise exception 'falta_sucursal';
      end if;
    elsif ship_opt in ('correo:D', 'correo:S') then
      -- Cotización hecha por el servidor contra la API del correo
      ship_cost := (p->'shipping'->>'price')::integer;
      if ship_cost is null or ship_cost < 0 or ship_cost > 10000000 then raise exception 'zona_invalida'; end if;
      ship_label := left(coalesce(p->'shipping'->>'label', 'Correo Argentino'), 80);
      if ship_opt = 'correo:S' and coalesce(p->'shipping'->>'branch', '') = '' then
        raise exception 'falta_sucursal';
      end if;
      ship_eta := nullif(left(p->'shipping'->>'eta', 120), '');
    else
      raise exception 'zona_invalida';
    end if;
    free_from := nullif(s->'shipping'->>'free_from', '')::integer;
    if free_from is not null and free_from > 0 and (v_subtotal - v_discount) >= free_from then
      ship_cost := 0;
    end if;
  end if;

  until_ts := now() + case pm
    when 'mercadopago' then interval '45 minutes'
    when 'transfer'    then interval '48 hours'
    else                    interval '72 hours'
  end;

  update public.orders set
    subtotal = v_subtotal,
    discount = v_discount,
    shipping_cost = ship_cost,
    total = v_subtotal - v_discount + ship_cost,
    shipping_zone = case when sm = 'delivery' then ship_opt end,
    shipping_zone_label = case when sm = 'delivery' then ship_label end,
    shipping_eta = case when sm = 'delivery' then ship_eta end,
    reserved_until = until_ts
  where id = new_id;

  return jsonb_build_object(
    'id', new_id, 'number', new_number, 'access_token', token,
    'subtotal', v_subtotal, 'discount', v_discount, 'shipping_cost', ship_cost,
    'total', v_subtotal - v_discount + ship_cost, 'reserved_until', until_ts,
    'items', items_out
  );
end $$;
revoke all on function public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;

-- ---------------------------------------------------------------------
-- Límites contra el acaparamiento de stock
-- ---------------------------------------------------------------------
-- Máximo 3 pedidos sin pagar a la vez por email o por teléfono
create or replace function public.limit_pending_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  select count(*) into n from public.orders
    where status = 'pending'
      and (lower(email) = lower(new.email) or phone = new.phone);
  if n >= 3 then
    raise exception 'demasiados_pendientes';
  end if;
  return new;
end $$;
create trigger orders_limit_pending
  before insert on public.orders
  for each row execute function public.limit_pending_orders();

-- Máximo 12 prendas por pedido
create or replace function public.limit_order_units()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select coalesce(sum(quantity), 0) from public.order_items where order_id = new.order_id) > 12 then
    raise exception 'demasiadas_unidades';
  end if;
  return new;
end $$;
create trigger order_items_limit_units
  after insert on public.order_items
  for each row execute function public.limit_order_units();

revoke all on function public.limit_pending_orders() from public, anon, authenticated;
revoke all on function public.limit_order_units() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Marcar pagado (webhook de Mercado Pago, sólo service_role). Idempotente.
-- ---------------------------------------------------------------------
create or replace function public.mark_order_paid(p_order_id uuid, p_payment_id text, p_amount numeric)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then return 'not_found'; end if;
  if o.status not in ('pending', 'expired') then return 'already'; end if;
  if p_amount < o.total then return 'amount_mismatch'; end if;

  if not o.stock_reserved then
    if not public._reserve_order_stock(o.id) then
      -- Pagó tarde y ya no hay stock: queda pagado pero marcado para revisar
      update public.orders set stock_conflict = true where id = o.id;
    end if;
  end if;

  update public.orders set
    status = 'paid', paid_at = now(), mp_payment_id = p_payment_id, mp_status = 'approved'
  where id = o.id;
  return 'ok';
end $$;
revoke all on function public.mark_order_paid(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.mark_order_paid(uuid, text, numeric) to service_role;

-- ---------------------------------------------------------------------
-- Cambio de estado desde el panel (verifica que sea administradora)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_order_status(p_order_id uuid, p_status public.order_status)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
begin
  if not public.is_admin() then raise exception 'no_autorizado'; end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'pedido_inexistente'; end if;
  if o.status = p_status then return 'sin_cambios'; end if;

  if p_status in ('cancelled', 'expired') then
    if o.status in ('shipped', 'delivered') then raise exception 'ya_enviado'; end if;
    if o.stock_reserved then perform public._restore_order_stock(o.id); end if;
    update public.orders set status = p_status where id = o.id;
    return 'ok';
  end if;

  if p_status = 'pending' then raise exception 'transicion_invalida'; end if;

  -- paid / preparing / shipped / delivered: el stock tiene que estar tomado
  if not o.stock_reserved then
    if not public._reserve_order_stock(o.id) then raise exception 'sin_stock'; end if;
  end if;

  update public.orders set
    status = p_status,
    -- Un pedido en efectivo "listo para retirar" todavía no está pagado
    paid_at = case
      when p_status = 'preparing' and o.payment_method = 'cash' then o.paid_at
      else coalesce(o.paid_at, now())
    end,
    reserved_until = null
  where id = o.id;
  return 'ok';
end $$;
revoke all on function public.admin_set_order_status(uuid, public.order_status) from public, anon;
grant execute on function public.admin_set_order_status(uuid, public.order_status) to authenticated;

-- Al pagar ya no vence
create or replace function public.clear_reservation_on_paid()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status <> 'pending' and old.status = 'pending' then
    new.reserved_until := null;
  end if;
  return new;
end $$;
create trigger orders_clear_reservation before update of status on public.orders
  for each row execute function public.clear_reservation_on_paid();

-- Cancelación automática desde el servidor (p. ej. si falla Mercado Pago)
create or replace function public.system_cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.status <> 'pending' then return; end if;
  if o.stock_reserved then perform public._restore_order_stock(o.id); end if;
  update public.orders set status = 'cancelled' where id = o.id;
end $$;
revoke all on function public.system_cancel_order(uuid) from public, anon, authenticated;
grant execute on function public.system_cancel_order(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Storage: bucket público de lectura, escritura sólo administradoras
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "media: admin sube" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "media: admin edita" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "media: admin borra" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "media: admin lista" on storage.objects
  for select to authenticated using (bucket_id = 'media' and public.is_admin());

-- ---------------------------------------------------------------------
-- Guardado atómico de producto desde el panel (respeta RLS: security invoker)
-- ---------------------------------------------------------------------
create or replace function public.admin_save_product(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id     uuid := nullif(p->>'id', '')::uuid;
  v        jsonb;
  keep     uuid[];
begin
  if not public.is_admin() then raise exception 'no_autorizado'; end if;

  if v_id is null then
    insert into public.products (
      slug, name, category_id, price, compare_at_price, colors,
      description, details, care, weight_g, featured, active, sort
    ) values (
      p->>'slug', p->>'name', nullif(p->>'category_id', '')::uuid,
      (p->>'price')::integer, (p->>'compare_at_price')::integer, coalesce(p->'colors', '[]'::jsonb),
      coalesce(p->>'description', ''), coalesce(p->>'details', ''), coalesce(p->>'care', ''),
      coalesce((p->>'weight_g')::integer, 300),
      coalesce((p->>'featured')::boolean, false), coalesce((p->>'active')::boolean, true),
      coalesce((p->>'sort')::integer, 0)
    ) returning id into v_id;
  else
    update public.products set
      slug = p->>'slug',
      name = p->>'name',
      category_id = nullif(p->>'category_id', '')::uuid,
      price = (p->>'price')::integer,
      compare_at_price = (p->>'compare_at_price')::integer,
      colors = coalesce(p->'colors', '[]'::jsonb),
      description = coalesce(p->>'description', ''),
      details = coalesce(p->>'details', ''),
      care = coalesce(p->>'care', ''),
      weight_g = coalesce((p->>'weight_g')::integer, 300),
      featured = coalesce((p->>'featured')::boolean, false),
      active = coalesce((p->>'active')::boolean, true),
      sort = coalesce((p->>'sort')::integer, 0)
    where id = v_id;
    if not found then raise exception 'producto_inexistente'; end if;
  end if;

  -- Colores y talles / stock
  keep := array(
    select (x->>'id')::uuid from jsonb_array_elements(p->'variants') x where nullif(x->>'id', '') is not null
  );
  delete from public.product_variants where product_id = v_id and not (id = any(keep));
  for v in select * from jsonb_array_elements(p->'variants') loop
    if nullif(v->>'id', '') is null then
      insert into public.product_variants (product_id, color, size, stock, sort)
      values (v_id, coalesce(v->>'color', ''), v->>'size', (v->>'stock')::integer, coalesce((v->>'sort')::integer, 0));
    else
      update public.product_variants set
        color = coalesce(v->>'color', ''),
        size = v->>'size',
        -- Se aplica la diferencia y no el valor absoluto: si entró una venta
        -- mientras se editaba, no se pisa.
        stock = case
          when v ? 'stock_was' then greatest(0, stock + (v->>'stock')::integer - (v->>'stock_was')::integer)
          else (v->>'stock')::integer
        end,
        sort = coalesce((v->>'sort')::integer, 0)
      where id = (v->>'id')::uuid and product_id = v_id;
    end if;
  end loop;

  -- Fotos
  keep := array(
    select (x->>'id')::uuid from jsonb_array_elements(p->'images') x where nullif(x->>'id', '') is not null
  );
  delete from public.product_images where product_id = v_id and not (id = any(keep));
  for v in select * from jsonb_array_elements(p->'images') loop
    if nullif(v->>'id', '') is null then
      insert into public.product_images (product_id, url, path, alt, color, sort)
      values (v_id, v->>'url', nullif(v->>'path', ''), coalesce(v->>'alt', ''), nullif(v->>'color', ''), coalesce((v->>'sort')::integer, 0));
    else
      update public.product_images set
        alt = coalesce(v->>'alt', ''),
        color = nullif(v->>'color', ''),
        sort = coalesce((v->>'sort')::integer, 0)
      where id = (v->>'id')::uuid and product_id = v_id;
    end if;
  end loop;

  return v_id;
end $$;
revoke all on function public.admin_save_product(jsonb) from public, anon;
grant execute on function public.admin_save_product(jsonb) to authenticated;

-- Reposición rápida desde la pantalla de stock: suma/resta diferencias
create or replace function public.admin_adjust_stock(p jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then raise exception 'no_autorizado'; end if;
  for v in select * from jsonb_array_elements(p) loop
    update public.product_variants
      set stock = greatest(0, stock + (v->>'delta')::integer)
      where id = (v->>'id')::uuid;
  end loop;
end $$;
revoke all on function public.admin_adjust_stock(jsonb) from public, anon;
grant execute on function public.admin_adjust_stock(jsonb) to authenticated;

-- =====================================================================
-- Cuentas de clientas y novedades
-- =====================================================================
create table public.customers (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  name             text not null default '' check (char_length(name) <= 120),
  phone            text not null default '' check (char_length(phone) <= 40),
  marketing_opt_in boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.customers enable row level security;

create policy "clientas: ve su perfil" on public.customers
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
create policy "clientas: edita su perfil" on public.customers
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, delete on public.customers from anon, authenticated;
revoke all on public.customers from anon;

create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

-- Lista de novedades (con o sin cuenta). Consentimiento explícito, Ley 25.326.
create table public.subscribers (
  id               uuid primary key default gen_random_uuid(),
  email            text not null unique check (char_length(email) between 5 and 200),
  name             text not null default '' check (char_length(name) <= 120),
  source           text not null default 'web' check (source in ('web', 'cuenta', 'checkout')),
  consent_at       timestamptz not null default now(),
  unsubscribed_at  timestamptz,
  unsubscribe_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at       timestamptz not null default now()
);
alter table public.subscribers enable row level security;
create policy "suscriptoras: admin lee" on public.subscribers
  for select to authenticated using (public.is_admin());
revoke all on public.subscribers from anon;
revoke insert, update, delete on public.subscribers from authenticated;

create or replace function public.subscribe(p_email text, p_name text, p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscribers (email, name, source)
  values (lower(trim(p_email)), left(coalesce(p_name, ''), 120), p_source)
  on conflict (email) do update set
    unsubscribed_at = null,
    consent_at = now(),
    name = case when excluded.name <> '' then excluded.name else public.subscribers.name end;
end $$;
revoke all on function public.subscribe(text, text, text) from public, anon, authenticated;
grant execute on function public.subscribe(text, text, text) to service_role;

create or replace function public.unsubscribe(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  update public.subscribers set unsubscribed_at = now()
    where unsubscribe_token = p_token and unsubscribed_at is null
    returning email into v_email;
  if v_email is null then
    return exists (select 1 from public.subscribers where unsubscribe_token = p_token);
  end if;
  update public.customers c set marketing_opt_in = false
    from auth.users u where u.id = c.user_id and lower(u.email) = v_email;
  return true;
end $$;
revoke all on function public.unsubscribe(text) from public, anon, authenticated;
grant execute on function public.unsubscribe(text) to service_role;

-- Al registrarse: crear el perfil y, si aceptó, sumarla a novedades
create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opt boolean := coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false);
begin
  insert into public.customers (user_id, name, phone, marketing_opt_in)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data->>'name', ''), 120),
    left(coalesce(new.raw_user_meta_data->>'phone', ''), 40),
    v_opt
  )
  on conflict (user_id) do nothing;
  if v_opt and new.email is not null then
    perform public.subscribe(new.email, coalesce(new.raw_user_meta_data->>'name', ''), 'cuenta');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_customer
  after insert on auth.users
  for each row execute function public.handle_new_customer();

-- Mantener la lista de novedades sincronizada con el perfil
create or replace function public.sync_customer_marketing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if new.marketing_opt_in is distinct from old.marketing_opt_in then
    select email into v_email from auth.users where id = new.user_id;
    if v_email is null then return new; end if;
    if new.marketing_opt_in then
      perform public.subscribe(v_email, new.name, 'cuenta');
    else
      update public.subscribers set unsubscribed_at = now()
        where email = lower(v_email) and unsubscribed_at is null;
    end if;
  end if;
  return new;
end $$;
create trigger customers_marketing_sync
  after update of marketing_opt_in on public.customers
  for each row execute function public.sync_customer_marketing();

-- Vincula el pedido a la cuenta (sólo el servidor, después de validar la sesión)
create or replace function public.link_order_to_user(p_order_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.orders set user_id = p_user_id where id = p_order_id and user_id is null;
$$;
revoke all on function public.link_order_to_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_order_to_user(uuid, uuid) to service_role;

-- Historial de mails de novedades enviados desde el panel
create table public.email_campaigns (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null check (char_length(subject) between 1 and 150),
  title       text not null default '' check (char_length(title) <= 120),
  content     jsonb not null default '{}'::jsonb,
  recipients  integer not null default 0,
  sent        integer not null default 0,
  error       text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.email_campaigns enable row level security;
create policy "campañas: admin" on public.email_campaigns
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.email_campaigns from anon;

-- =====================================================================
-- "Avisame cuando vuelva" (por color + talle)
-- =====================================================================
create table public.stock_alerts (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (char_length(email) between 5 and 200),
  product_id  uuid not null references public.products(id) on delete cascade,
  variant_id  uuid not null references public.product_variants(id) on delete cascade,
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);
create unique index stock_alerts_pending_uniq
  on public.stock_alerts (lower(email), variant_id) where notified_at is null;
create index stock_alerts_variant_idx on public.stock_alerts (variant_id) where notified_at is null;

alter table public.stock_alerts enable row level security;
create policy "avisos: admin lee" on public.stock_alerts
  for select to authenticated using (public.is_admin());
revoke all on public.stock_alerts from anon;
revoke insert, update, delete on public.stock_alerts from authenticated;

create or replace function public.create_stock_alert(p_email text, p_variant_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product uuid;
  v_stock integer;
begin
  select v.product_id, v.stock into v_product, v_stock
    from public.product_variants v join public.products p on p.id = v.product_id
    where v.id = p_variant_id and p.active;
  if v_product is null then return 'no_existe'; end if;
  if v_stock > 0 then return 'hay_stock'; end if;
  if (select count(*) from public.stock_alerts where lower(email) = lower(trim(p_email)) and notified_at is null) >= 10 then
    return 'demasiados';
  end if;
  insert into public.stock_alerts (email, product_id, variant_id)
    values (lower(trim(p_email)), v_product, p_variant_id)
    on conflict do nothing;
  return 'ok';
end $$;
revoke all on function public.create_stock_alert(text, uuid) from public, anon, authenticated;
grant execute on function public.create_stock_alert(text, uuid) to service_role;
