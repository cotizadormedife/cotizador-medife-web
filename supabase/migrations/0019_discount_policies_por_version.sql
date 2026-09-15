-- M8: las políticas de descuento pasan a ser propias de cada
-- price_list_version (como ya son los precios) en vez de un set global
-- único que ninguna carga de Excel volvía a tocar. El `id` de texto
-- hardcodeado (ej. "opcion-4-nac-Obl") deja de ser la clave primaria —
-- pasa a ser un `slug` de clasificación, único solo dentro de cada
-- versión (dos versiones distintas pueden tener cada una su "opcion-4").

-- 1. Nueva PK uuid en discount_policies, en paralelo al id de texto viejo.
alter table discount_policies add column id_new uuid not null default gen_random_uuid();

-- 2. Nuevas FK uuid en las tablas hijas, resueltas por join contra el id viejo.
alter table discount_policy_plan_rules add column discount_policy_id_new uuid;
update discount_policy_plan_rules r
set discount_policy_id_new = dp.id_new
from discount_policies dp
where dp.id = r.discount_policy_id;

alter table discount_policy_schedule add column discount_policy_id_new uuid;
update discount_policy_schedule s
set discount_policy_id_new = dp.id_new
from discount_policies dp
where dp.id = s.discount_policy_id;

-- 3. Sacar las FK/PK viejas y las columnas de texto de las tablas hijas.
alter table discount_policy_plan_rules drop constraint discount_policy_plan_rules_discount_policy_id_fkey;
alter table discount_policy_plan_rules drop constraint discount_policy_plan_rules_pkey;
alter table discount_policy_plan_rules drop column discount_policy_id;
alter table discount_policy_plan_rules rename column discount_policy_id_new to discount_policy_id;
alter table discount_policy_plan_rules alter column discount_policy_id set not null;

alter table discount_policy_schedule drop constraint discount_policy_schedule_discount_policy_id_fkey;
alter table discount_policy_schedule drop constraint discount_policy_schedule_pkey;
alter table discount_policy_schedule drop column discount_policy_id;
alter table discount_policy_schedule rename column discount_policy_id_new to discount_policy_id;
alter table discount_policy_schedule alter column discount_policy_id set not null;

-- 4. Swap de la PK de discount_policies: id de texto -> slug, id_new -> id.
alter table discount_policies drop constraint discount_policies_pkey;
alter table discount_policies rename column id to slug;
alter table discount_policies rename column id_new to id;
alter table discount_policies add primary key (id);

-- 5. Reponer FK/PK de las tablas hijas contra la nueva PK uuid.
alter table discount_policy_plan_rules
  add constraint discount_policy_plan_rules_discount_policy_id_fkey
  foreign key (discount_policy_id) references discount_policies(id) on delete cascade;
alter table discount_policy_plan_rules add primary key (discount_policy_id, plan_code);

alter table discount_policy_schedule
  add constraint discount_policy_schedule_discount_policy_id_fkey
  foreign key (discount_policy_id) references discount_policies(id) on delete cascade;
alter table discount_policy_schedule add primary key (discount_policy_id, seq);

-- 6. Versionado por lista de precios + campos explícitos que reemplazan
-- la clasificación por prefijo de id hardcodeada en el motor.
alter table discount_policies add column price_list_version_id uuid references price_list_versions(id) on delete cascade;
alter table discount_policies add column grupo text not null default 'otro';
alter table discount_policies add column categoria_especial text;
alter table discount_policies add column requiere_slug text;
alter table discount_policies add column excluye_otros boolean not null default false;
alter table discount_policies add column excluye_grupo text[];
alter table discount_policies add column edad_max_titular_conyuge smallint;
alter table discount_policies add column fuente_comentario text;

create unique index discount_policies_version_slug_uq on discount_policies (price_list_version_id, slug);
create index discount_policies_version_idx on discount_policies (price_list_version_id);

-- 7. Bootstrap: el set global actual pasa a ser el set propio de la
-- versión activa hoy (Septiembre) — clasificado con la misma convención
-- de prefijos de slug que ya usaba el motor, para no cambiar ningún
-- cálculo existente hasta que se vuelva a subir con el importador nuevo.
update discount_policies
set price_list_version_id = (select id from price_list_versions where status = 'active'),
    grupo = case
      when procedencia_gate = 'GAF' then 'gaf'
      when tipo = 'recargo' then 'recargo'
      when slug like 'ajuste-lista-hijos%' or slug like 'segmento-joven%' or slug like 'descuento-filial%' then 'ajuste'
      when slug like 'opcion-%' then 'estrategico'
      when slug like 'dto-mes%' or slug like 'dto-indie%' then 'tactico'
      else 'otro'
    end,
    categoria_especial = case
      when slug like 'ajuste-lista-hijos%' then 'ajuste_hijos'
      when slug like 'segmento-joven-h-25%' then 'segmento_joven_h25'
      when slug like 'segmento-joven-h-29%' then 'segmento_joven_h29'
      when slug like 'descuento-filial%' then 'descuento_filial'
      else null
    end,
    requiere_slug = case when slug like 'opcion-6%' then 'opcion-4' else null end,
    edad_max_titular_conyuge = case when slug like 'opcion-6%' then 60 else null end;

alter table discount_policies alter column price_list_version_id set not null;
