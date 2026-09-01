-- Cotizador Medife Individual — esquema base
create extension if not exists "pgcrypto";

create type user_role as enum ('vendedor','admin','super_admin');
create type user_status as enum ('pending_profile','pending_approval','approved','rejected');
create type categoria_t as enum ('Vol','Obl');
create type procedencia_t as enum ('Otros','comprobable');
create type price_list_status as enum ('draft','active','archived');
create type policy_tipo as enum ('dto','gaf','ucc','recargo');

-- ── identidad / perfiles ──────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nombre text,
  apellido text,
  celular text,
  empresa text,
  role user_role not null default 'vendedor',
  status user_status not null default 'pending_profile',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nombre, apellido)
  values (
    new.id, new.email,
    new.raw_user_meta_data->>'given_name',
    new.raw_user_meta_data->>'family_name'
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── catálogos ──────────────────────────────────────────────────────
create table regions (
  code text primary key,
  nombre text not null,
  sort_order smallint not null
);

create table filiales (
  code text primary key,
  region_code text not null references regions(code),
  nombre text not null,
  descuento_pct numeric(6,4) not null default 0, -- Descuento Filial permanente (ej. NOA -0.20)
  sort_order smallint not null
);

create table plans (
  code text primary key,   -- INDIE, MEDIFEPLUS, BRONCE_C, BRONCE, PLATA, ORO, PLATINUM
  nombre text not null,
  sort_order smallint not null
);

create table member_types (
  code text primary key,   -- TITULAR, ESPOSO, HIJO, FAMILIAR
  nombre text not null
);

create table age_brackets (
  code text primary key,   -- ej. '0-25', 'MAT-0-25', 'HIJO-0-1', 'FAM' — coincide 1:1 con las claves del legacy
  member_type_code text not null references member_types(code),
  label text not null,
  sort_order smallint not null
);

create table monotributo_brackets (
  letra char(1) primary key,   -- A..K
  monto numeric(12,2) not null
);

create table pricing_config (
  key text primary key,
  value numeric not null,
  description text
);

-- ── listas de precios (versionadas) ────────────────────────────────
create table price_list_versions (
  id uuid primary key default gen_random_uuid(),
  source_filename text,
  status price_list_status not null default 'draft',
  uploaded_by uuid references profiles(id),   -- null = carga semilla (sin usuario real todavía)
  uploaded_at timestamptz not null default now(),
  activated_by uuid references profiles(id),
  activated_at timestamptz,
  parse_report jsonb,
  notes text
);
create unique index one_active_price_list on price_list_versions ((status = 'active')) where status = 'active';

create table prices (
  id bigint generated always as identity primary key,
  price_list_version_id uuid not null references price_list_versions(id) on delete cascade,
  region_code text not null references regions(code),
  categoria categoria_t not null,
  age_bracket_code text not null references age_brackets(code),
  plan_code text not null references plans(code),
  monto numeric(12,2) not null,   -- $0 literal permitido, se migra tal cual figura en el Excel fuente
  unique (price_list_version_id, region_code, categoria, age_bracket_code, plan_code)
);
create index prices_lookup_idx on prices (price_list_version_id, region_code, categoria);

-- ── políticas de descuento/recargo/gaf/ucc ─────────────────────────
create table discount_policies (
  id text primary key,     -- slug legacy (ej. 'opcion-1-nac-Obl')
  nombre text not null,
  tipo policy_tipo not null,
  region text not null,               -- 'Nac' | 'AMBA' | 'Norte' | 'Sur' | 'Interior' | 'SurExt'
  categoria_scope categoria_t,         -- null = ambas
  procedencia_gate text not null default '',   -- '' | 'GAF' | 'comprobable'
  zona_filial text,                    -- lista separada por comas de nombres de filial, o null = cualquiera
  valor_pct numeric(6,4) not null,
  permanente boolean not null default false,
  plazo_meses smallint,
  concatenable boolean not null default false,
  detalle text,
  activo boolean not null default true
);

create table discount_policy_plan_rules (
  discount_policy_id text not null references discount_policies(id) on delete cascade,
  plan_code text not null references plans(code),
  aplica boolean not null default true,
  primary key (discount_policy_id, plan_code)
);

-- cronograma de descuentos escalonados (bloques consecutivos, en orden)
create table discount_policy_schedule (
  discount_policy_id text not null references discount_policies(id) on delete cascade,
  seq smallint not null,
  valor_pct numeric(6,4) not null,
  months smallint not null,
  primary key (discount_policy_id, seq)
);

-- ── cotizaciones (trazabilidad completa) ───────────────────────────
create table quotes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  price_list_version_id uuid not null references price_list_versions(id),
  vendedor_nombre text not null,
  asociado_nombre text not null,
  region_code text not null references regions(code),
  categoria categoria_t not null,
  procedencia procedencia_t not null,
  filial_code text not null references filiales(code),
  vigencia text,
  input jsonb not null,
  output jsonb not null
);
create index quotes_created_by_idx on quotes (created_by, created_at desc);
create index quotes_created_at_idx on quotes (created_at desc);

create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id),
  action text not null,
  target_type text,
  target_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);
