-- RF-66: al cargar una lista de precios eligiendo "pisar la del mes actual",
-- hay que reemplazar todos los precios de la versión activa de una sola vez
-- — si se hiciera con un delete + insert sueltos desde la aplicación y el
-- insert fallara a mitad de camino, el sitio en vivo quedaría sin precios
-- para todos los usuarios. Se hace en una función de Postgres para que
-- corra en una única transacción (si algo falla, no se borra nada).
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
      activated_at = now()
  where id = p_version_id;
end;
$$;
