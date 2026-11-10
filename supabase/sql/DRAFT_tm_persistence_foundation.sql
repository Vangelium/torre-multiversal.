-- BORRADOR NO APLICADO. Inspeccionar primero el esquema del proyecto existente.
-- Fase 1 de persistencia: guardar respaldo legacy sin conceder autoridad económica.
-- Se ejecutará como migración controlada únicamente tras recuperar acceso al Supabase ya usado por el juego.
begin;

create table if not exists public.tm_players (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Viajero'
    check (length(btrim(display_name)) between 1 and 40),
  legacy_profile_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Copia de seguridad NO FIABLE: jamás generar monedas, objetos ni propiedades a partir de este JSON.
create table if not exists public.tm_legacy_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  import_key text not null check (length(import_key) between 1 and 128),
  save_format text not null default 'tm' check (save_format = 'tm'),
  save_version smallint not null check (save_version between 0 and 99),
  payload jsonb not null
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 1048576),
  origin text not null check (origin in ('github_pages','netlify','manual_export')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, import_key)
);
create index if not exists tm_legacy_backups_user_time
  on public.tm_legacy_backups (user_id, created_at desc);

-- Registros económicos: solo procesos del servidor pueden escribirlos.
create table if not exists public.tm_economy_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in
    ('drop','harvest','craft','trade','consume','admin_grant','migration_reviewed')),
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists tm_economy_events_actor_time
  on public.tm_economy_events (actor_id, created_at desc);

create table if not exists public.tm_inventory_lots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  item_code text not null check (length(item_code) between 1 and 96),
  quantity bigint not null check (quantity >= 0),
  origin_event_id uuid not null references public.tm_economy_events(id) on delete restrict,
  origin_line integer not null check (origin_line >= 0),
  provenance jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provenance) = 'object'),
  created_at timestamptz not null default now(),
  unique (origin_event_id, origin_line)
);
create index if not exists tm_inventory_lots_owner_item
  on public.tm_inventory_lots (owner_id, item_code);

create table if not exists public.tm_currency_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  event_id uuid not null references public.tm_economy_events(id) on delete restrict,
  event_line integer not null check (event_line >= 0),
  delta bigint not null check (delta <> 0),
  created_at timestamptz not null default now(),
  unique (event_id, event_line)
);
create index if not exists tm_currency_ledger_owner_time
  on public.tm_currency_ledger (owner_id, created_at desc);

alter table public.tm_players enable row level security;
alter table public.tm_legacy_backups enable row level security;
alter table public.tm_economy_events enable row level security;
alter table public.tm_inventory_lots enable row level security;
alter table public.tm_currency_ledger enable row level security;

-- No se afecta realtime.messages ni el servicio Broadcast actual.
revoke all on table
  public.tm_players, public.tm_legacy_backups, public.tm_economy_events,
  public.tm_inventory_lots, public.tm_currency_ledger
  from anon, authenticated;

grant select, insert, update on public.tm_players to authenticated;
grant select, insert on public.tm_legacy_backups to authenticated;
grant select on public.tm_economy_events, public.tm_inventory_lots,
  public.tm_currency_ledger to authenticated;

create policy tm_players_read_own on public.tm_players
  for select to authenticated using ((select auth.uid()) = user_id);
create policy tm_players_insert_own on public.tm_players
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tm_players_update_own on public.tm_players
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy tm_legacy_backups_read_own on public.tm_legacy_backups
  for select to authenticated using ((select auth.uid()) = user_id);
create policy tm_legacy_backups_insert_own on public.tm_legacy_backups
  for insert to authenticated
  with check ((select auth.uid()) = user_id and verified = false);

create policy tm_economy_events_read_actor on public.tm_economy_events
  for select to authenticated using ((select auth.uid()) = actor_id);
create policy tm_inventory_lots_read_own on public.tm_inventory_lots
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy tm_currency_ledger_read_own on public.tm_currency_ledger
  for select to authenticated using ((select auth.uid()) = owner_id);

commit;

-- Falta expresamente: RPC transaccionales / Edge Functions para drops,
-- crafting, transferencias, precio, propiedad y saldo; no habilitar escrituras
-- desde navegador sobre los registros económicos.
