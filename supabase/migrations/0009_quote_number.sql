-- RF-46 / RF-47: número identificador único e irrepetible por cotización,
-- mostrado en los listados y buscable por filtro numérico.
alter table quotes add column quote_number bigint generated always as identity unique;
