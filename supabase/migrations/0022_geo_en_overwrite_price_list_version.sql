-- M9: overwrite_price_list_version / insert_price_list_version también
-- reemplazan/crean el snapshot de regiones y filiales de esa versión, en
-- la misma transacción que precios y políticas.

create or replace function insert_price_list_version_geo(p_version_id uuid, p_region_rows jsonb, p_filial_rows jsonb)
returns void
language plpgsql
as $$
begin
  insert into price_list_version_regions (price_list_version_id, code, nombre, sort_order)
  select p_version_id, r->>'code', r->>'nombre', (r->>'sortOrder')::smallint
  from jsonb_array_elements(p_region_rows) as r;

  insert into price_list_version_filiales (price_list_version_id, code, region_code, nombre, sort_order)
  select p_version_id, f->>'code', f->>'regionCode', f->>'nombre', (f->>'sortOrder')::smallint
  from jsonb_array_elements(p_filial_rows) as f;
end;
$$;

create or replace function overwrite_price_list_version(
  p_version_id uuid,
  p_price_rows jsonb,
  p_policy_rows jsonb,
  p_source_filename text,
  p_parse_report jsonb,
  p_actor_id uuid,
  p_region_rows jsonb default '[]'::jsonb,
  p_filial_rows jsonb default '[]'::jsonb
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
  from jsonb_array_elements(p_price_rows) as r;

  delete from discount_policies where price_list_version_id = p_version_id; -- cascada limpia plan_rules/schedule
  perform insert_discount_policies(p_version_id, p_policy_rows);

  delete from price_list_version_regions where price_list_version_id = p_version_id;
  delete from price_list_version_filiales where price_list_version_id = p_version_id;
  perform insert_price_list_version_geo(p_version_id, p_region_rows, p_filial_rows);

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

create or replace function insert_price_list_version(
  p_source_filename text,
  p_vigencia_anio int,
  p_vigencia_mes int,
  p_price_rows jsonb,
  p_policy_rows jsonb,
  p_parse_report jsonb,
  p_actor_id uuid,
  p_region_rows jsonb default '[]'::jsonb,
  p_filial_rows jsonb default '[]'::jsonb
) returns uuid
language plpgsql
as $$
declare
  new_version_id uuid;
begin
  insert into price_list_versions (source_filename, status, uploaded_by, parse_report, vigencia_anio, vigencia_mes)
  values (p_source_filename, 'draft', p_actor_id, p_parse_report, p_vigencia_anio, p_vigencia_mes)
  returning id into new_version_id;

  insert into prices (price_list_version_id, region_code, categoria, age_bracket_code, plan_code, monto)
  select
    new_version_id,
    r->>'region_code',
    (r->>'categoria')::categoria_t,
    r->>'age_bracket_code',
    r->>'plan_code',
    (r->>'monto')::numeric
  from jsonb_array_elements(p_price_rows) as r;

  perform insert_discount_policies(new_version_id, p_policy_rows);
  perform insert_price_list_version_geo(new_version_id, p_region_rows, p_filial_rows);

  return new_version_id;
end;
$$;
