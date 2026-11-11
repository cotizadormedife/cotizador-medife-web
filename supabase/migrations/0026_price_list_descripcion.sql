-- RF-122: descripción opcional (hasta 50 caracteres) de cada lista de precios.
-- Se carga al subir el Excel y se muestra arriba de cada lista en la pantalla de cotización.
-- Aditiva y compatible hacia atrás: la columna admite null, así que el código anterior sigue funcionando.
alter table price_list_versions
  add column if not exists descripcion text;

alter table price_list_versions
  drop constraint if exists price_list_versions_descripcion_largo;
alter table price_list_versions
  add constraint price_list_versions_descripcion_largo
  check (descripcion is null or char_length(descripcion) <= 50);

comment on column price_list_versions.descripcion is
  'Descripción opcional de la lista (máx. 50 caracteres); se muestra arriba de la lista en el cotizador.';
