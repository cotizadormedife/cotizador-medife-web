-- M8: cada carga de Excel reemplaza precios Y políticas de descuento juntos,
-- en una sola transacción, para la price_list_version correspondiente.
-- Reemplaza a overwrite_active_price_list (0017), que solo tocaba prices.

drop function if exists overwrite_active_price_list(uuid, jsonb, text, jsonb, uuid);

create or replace function insert_discount_policies(p_version_id uuid, p_policy_rows jsonb)
returns void
language plpgsql
as $$
declare
  pol jsonb;
  new_policy_id uuid;
begin
  for pol in select * from jsonb_array_elements(p_policy_rows)
  loop
    insert into discount_policies (
      id, price_list_version_id, slug, nombre, tipo, grupo, categoria_especial,
      region, categoria_scope, procedencia_gate, zona_filial, valor_pct, permanente,
      plazo_meses, concatenable, requiere_slug, excluye_otros, excluye_grupo,
      edad_max_titular_conyuge, detalle, fuente_comentario, activo
    ) values (
      gen_random_uuid(), p_version_id, pol->>'slug', pol->>'nombre', (pol->>'tipo')::policy_tipo,
      pol->>'grupo', pol->>'categoriaEspecial',
      pol->>'region', nullif(pol->>'categoriaScope', '')::categoria_t, pol->>'procedenciaGate', pol->>'zonaFilial',
      (pol->>'valorPct')::numeric, (pol->>'permanente')::boolean, (pol->>'plazoMeses')::smallint,
      (pol->>'concatenable')::boolean, pol->>'requiereSlugPrefix', (pol->>'excluyeOtros')::boolean,
      (select array_agg(x) from jsonb_array_elements_text(pol->'excluyeGrupo') x),
      (pol->>'edadMaxTitularConyuge')::smallint, pol->>'detalle', pol->>'fuenteComentario', true
    )
    returning id into new_policy_id;

    insert into discount_policy_plan_rules (discount_policy_id, plan_code, aplica)
    select new_policy_id, r->>'planCode', (r->>'aplica')::boolean
    from jsonb_array_elements(pol->'planRules') r;

    insert into discount_policy_schedule (discount_policy_id, seq, valor_pct, months)
    select new_policy_id, (s->>'seq')::smallint, (s->>'valorPct')::numeric, (s->>'months')::smallint
    from jsonb_array_elements(pol->'schedule') s;
  end loop;
end;
$$;

-- "Pisar" o re-subir una vigencia que ya existe: reemplaza prices y
-- discount_policies de esa versión de punta a punta, en una transacción.
create or replace function overwrite_price_list_version(
  p_version_id uuid,
  p_price_rows jsonb,
  p_policy_rows jsonb,
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
  from jsonb_array_elements(p_price_rows) as r;

  delete from discount_policies where price_list_version_id = p_version_id; -- cascada limpia plan_rules/schedule
  perform insert_discount_policies(p_version_id, p_policy_rows);

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

-- Primera carga para una vigencia nueva: crea la price_list_version y sus
-- precios/políticas juntos, también en una transacción (antes esto vivía
-- repartido en varios pasos JS con un rollback manual solo para prices).
create or replace function insert_price_list_version(
  p_source_filename text,
  p_vigencia_anio int,
  p_vigencia_mes int,
  p_price_rows jsonb,
  p_policy_rows jsonb,
  p_parse_report jsonb,
  p_actor_id uuid
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

  return new_version_id;
end;
$$;
