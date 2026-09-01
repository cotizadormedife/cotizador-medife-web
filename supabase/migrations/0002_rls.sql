-- Row Level Security
create function public.current_user_role() returns text
language sql security definer set search_path = public stable as $$
  select role::text from profiles where id = auth.uid();
$$;

alter table profiles enable row level security;
create policy profiles_select on profiles for select
  using ( id = auth.uid() or current_user_role() in ('admin','super_admin') );
-- Sin políticas de INSERT/UPDATE/DELETE para anon/authenticated: toda escritura de
-- perfiles (onboarding, aprobar/rechazar, ascender, deshabilitar) pasa por Server
-- Actions con el cliente service-role, después de validar sesión + rol en el servidor.

alter table quotes enable row level security;
create policy quotes_select on quotes for select
  using ( created_by = auth.uid() or current_user_role() in ('admin','super_admin') );
-- Sin política de INSERT: las cotizaciones solo se escriben desde runQuote() (service role).

alter table audit_log enable row level security;
create policy audit_log_select on audit_log for select
  using ( current_user_role() in ('admin','super_admin') );

-- Todo lo relacionado a precios/políticas: RLS activo, CERO políticas para
-- anon/authenticated. Solo el service_role (server-only, nunca expuesto al
-- navegador) puede leer estas tablas — así ni una fuga de la anon key expone
-- la lista de precios o las políticas de descuento.
alter table prices enable row level security;
alter table discount_policies enable row level security;
alter table discount_policy_plan_rules enable row level security;
alter table discount_policy_schedule enable row level security;
alter table monotributo_brackets enable row level security;
alter table pricing_config enable row level security;
alter table price_list_versions enable row level security;
alter table regions enable row level security;
alter table filiales enable row level security;
alter table age_brackets enable row level security;
alter table member_types enable row level security;
alter table plans enable row level security;
