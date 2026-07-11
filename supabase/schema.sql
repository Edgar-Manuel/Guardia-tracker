-- Esquema de Guardia Tracker para Supabase (PostgreSQL).
-- Ejecutar en el editor SQL del proyecto. Incluye RLS para que cada usuario
-- solo pueda ver y modificar sus propios registros.

create table if not exists public.guardias (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  inicio timestamptz not null,
  fin timestamptz,
  tipo text not null check (tipo in ('guardia_12h', 'guardia_24h', 'otro')),
  notas text not null default '',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.avisos (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  guardia_id uuid,
  fecha date not null,
  tipo text not null check (
    tipo in (
      'bateria', 'pinchazo', 'cambio_rueda', 'traslado_coche', 'traslado_moto',
      'apertura', 'combustible', 'rescate', 'accidente', 'averia_mecanica',
      'desplazamiento_base', 'recogida_vehiculo', 'otro'
    )
  ),
  hora_asignacion timestamptz,
  hora_salida timestamptz,
  hora_llegada timestamptz,
  hora_inicio_trabajo timestamptz,
  hora_fin timestamptz,
  hora_disponible timestamptz,
  km_inicio numeric,
  km_fin numeric,
  min_conduccion integer,
  min_parado integer,
  min_espera integer,
  municipio text not null default '',
  destino text not null default '',
  aseguradora text not null default '',
  observaciones text not null default '',
  lat double precision,
  lng double precision,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.descansos (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  inicio timestamptz not null,
  fin timestamptz,
  tipo text not null check (tipo in ('comida', 'cena', 'descanso', 'cafe')),
  notas text not null default '',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Índices para la sincronización incremental (filtro por updated_at)
create index if not exists guardias_user_updated on public.guardias (user_id, updated_at);
create index if not exists avisos_user_updated on public.avisos (user_id, updated_at);
create index if not exists descansos_user_updated on public.descansos (user_id, updated_at);

-- Seguridad a nivel de fila: cada usuario accede solo a sus datos
alter table public.guardias enable row level security;
alter table public.avisos enable row level security;
alter table public.descansos enable row level security;

drop policy if exists "guardias propias" on public.guardias;
create policy "guardias propias" on public.guardias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "avisos propios" on public.avisos;
create policy "avisos propios" on public.avisos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "descansos propios" on public.descansos;
create policy "descansos propios" on public.descansos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
