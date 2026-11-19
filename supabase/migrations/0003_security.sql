-- =====================================================================
-- Beibi Doll · 0003 · Refuerzos de seguridad
--   1. El panel exige verificación en dos pasos (aal2) también en la base
--   2. Límite de intentos compartido entre servidores
--   3. Cupo diario de mails (las novedades nunca dejan sin mails de compra)
--   4. Novedades que se envían en tandas cuando el cupo no alcanza
--   5. Registro de cambios sensibles (datos de cobro, administradoras)
-- Correr después de 0001 y 0002. Se puede volver a correr sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Administradora = está en la lista Y entró con el segundo paso.
--    Aunque alguien robe la contraseña, sin el código del celular la base
--    no le deja leer pedidos ni cambiar nada.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
     and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- La lectura de la propia fila sigue funcionando con un solo paso: el panel la
-- usa para saber si tiene que pedir el código.

-- ---------------------------------------------------------------------
-- 2. Límite de intentos (checkout, suscripción, avisos, arrepentimiento).
--    La clave llega ya resumida (hash), nunca la IP en claro.
-- ---------------------------------------------------------------------
create table if not exists public.rate_limits (
  key       text primary key check (char_length(key) <= 200),
  hits      integer not null default 0,
  reset_at  timestamptz not null
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.rate_hit(p_key text, p_limit integer, p_window_s integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  if p_key is null or char_length(p_key) > 200 or p_limit < 1 or p_window_s < 1 then
    return false;
  end if;
  insert into public.rate_limits as r (key, hits, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_s))
  on conflict (key) do update
    set hits = case when r.reset_at < now() then 1 else r.hits + 1 end,
        reset_at = case when r.reset_at < now() then now() + make_interval(secs => p_window_s) else r.reset_at end
  returning hits into v_hits;

  -- limpieza ocasional de claves vencidas
  if random() < 0.02 then
    delete from public.rate_limits where reset_at < now() - interval '1 hour';
  end if;
  return v_hits <= p_limit;
end;
$$;
revoke all on function public.rate_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_hit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- 3. Cupo diario de mails (el plan gratis de Resend permite 100 por día).
--    Los mails de compra siempre salen; las novedades sólo usan lo que
--    sobra después de dejar una reserva para compras del resto del día.
-- ---------------------------------------------------------------------
create table if not exists public.email_usage (
  day   date primary key,
  sent  integer not null default 0
);
alter table public.email_usage enable row level security;
drop policy if exists "uso de mails: admin lee" on public.email_usage;
create policy "uso de mails: admin lee" on public.email_usage
  for select to authenticated using (public.is_admin());
revoke all on public.email_usage from anon;
revoke insert, update, delete on public.email_usage from authenticated;

-- p_limit = 0 significa sin tope (plan pago).
create or replace function public.email_quota_take(p_want integer, p_limit integer, p_reserve integer, p_bulk boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'utc')::date;   -- Resend reinicia el cupo a medianoche UTC
  v_sent integer;
  v_grant integer;
begin
  if p_want < 1 then return 0; end if;
  insert into public.email_usage (day, sent) values (v_day, 0) on conflict (day) do nothing;
  select sent into v_sent from public.email_usage where day = v_day for update;

  if not p_bulk or p_limit <= 0 then
    v_grant := p_want;                                -- compras: siempre
  else
    v_grant := greatest(0, least(p_want, p_limit - greatest(p_reserve, 0) - v_sent));
  end if;

  update public.email_usage set sent = sent + v_grant where day = v_day;
  delete from public.email_usage where day < v_day - 60;
  return v_grant;
end;
$$;
revoke all on function public.email_quota_take(integer, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.email_quota_take(integer, integer, integer, boolean) to service_role;

-- ---------------------------------------------------------------------
-- 4. Novedades en tandas: si hoy no alcanza el cupo, sigue mañana sola.
-- ---------------------------------------------------------------------
alter table public.email_campaigns
  add column if not exists status text not null default 'done'
    check (status in ('sending', 'done', 'error')),
  add column if not exists last_sub_id uuid,
  add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------
-- 5. Registro de cambios sensibles. Lo escribe la base sola (trigger),
--    nadie puede editarlo ni borrarlo desde la tienda.
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,
  actor_email text,
  action      text not null,
  detail      jsonb not null default '{}'::jsonb
);
alter table public.audit_log enable row level security;
drop policy if exists "registro: admin lee" on public.audit_log;
create policy "registro: admin lee" on public.audit_log
  for select to authenticated using (public.is_admin());
revoke all on public.audit_log from anon;
revoke insert, update, delete on public.audit_log from authenticated;

create or replace function public.audit_settings_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  o jsonb := coalesce(old.data -> 'payments', '{}'::jsonb);
  n jsonb := coalesce(new.data -> 'payments', '{}'::jsonb);
begin
  if o is distinct from n then
    insert into public.audit_log (actor, actor_email, action, detail)
    values (
      (select auth.uid()),
      (select auth.jwt()) ->> 'email',
      'cambio_medios_de_pago',
      jsonb_build_object(
        'transfer_antes', o -> 'transfer',
        'transfer_despues', n -> 'transfer',
        'mp_antes', o -> 'mercadopago',
        'mp_despues', n -> 'mercadopago',
        'efectivo_antes', o -> 'cash',
        'efectivo_despues', n -> 'cash'
      )
    );
  end if;
  return new;
end;
$$;
revoke all on function public.audit_settings_change() from public, anon, authenticated;

drop trigger if exists settings_audit on public.settings;
create trigger settings_audit
  after update on public.settings
  for each row execute function public.audit_settings_change();

create or replace function public.audit_admins_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor, actor_email, action, detail)
  values (
    (select auth.uid()),
    (select auth.jwt()) ->> 'email',
    case tg_op when 'INSERT' then 'alta_administradora' else 'baja_administradora' end,
    jsonb_build_object('email', coalesce(new.email, old.email))
  );
  return coalesce(new, old);
end;
$$;
revoke all on function public.audit_admins_change() from public, anon, authenticated;

drop trigger if exists admins_audit on public.admins;
create trigger admins_audit
  after insert or delete on public.admins
  for each row execute function public.audit_admins_change();
