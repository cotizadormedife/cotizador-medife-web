-- RF-64: cada versión de la lista de precios queda identificada por su
-- vigencia (mes/año), asignada siempre en forma automática y correlativa al
-- cargar un archivo (nunca editable a mano) — ver uploadPriceListAction.
alter table price_list_versions add column vigencia_anio smallint;
alter table price_list_versions add column vigencia_mes smallint check (vigencia_mes between 1 and 12);

-- Backfill de las 2 versiones existentes a la fecha de este cambio (11/09/2026):
-- la archivada (seed inicial) pasa a ser Agosto 2026, la activa actual pasa a
-- ser Septiembre 2026 — tal como se le pidió a Diego.
update price_list_versions set vigencia_anio = 2026, vigencia_mes = 8
  where id = '00000000-0000-0000-0000-000000000001';
update price_list_versions set vigencia_anio = 2026, vigencia_mes = 9
  where id = '6cdfd463-bab9-4d1e-ae84-0a7248df9bab';

alter table price_list_versions alter column vigencia_anio set not null;
alter table price_list_versions alter column vigencia_mes set not null;
alter table price_list_versions add constraint price_list_versions_vigencia_unique unique (vigencia_anio, vigencia_mes);
