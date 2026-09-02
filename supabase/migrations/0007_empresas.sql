-- Empresas / Brokers: cada usuario (vendedor o admin) pertenece a una
-- empresa/broker. Medife es la empresa "propia", con un id fijo conocido
-- para poder aplicar reglas de negocio (Super Admin solo Medife, Admin de
-- Medife con visibilidad total) sin depender de buscarla por nombre.

create table empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text not null check (char_length(direccion) <= 200),
  created_at timestamptz not null default now()
);
create unique index empresas_nombre_unique on empresas (lower(nombre));

insert into empresas (id, nombre, direccion)
values ('00000000-0000-0000-0000-000000000001', 'Medife', 'Lima 87');

alter table profiles add column empresa_id uuid references empresas(id);

-- Backfill: migrar el texto libre "empresa" de perfiles existentes a la
-- nueva tabla. "Medife" (sin importar mayúsculas) apunta a la empresa
-- semilla; cualquier otro valor distinto se crea como empresa nueva
-- (dirección desconocida, a completar por el Super Admin).
do $$
declare
  r record;
  new_id uuid;
begin
  update profiles set empresa_id = '00000000-0000-0000-0000-000000000001'
  where empresa_id is null and lower(trim(empresa)) = 'medife';

  for r in
    select distinct trim(empresa) as nombre from profiles
    where empresa_id is null and trim(coalesce(empresa, '')) <> ''
  loop
    insert into empresas (nombre, direccion) values (r.nombre, 'Sin dirección registrada')
    returning id into new_id;
    update profiles set empresa_id = new_id where empresa_id is null and trim(empresa) = r.nombre;
  end loop;
end $$;

-- Un Super Admin únicamente puede pertenecer a Medife (RF-30). Se valida a
-- nivel de base para que la regla se respete sin importar desde dónde se
-- asigne el rol (UI, script de mantenimiento, etc.).
create or replace function public.enforce_super_admin_empresa() returns trigger
language plpgsql as $$
begin
  if new.role = 'super_admin' and (new.empresa_id is null or new.empresa_id <> '00000000-0000-0000-0000-000000000001') then
    raise exception 'Un Super Admin solo puede pertenecer a la empresa Medife';
  end if;
  return new;
end; $$;

create trigger profiles_enforce_super_admin_empresa
  before insert or update on profiles
  for each row execute function public.enforce_super_admin_empresa();

-- El trigger de alta de usuario ahora recibe empresa_id (uuid) en vez de un
-- texto libre de empresa.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nombre, apellido, celular, empresa_id, status)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'apellido',
    new.raw_user_meta_data->>'celular',
    nullif(new.raw_user_meta_data->>'empresa_id', '')::uuid,
    'pending_approval'
  );
  return new;
end; $$;

alter table empresas enable row level security;
-- Sin políticas de INSERT/UPDATE para anon/authenticated: el ABM pasa por
-- Server Actions con el cliente service-role. El combo de registro/alta de
-- usuarios también se resuelve del lado del servidor.
create policy empresas_select on empresas for select using ( true );

-- current_user_empresa_id()/is_medife_empresa(): funciones de apoyo para
-- las políticas de alcance por empresa (defensa en profundidad — el filtro
-- real ya se aplica en las Server Actions con service role).
create or replace function public.current_user_empresa_id() returns uuid
language sql security definer set search_path = public stable as $$
  select empresa_id from profiles where id = auth.uid();
$$;

create or replace function public.is_medife_empresa(emp_id uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select emp_id = '00000000-0000-0000-0000-000000000001';
$$;

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (
    id = auth.uid()
    or current_user_role() = 'super_admin'
    or (current_user_role() = 'admin' and (
      is_medife_empresa(current_user_empresa_id())
      or empresa_id = current_user_empresa_id()
    ))
  );

drop policy if exists quotes_select on quotes;
create policy quotes_select on quotes for select
  using (
    created_by = auth.uid()
    or current_user_role() = 'super_admin'
    or (current_user_role() = 'admin' and (
      is_medife_empresa(current_user_empresa_id())
      or exists (
        select 1 from profiles p
        where p.id = quotes.created_by and p.empresa_id = current_user_empresa_id()
      )
    ))
  );
