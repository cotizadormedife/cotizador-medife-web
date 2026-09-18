-- M13: los planes/productos también se leen de cada Excel subido (hoja
-- "Info", columna "Producto"), versionados por price_list_version — como ya
-- pasa con prices, discount_policies (M8) y regiones/filiales (M9). A pedido
-- de Diego: la cantidad y el orden de los planes puede cambiar de una lista
-- a otra (se espera que se agregue uno en una próxima versión).
--
-- No se toca la PK de la tabla global `plans` (referenciada por FK desde
-- prices.plan_code y discount_policy_plan_rules.plan_code) — es una tabla
-- nueva, aditiva, solo para el orden/etiqueta de cada versión puntual.

create table price_list_version_planes (
  price_list_version_id uuid not null references price_list_versions(id) on delete cascade,
  code text not null,
  nombre text not null,
  sort_order smallint not null,
  primary key (price_list_version_id, code)
);

alter table price_list_version_planes enable row level security;

-- Bootstrap: todas las versiones ya cargadas hoy quedan con una copia 1:1
-- del catálogo global actual (7 planes, estable hasta ahora), hasta que se
-- vuelvan a subir con el importador nuevo.
insert into price_list_version_planes (price_list_version_id, code, nombre, sort_order)
select plv.id, p.code, p.nombre, p.sort_order
from price_list_versions plv
cross join plans p;
