-- Catálogos base (regiones, filiales, planes, tramos etarios, monotributo, config)

insert into regions (code, nombre, sort_order) values
  ('AMBA', 'AMBA', 1),
  ('Norte', 'Norte', 2),
  ('Sur', 'Sur', 3),
  ('Patagonia', 'Patagonia', 4),
  ('Bahía/MDQ', 'Bahía Blanca / Mar del Plata', 5);

insert into filiales (code, region_code, nombre, descuento_pct, sort_order) values
  ('CABA', 'AMBA', 'CABA', 0, 1),
  ('GBA Sur', 'AMBA', 'GBA Sur', 0, 2),
  ('GBA Oeste', 'AMBA', 'GBA Oeste', 0, 3),
  ('GBA Norte', 'AMBA', 'GBA Norte', 0, 4),
  ('Córdoba', 'Norte', 'Córdoba', -0.10, 1),
  ('Corrientes', 'Norte', 'Corrientes', -0.25, 2),
  ('Misiones', 'Norte', 'Misiones', -0.25, 3),
  ('NOA', 'Norte', 'NOA (Tucumán · Salta · Jujuy)', -0.20, 4),
  ('Rosario', 'Norte', 'Rosario', 0, 5),
  ('Santa Fe', 'Norte', 'Santa Fe', -0.05, 6),
  ('Mendoza', 'Sur', 'Mendoza', 0, 1),
  ('Mercedes', 'Sur', 'Mercedes', 0, 2),
  ('San Juan', 'Sur', 'San Juan', 0, 3),
  ('Comahue', 'Patagonia', 'Comahue', 0, 1),
  ('Patagonia Norte', 'Patagonia', 'Patagonia Norte', 0, 2),
  ('Patagonia Sur', 'Patagonia', 'Patagonia Sur', 0, 3),
  ('Bahía Blanca', 'Bahía/MDQ', 'Bahía Blanca', 0, 1),
  ('Mar del Plata', 'Bahía/MDQ', 'Mar del Plata', 0, 2);

insert into plans (code, nombre, sort_order) values
  ('INDIE', 'INDIE', 1),
  ('MEDIFEPLUS', 'MEDIFÉ+', 2),
  ('BRONCE_C', 'BRONCE C.', 3),
  ('BRONCE', 'BRONCE', 4),
  ('PLATA', 'PLATA', 5),
  ('ORO', 'ORO', 6),
  ('PLATINUM', 'PLATINUM', 7);

insert into member_types (code, nombre) values
  ('TITULAR', 'Titular'),
  ('ESPOSO', 'Esposo/a'),
  ('HIJO', 'Hijo/a'),
  ('FAMILIAR', 'Familiar a cargo');

-- Los códigos de tramo etario coinciden 1:1 con las claves usadas en la tabla de
-- precios legacy (BUILTIN_PRICES) — no hay distinción AMBA/Interior a nivel de
-- datos: el mapeo de etiquetas de UI (ej. "Hijo 1" en el interior) a estos
-- códigos normalizados vive en la capa de aplicación (lib/pricing), igual que
-- en el cotizador actual (getMiembroKey).
insert into age_brackets (code, member_type_code, label, sort_order) values
  ('0-25', 'TITULAR', '0 a 25 años', 1),
  ('26-35', 'TITULAR', '26 a 35 años', 2),
  ('36-40', 'TITULAR', '36 a 40 años', 3),
  ('41-50', 'TITULAR', '41 a 50 años', 4),
  ('51-60', 'TITULAR', '51 a 60 años', 5),
  ('61-65', 'TITULAR', '61 a 65 años', 6),
  ('66-00', 'TITULAR', '66 años o más', 7),
  ('MAT-0-25', 'ESPOSO', '0 a 25 años', 1),
  ('MAT-26-35', 'ESPOSO', '26 a 35 años', 2),
  ('MAT-36-40', 'ESPOSO', '36 a 40 años', 3),
  ('MAT-41-50', 'ESPOSO', '41 a 50 años', 4),
  ('MAT-51-60', 'ESPOSO', '51 a 60 años', 5),
  ('MAT-61-65', 'ESPOSO', '61 a 65 años', 6),
  ('MAT-66-00', 'ESPOSO', '66 años o más', 7),
  ('HIJO-0-1', 'HIJO', '0 a 1 año', 1),
  ('HIJO-2-20', 'HIJO', '2 a 20 años', 2),
  ('HIJO-21-25', 'HIJO', '21 a 25 años', 3),
  ('HIJO-26-29', 'HIJO', '26 a 29 años', 4),
  ('HIJO-30-39', 'HIJO', '30 a 39 años', 5),
  ('HIJO-40-49', 'HIJO', '40 a 49 años', 6),
  ('FAM', 'FAMILIAR', 'Familiar a cargo', 1);

insert into monotributo_brackets (letra, monto) values
  ('A', 25694.55), ('B', 25694.55), ('C', 25694.55), ('D', 30535.56),
  ('E', 37238.48), ('F', 42824.25), ('G', 46175.72), ('H', 55485.33),
  ('I', 68518.81), ('J', 76897.46), ('K', 87882.82);

insert into pricing_config (key, value, description) values
  ('aporte_tope', 4509567.41, 'Tope salarial para el cálculo de aportes (categoría Obligatorio, origen Obra Social/Medifé)'),
  ('aporte_pct_capado', 0.0255, 'Porcentaje de aporte que se calcula con tope salarial'),
  ('aporte_pct_no_capado', 0.051, 'Porcentaje de aporte sin tope salarial'),
  ('aporte_factor_obras_sociales', 0.93, 'Factor G para origen "OBRAS SOCIALES"'),
  ('aporte_factor_medife', 0.97, 'Factor G para origen "Medife"'),
  ('monotributo_factor', 0.93, 'Factor aplicado sobre el monto de tabla de Monotributo'),
  ('iva_voluntario_pct', 0.105, 'IVA aplicado sobre el total en categoría Voluntario'),
  ('ucc_pct', -0.15, 'Descuento UCC, fijo, sobre el subtotal base'),
  ('descuento_comercial_tope_pct', -0.70, 'Tope combinado de descuentos comerciales seleccionados');
