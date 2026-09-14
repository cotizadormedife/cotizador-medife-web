-- RF-67: cada versión de la lista de precios muestra un número de versión
-- (Ver.1, Ver.2, ...) junto a su vigencia, que se incrementa cada vez que se
-- la pisa/sobrescribe (RF-66 para el mes actual, y ahora también para el mes
-- siguiente).
alter table price_list_versions add column version_num integer not null default 1;

-- Backfill de las 2 versiones que ya se pisaron/subieron a la fecha de este
-- cambio (14/09/2026): Septiembre 2026 ya fue pisada una vez (Ver.2);
-- Agosto 2026 y Octubre 2026 quedan en su Ver.1 por defecto.
update price_list_versions set version_num = 2
  where id = '6cdfd463-bab9-4d1e-ae84-0a7248df9bab';

-- El reemplazo de precios (delete+insert atómico) ahora también incrementa
-- version_num — se usa tanto para "pisar mes actual" como para sobrescribir
-- una versión de "mes siguiente" que ya existía.
create or replace function overwrite_active_price_list(
  p_version_id uuid,
  p_rows jsonb,
  p_source_filename text,
  p_parse_report jsonb,
  p_actor_id uuid
) returns void
language plpgsql
as $$
begin
  delete from prices where price_list_version_id = p_version_id;

  insert into prices (price_list_version_id, region_code, categoria, age_bracket_code, plan_code, monto)
  select
    p_version_id,
    r->>'region_code',
    (r->>'categoria')::categoria_t,
    r->>'age_bracket_code',
    r->>'plan_code',
    (r->>'monto')::numeric
  from jsonb_array_elements(p_rows) as r;

  update price_list_versions
  set source_filename = p_source_filename,
      parse_report = p_parse_report,
      uploaded_by = p_actor_id,
      uploaded_at = now(),
      activated_by = p_actor_id,
      activated_at = now(),
      version_num = version_num + 1
  where id = p_version_id;
end;
$$;
