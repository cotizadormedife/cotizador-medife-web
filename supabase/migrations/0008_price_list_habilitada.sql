-- RF-44 / RF-45: el Super Admin puede habilitar o deshabilitar cada versión
-- de la lista de precios; el combo del cotizador (listSelectablePriceListVersions)
-- solo ofrece las habilitadas. La invariante de que siempre quede al menos una
-- habilitada se controla en el server action, no acá.
alter table price_list_versions add column habilitada boolean not null default true;
