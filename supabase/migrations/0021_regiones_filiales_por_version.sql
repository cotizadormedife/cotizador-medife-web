-- M9: regiones y filiales también se leen de cada Excel subido (hoja
-- "Info"), versionadas por price_list_version — como ya pasa con prices y
-- discount_policies (M8). No se toca la PK/FK de `regions`/`filiales`
-- (las usan prices.region_code, quotes.region_code/filial_code,
-- filiales.region_code) — son tablas nuevas, solo para poblar los combos
-- del cotizador de forma reactiva por lista elegida.

create table price_list_version_regions (
  price_list_version_id uuid not null references price_list_versions(id) on delete cascade,
  code text not null,
  nombre text not null,
  sort_order smallint not null,
  primary key (price_list_version_id, code)
);

create table price_list_version_filiales (
  price_list_version_id uuid not null references price_list_versions(id) on delete cascade,
  code text not null,
  region_code text not null,
  nombre text not null,
  sort_order smallint not null,
  primary key (price_list_version_id, code)
);

alter table price_list_version_regions enable row level security;
alter table price_list_version_filiales enable row level security;

-- Bootstrap: todas las versiones ya cargadas hoy quedan con una copia 1:1
-- del catálogo global actual (que ya es correcto y estable), hasta que se
-- vuelvan a subir con el importador nuevo.
insert into price_list_version_regions (price_list_version_id, code, nombre, sort_order)
select plv.id, r.code, r.nombre, r.sort_order
from price_list_versions plv
cross join regions r;

insert into price_list_version_filiales (price_list_version_id, code, region_code, nombre, sort_order)
select plv.id, f.code, f.region_code, f.nombre, f.sort_order
from price_list_versions plv
cross join filiales f;
