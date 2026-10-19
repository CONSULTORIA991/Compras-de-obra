-- =====================================================================
-- Compras de obra · Esquema de base de datos para Supabase
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------- Perfiles (uno por usuario de Supabase Auth) ----------
create table if not exists public.perfiles (
  id      uuid primary key references auth.users(id) on delete cascade,
  nombre  text,
  email   text,
  roles   text[] not null default '{solicitante}',
  activo  boolean not null default false,   -- los usuarios nuevos quedan inactivos hasta que el admin los active
  creado  timestamptz not null default now()
);

create or replace function public.nuevo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.nuevo_perfil();

-- Funciones de ayuda para las políticas de seguridad
create or replace function public.es_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select activo from public.perfiles where id = auth.uid()), false)
$$;

create or replace function public.tiene_rol(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select activo and (r = any(roles) or 'admin' = any(roles))
                   from public.perfiles where id = auth.uid()), false)
$$;

-- ---------- Catálogos ----------
create table if not exists public.proyectos (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null,
  activo  boolean not null default true,
  creado  timestamptz not null default now()
);

create table if not exists public.proveedores (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  nit       text, contacto text, telefono text, email text, ciudad text,
  activo    boolean not null default true,
  creado    timestamptz not null default now()
);

-- ---------- Requisiciones (cada una con sus ítems, cotizaciones, pagos e historial) ----------
create table if not exists public.requisiciones (
  id          uuid primary key default gen_random_uuid(),
  numero      bigserial unique,                -- consecutivo REQ-0001, REQ-0002…
  version     integer not null default 1,      -- evita que dos personas se pisen los cambios
  data        jsonb not null,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists requisiciones_numero_idx on public.requisiciones (numero desc);

-- ---------- Notificaciones dentro de la app ----------
create table if not exists public.notificaciones (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.perfiles(id) on delete cascade,
  req_id   uuid,
  mensaje  text not null,
  leida    boolean not null default false,
  creado   timestamptz not null default now()
);
create index if not exists notificaciones_user_idx on public.notificaciones (user_id, creado desc);

-- ---------- Seguridad: Row Level Security ----------
alter table public.perfiles       enable row level security;
alter table public.proyectos      enable row level security;
alter table public.proveedores    enable row level security;
alter table public.requisiciones  enable row level security;
alter table public.notificaciones enable row level security;

drop policy if exists perfiles_ver on public.perfiles;
create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_activo());
drop policy if exists perfiles_admin on public.perfiles;
create policy perfiles_admin on public.perfiles for update to authenticated
  using (public.tiene_rol('admin')) with check (public.tiene_rol('admin'));

drop policy if exists proyectos_ver on public.proyectos;
create policy proyectos_ver on public.proyectos for select to authenticated using (public.es_activo());
drop policy if exists proyectos_editar on public.proyectos;
create policy proyectos_editar on public.proyectos for all to authenticated
  using (public.tiene_rol('admin') or public.tiene_rol('compras'))
  with check (public.tiene_rol('admin') or public.tiene_rol('compras'));

drop policy if exists proveedores_ver on public.proveedores;
create policy proveedores_ver on public.proveedores for select to authenticated using (public.es_activo());
drop policy if exists proveedores_editar on public.proveedores;
create policy proveedores_editar on public.proveedores for all to authenticated
  using (public.tiene_rol('admin') or public.tiene_rol('compras'))
  with check (public.tiene_rol('admin') or public.tiene_rol('compras'));

drop policy if exists req_ver on public.requisiciones;
create policy req_ver on public.requisiciones for select to authenticated using (public.es_activo());
drop policy if exists req_crear on public.requisiciones;
create policy req_crear on public.requisiciones for insert to authenticated with check (public.es_activo());
drop policy if exists req_editar on public.requisiciones;
create policy req_editar on public.requisiciones for update to authenticated
  using (public.es_activo()) with check (public.es_activo());
drop policy if exists req_borrar on public.requisiciones;
create policy req_borrar on public.requisiciones for delete to authenticated using (public.tiene_rol('admin'));

drop policy if exists notif_crear on public.notificaciones;
create policy notif_crear on public.notificaciones for insert to authenticated with check (public.es_activo());
drop policy if exists notif_ver on public.notificaciones;
create policy notif_ver on public.notificaciones for select to authenticated using (user_id = auth.uid());
drop policy if exists notif_leer on public.notificaciones;
create policy notif_leer on public.notificaciones for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Archivos (cotizaciones y soportes de pago) ----------
insert into storage.buckets (id, name, public) values ('adjuntos', 'adjuntos', false)
  on conflict (id) do nothing;

drop policy if exists adjuntos_ver on storage.objects;
create policy adjuntos_ver on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos' and public.es_activo());
drop policy if exists adjuntos_subir on storage.objects;
create policy adjuntos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'adjuntos' and public.es_activo());

-- =====================================================================
-- DESPUÉS de crear su propio usuario (Authentication → Users → Add user),
-- conviértase en administrador ejecutando (cambie el correo):
--
--   update public.perfiles set roles = '{admin,tesoreria}', activo = true, nombre = 'Su nombre'
--   where email = 'su-correo@odesa.com.co';
-- =====================================================================
