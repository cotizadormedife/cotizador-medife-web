-- M9 (corregido): el importador ahora puede traer una filial nueva (ej.
-- "Tandil") con su región ya confirmada por el propio Excel — se agrega al
-- catálogo global de una vez (si no existía) antes de guardar el snapshot
-- de la versión, para que el FK de quotes.filial_code quede satisfecho
-- apenas esa filial es seleccionable en el combo.
create or replace function insert_price_list_version_geo(p_version_id uuid, p_region_rows jsonb, p_filial_rows jsonb)
returns void
language plpgsql
as $$
begin
  insert into price_list_version_regions (price_list_version_id, code, nombre, sort_order)
  select p_version_id, r->>'code', r->>'nombre', (r->>'sortOrder')::smallint
  from jsonb_array_elements(p_region_rows) as r;

  insert into filiales (code, region_code, nombre, sort_order)
  select distinct f->>'code', f->>'regionCode', f->>'nombre', 999
  from jsonb_array_elements(p_filial_rows) as f
  on conflict (code) do nothing;

  insert into price_list_version_filiales (price_list_version_id, code, region_code, nombre, sort_order)
  select p_version_id, f->>'code', f->>'regionCode', f->>'nombre', (f->>'sortOrder')::smallint
  from jsonb_array_elements(p_filial_rows) as f;
end;
$$;
